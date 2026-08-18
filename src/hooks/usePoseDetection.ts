import { useRef, useCallback } from 'react';
import { Pose, Results } from '@mediapipe/pose';

export interface PoseLandmark {
 x: number;
 y: number;
 z: number;
 visibility: number;
}

export interface PoseResult {
 landmarks: PoseLandmark[][];
 imageWidth: number;
 imageHeight: number;
}

// Drives MediaPipe Pose from a <video> element via our own requestAnimationFrame
// loop. We deliberately do NOT use @mediapipe/camera_utils' Camera: it hardcodes
// getUserMedia({ facingMode:'user' }) and exposes no deviceId, which makes camera
// selection impossible. Here the caller (App) owns the MediaStream — including
// which camera it came from — and we just pump frames from the video element.
export function usePoseDetection(
 onResults: (result: PoseResult) => void,
) {
 const poseRef = useRef<Pose | null>(null);
 const rafRef = useRef<number | null>(null);
 const runningRef = useRef(false);

 const startCamera = useCallback(async (videoElement: HTMLVideoElement) => {
 const pose = new Pose({
 // Serve the MediaPipe runtime + model from the same origin (bundled under
 // public/mediapipe) so the recorder works fully offline inside the app's
 // WebView. There is no network dependency.
 locateFile: (file: string) => `mediapipe/${file}`,
 });

 pose.setOptions({
 modelComplexity: 1,
 smoothLandmarks: true,
 enableSegmentation: false,
 smoothSegmentation: false,
 minDetectionConfidence: 0.5,
 minTrackingConfidence: 0.5,
 });

 pose.onResults((results: Results) => {
 const landmarks: PoseLandmark[][] = [];
 if (results.poseLandmarks) {
 landmarks.push(
 results.poseLandmarks.map((lm) => ({
 x: lm.x,
 y: lm.y,
 z: lm.z,
 visibility: lm.visibility ?? 1,
 })),
 );
 }
 onResults({
 landmarks,
 imageWidth: results.image.width,
 imageHeight: results.image.height,
 });
 });

 poseRef.current = pose;
 runningRef.current = true;

 // Self-scheduling loop — await each send() before queuing the next frame so
 // MediaPipe never receives overlapping sends. Reads whatever stream is
 // currently attached to the video element, so swapping the camera mid-run
 // (App replaces video.srcObject) keeps working without restarting pose.
 const tick = async () => {
 if (!runningRef.current) return;
 const p = poseRef.current;
 if (p && videoElement.readyState >= 2) {
 try {
 await p.send({ image: videoElement });
 } catch {
 // send can reject if pose is closed mid-flight — ignore.
 }
 }
 if (runningRef.current) rafRef.current = requestAnimationFrame(tick);
 };
 rafRef.current = requestAnimationFrame(tick);
 }, [onResults]);

 const stopCamera = useCallback(() => {
 runningRef.current = false;
 if (rafRef.current != null) {
 cancelAnimationFrame(rafRef.current);
 rafRef.current = null;
 }
 poseRef.current?.close();
 poseRef.current = null;
 }, []);

 return { startCamera, stopCamera };
}
