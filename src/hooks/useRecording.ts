import { useRef, useCallback, useState } from 'react';
import { PoseResult } from './usePoseDetection';

export interface PoseFrame {
 /** Frame time in seconds from recording start */
 t: number;
 /** Array of [x, y, z, visibility] for each landmark (0-33) */
 lm: number[][];
}

export interface PoseRecording {
 version: string;
 frameRate: number;
 width: number;
 height: number;
 duration: number;
 /** Ordered landmark names matching the lm arrays */
 landmarks: string[];
 frames: PoseFrame[];
}

// MediaPipe landmark names in index order
const LANDMARK_NAMES = [
 'NOSE', 'LEFT_EYE_INNER', 'LEFT_EYE', 'LEFT_EYE_OUTER',
 'RIGHT_EYE_INNER', 'RIGHT_EYE', 'RIGHT_EYE_OUTER',
 'LEFT_EAR', 'RIGHT_EAR', 'MOUTH_LEFT', 'MOUTH_RIGHT',
 'LEFT_SHOULDER', 'RIGHT_SHOULDER', 'LEFT_ELBOW', 'RIGHT_ELBOW',
 'LEFT_WRIST', 'RIGHT_WRIST', 'LEFT_PINKY', 'RIGHT_PINKY',
 'LEFT_INDEX', 'RIGHT_INDEX', 'LEFT_THUMB', 'RIGHT_THUMB',
 'LEFT_HIP', 'RIGHT_HIP', 'LEFT_KNEE', 'RIGHT_KNEE',
 'LEFT_ANKLE', 'RIGHT_ANKLE', 'LEFT_HEEL', 'RIGHT_HEEL',
 'LEFT_FOOT_INDEX', 'RIGHT_FOOT_INDEX',
];

export const FRAME_RATE = 30; // 30 fps recording

export function useRecording() {
 const [isRecording, setIsRecording] = useState(false);
 const [recordedFrames, setRecordedFrames] = useState<PoseFrame[]>([]);
 const [duration, setDuration] = useState(0);

 const recordingRef = useRef(false);
 const startTimeRef = useRef(0);
 const lastFrameTimeRef = useRef(-1);
 const frameIntervalRef = useRef(1000 / FRAME_RATE); // ms between frames
 const widthRef = useRef(640);
 const heightRef = useRef(480);

 const startRecording = useCallback(() => {
 recordingRef.current = true;
 startTimeRef.current = performance.now();
 lastFrameTimeRef.current = -1;
 setRecordedFrames([]);
 setIsRecording(true);
 setDuration(0);
 }, []);

 const stopRecording = useCallback((): PoseRecording | null => {
 recordingRef.current = false;
 setIsRecording(false);

 const frames = [...recordedFrames]; // snapshot
 if (frames.length === 0) return null;

 const dur = (frames[frames.length - 1].t - frames[0].t);

 return {
 version: '1.0',
 frameRate: FRAME_RATE,
 width: widthRef.current,
 height: heightRef.current,
 duration: dur,
 landmarks: [...LANDMARK_NAMES],
 frames,
 };
 }, [recordedFrames]);

 /** Call on each pose result — records frame if enough time has passed */
 const onPoseResult = useCallback((result: PoseResult) => {
 if (!recordingRef.current) return;

 const now = performance.now();
 const elapsed = now - startTimeRef.current;

 // Only record at the target frame rate
 if (lastFrameTimeRef.current >= 0 &&
 elapsed - lastFrameTimeRef.current < frameIntervalRef.current) {
 return;
 }
 lastFrameTimeRef.current = elapsed;

 const landmarks = result.landmarks?.[0];
 if (!landmarks || landmarks.length === 0) return;

 widthRef.current = result.imageWidth;
 heightRef.current = result.imageHeight;

 const lm = landmarks.map((l) => [l.x, l.y, l.z, l.visibility]);

 setRecordedFrames((prev) => [...prev, { t: elapsed / 1000, lm }]);
 setDuration(elapsed / 1000);
 }, []);

 return {
 isRecording,
 recordedFrames,
 duration,
 startRecording,
 stopRecording,
 onPoseResult,
 };
}
