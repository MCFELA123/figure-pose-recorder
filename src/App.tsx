import React, { useState, useRef, useCallback, useEffect } from 'react';
import CameraView from './components/CameraView';
import { usePoseDetection, PoseResult } from './hooks/usePoseDetection';
import { useRecording, PoseRecording } from './hooks/useRecording';
import { poseToClip, Clip } from './utils/poseToClip';
import { downloadJSON } from './utils/exportPose';

const App: React.FC = () => {
 const videoRef = useRef<HTMLVideoElement>(null);
 const [isTracking, setIsTracking] = useState(false);
 const [poseResult, setPoseResult] = useState<PoseResult | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [pendingClip, setPendingClip] = useState<Clip | null>(null);
 const [name, setName] = useState('');
 const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
 const [savedPath, setSavedPath] = useState<string | null>(null);

 // ── Camera selection ──────────────────────────────────────────────────────
 const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
 const [deviceId, setDeviceId] = useState<string>(''); // '' = default (front)

 // Enumerate video inputs. Labels only populate after camera permission is
 // granted, so we call this again post-start; a devicechange listener keeps it
 // fresh if a camera is (un)plugged.
 const refreshCameras = useCallback(async () => {
 try {
 const list = await navigator.mediaDevices.enumerateDevices();
 setCameras(list.filter((d) => d.kind === 'videoinput'));
 } catch {
 /* enumerateDevices unsupported / blocked — ignore */
 }
 }, []);

 useEffect(() => {
 refreshCameras();
 const md: any = navigator.mediaDevices;
 md?.addEventListener?.('devicechange', refreshCameras);
 return () => md?.removeEventListener?.('devicechange', refreshCameras);
 }, [refreshCameras]);

 // Build getUserMedia constraints for the chosen camera. A concrete deviceId
 // wins; otherwise fall back to the front-facing camera.
 const getStream = useCallback((id: string) => {
 const video: MediaTrackConstraints = id
 ? { deviceId: { exact: id }, width: 640, height: 480 }
 : { facingMode: 'user', width: 640, height: 480 };
 return navigator.mediaDevices.getUserMedia({ video });
 }, []);

 // Back/rear cameras shouldn't be mirrored; front cameras should. Infer from
 // the selected device's label (deviceId itself carries no facing info).
 const currentLabel = cameras.find((c) => c.deviceId === deviceId)?.label ?? '';
 const flipped = !/back|rear|environment/i.test(currentLabel);


 const {
 isRecording,
 recordedFrames,
 duration,
 startRecording,
 stopRecording: stopRec,
 onPoseResult,
 } = useRecording();

 const handleResults = useCallback((result: PoseResult) => {
 setPoseResult(result);
 onPoseResult(result);
 }, [onPoseResult]);

 const { startCamera, stopCamera } = usePoseDetection(handleResults);

 const handleStart = useCallback(async () => {
 setError(null);
 try {
 const stream = await getStream(deviceId);
 if (videoRef.current) {
 videoRef.current.srcObject = stream;
 videoRef.current.play();
 await new Promise((resolve) => {
 videoRef.current!.onloadedmetadata = resolve;
 });
 await startCamera(videoRef.current);
 setIsTracking(true);
 // Permission is now granted → device labels are available.
 refreshCameras();
 }
 } catch (err: any) {
 setError(
 err.name === 'NotAllowedError'
 ? 'Camera access denied. Please allow camera permissions.'
 : `Failed to start: ${err.message}`,
 );
 }
 }, [getStream, deviceId, startCamera, refreshCameras]);

 // Change camera. Updates the selection and, if already tracking, swaps the
 // video element's stream live — the pose rAF loop keeps reading the same
 // element, so no restart of MediaPipe is needed.
 const handleSelectCamera = useCallback(async (id: string) => {
 setDeviceId(id);
 if (!isTracking || !videoRef.current) return;
 setError(null);
 try {
 const next = await getStream(id);
 const prev = videoRef.current.srcObject as MediaStream | null;
 videoRef.current.srcObject = next;
 await videoRef.current.play();
 prev?.getTracks().forEach((t) => t.stop());
 } catch (err: any) {
 setError(`Failed to switch camera: ${err.message ?? err.name}`);
 }
 }, [isTracking, getStream]);

 const handleStop = useCallback(() => {
 stopCamera();
 if (videoRef.current?.srcObject) {
 const stream = videoRef.current.srcObject as MediaStream;
 stream.getTracks().forEach((t) => t.stop());
 videoRef.current.srcObject = null;
 }
 setIsTracking(false);
 setPoseResult(null);
 }, [stopCamera]);

 // Toggle recording. On stop, convert the raw capture → playable Clip and show
 // the name / save panel.
 const handleRecord = useCallback(() => {
 if (isRecording) {
 const rec: PoseRecording | null = stopRec();
 const clip = rec ? poseToClip(rec, name || defaultName()) : null;
 if (clip) {
 setPendingClip(clip);
 setName((n) => n || defaultName());
 setSaveState('idle');
 setSavedPath(null);
 } else {
 setError('Recording too short — try again.');
 }
 } else {
 setPendingClip(null);
 setSaveState('idle');
 setError(null);
 startRecording();
 }
 }, [isRecording, startRecording, stopRec, name]);

 // Write the clip into the workspace via the dev-server endpoint. Falls back to
 // a browser download if the endpoint isn't available (e.g. built preview).
 const handleSave = useCallback(async () => {
 if (!pendingClip) return;
 const clip: Clip = { ...pendingClip, name: name.trim() || defaultName() };
 setSaveState('saving');
 try {
 const res = await fetch('/save-clip', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ clip }),
 });
 if (!res.ok) throw new Error(`HTTP ${res.status}`);
 const data = await res.json();
 setSavedPath(data.path ?? null);
 setSaveState('saved');
 } catch {
 // Endpoint unavailable → download the JSON so it can be dropped in manually.
 downloadJSON(clip, `${slug(clip.name)}.json`);
 setSaveState('saved');
 setSavedPath('(downloaded)');
 }
 }, [pendingClip, name]);

 const recordAnother = useCallback(() => {
 setPendingClip(null);
 setName('');
 setSaveState('idle');
 setSavedPath(null);
 }, []);

 const landmarks = poseResult?.landmarks?.[0];
 const landmarkCount = landmarks?.filter((lm) => lm.visibility > 0.5).length ?? 0;

 const formatTime = (s: number) => {
 const m = Math.floor(s / 60);
 const sec = (s % 60).toFixed(1);
 return `${m}:${sec.padStart(4, '0')}`;
 };

 const reviewing = !!pendingClip && !isRecording;

 return (
 <div className="app-container">
 <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.5px' }}>
 Figure Pose Recorder
 </h1>

 <CameraView
 videoRef={videoRef}
 landmarks={landmarks}
 width={640}
 height={480}
 flipped={flipped}
 />

 <div className="status-bar">
 {isRecording ? (
 <>
 <span className="status-dot recording" />
 <span style={{ color: '#FF3B30', fontWeight: 600 }}>
 ● REC {formatTime(duration)}
 </span>
 <span className="landmark-count">{recordedFrames.length} frames</span>
 </>
 ) : (
 <>
 <span className={`status-dot ${isTracking ? 'active' : 'inactive'}`} />
 <span>{isTracking ? 'Tracking' : 'Idle'}</span>
 {isTracking && !reviewing && (
 <span className="landmark-count">{landmarkCount}/33 landmarks visible</span>
 )}
 {reviewing && (
 <span className="landmark-count" style={{ color: '#34C759' }}>
 ✓ {pendingClip!.frameCount} frames captured
 </span>
 )}
 </>
 )}
 </div>

 {cameras.length > 0 && (
  <div className="camera-select-row" style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
   <label htmlFor="camera-select" style={{ fontSize: 13, opacity: 0.7, whiteSpace: 'nowrap' }}>
    Camera
   </label>
   <select
    id="camera-select"
    value={deviceId}
    onChange={(e) => handleSelectCamera(e.target.value)}
    disabled={isRecording}
    style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid #333', background: '#111', color: '#fff', fontSize: 14 }}
   >
    <option value="">Default (front)</option>
    {cameras.map((cam, i) => (
     <option key={cam.deviceId || i} value={cam.deviceId}>
      {cam.label || `Camera ${i + 1}`}
     </option>
    ))}
   </select>
  </div>
 )}

 <div className="controls-row">
 {!isTracking ? (
 <button className="btn primary" onClick={handleStart}>
 Start Camera
 </button>
 ) : (
 <>
 <button
 className={`btn ${isRecording ? 'danger' : 'record'}`}
 onClick={handleRecord}
 disabled={!isTracking}
 >
 {isRecording ? '⏹ Stop Recording' : '⏺ Record Movement'}
 </button>

 <button className="btn secondary" onClick={handleStop}>
 ✕ Close Camera
 </button>
 </>
 )}
 </div>

 {/* Name + save panel (after a capture) */}
 {reviewing && (
 <div className="recording-summary" style={{ flexDirection: 'column', gap: 10, alignItems: 'stretch' }}>
 <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center' }}>
 <span>{pendingClip!.frameCount} frames</span><span>·</span>
 <span>{(pendingClip!.frameCount / pendingClip!.fps).toFixed(1)}s</span><span>·</span>
 <span>{pendingClip!.fps}fps</span>
 </div>
 <input
 value={name}
 onChange={(e) => setName(e.target.value)}
 placeholder="Movement name (e.g. jumping jacks)"
 style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #333', background: '#111', color: '#fff', fontSize: 14 }}
 />
 <div style={{ display: 'flex', gap: 10 }}>
 <button className="btn save" onClick={handleSave} disabled={saveState === 'saving'} style={{ flex: 1 }}>
 {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? '✓ Saved' : '↓ Save to workspace'}
 </button>
 <button className="btn secondary" onClick={recordAnother}>
 {saveState === 'saved' ? 'Record another' : 'Discard'}
 </button>
 </div>
 {saveState === 'saved' && savedPath && (
 <div style={{ color: '#34C759', fontSize: 12, textAlign: 'center', wordBreak: 'break-all' }}>
 Saved → {savedPath}
 </div>
 )}
 </div>
 )}

 {error && (
 <div style={{ color: '#FF3B30', fontSize: 13, textAlign: 'center' }}>{error}</div>
 )}
 </div>
 );
};

function defaultName() {
 return `Movement ${new Date().toLocaleDateString()}`;
}
function slug(s: string) {
 return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'clip';
}

export default App;
