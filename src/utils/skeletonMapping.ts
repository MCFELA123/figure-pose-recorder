import { PoseLandmark } from '../hooks/usePoseDetection';

// MediaPipe Pose landmark indices
export const LANDMARK = {
 NOSE: 0,
 LEFT_EYE_INNER: 1,
 LEFT_EYE: 2,
 LEFT_EYE_OUTER: 3,
 RIGHT_EYE_INNER: 4,
 RIGHT_EYE: 5,
 RIGHT_EYE_OUTER: 6,
 LEFT_EAR: 7,
 RIGHT_EAR: 8,
 MOUTH_LEFT: 9,
 MOUTH_RIGHT: 10,
 LEFT_SHOULDER: 11,
 RIGHT_SHOULDER: 12,
 LEFT_ELBOW: 13,
 RIGHT_ELBOW: 14,
 LEFT_WRIST: 15,
 RIGHT_WRIST: 16,
 LEFT_PINKY: 17,
 RIGHT_PINKY: 18,
 LEFT_INDEX: 19,
 RIGHT_INDEX: 20,
 LEFT_THUMB: 21,
 RIGHT_THUMB: 22,
 LEFT_HIP: 23,
 RIGHT_HIP: 24,
 LEFT_KNEE: 25,
 RIGHT_KNEE: 26,
 LEFT_ANKLE: 27,
 RIGHT_ANKLE: 28,
 LEFT_HEEL: 29,
 RIGHT_HEEL: 30,
 LEFT_FOOT_INDEX: 31,
 RIGHT_FOOT_INDEX: 32,
} as const;

export interface Joint {
 x: number;
 y: number;
 visibility: number;
}

export interface Bone {
 from: keyof typeof LANDMARK;
 to: keyof typeof LANDMARK;
 color: string;
 width: number;
}

// ─── Skeleton definition ────────────────────────────────────────────────

export const BONES: Bone[] = [
 // Torso
 { from: 'LEFT_SHOULDER', to: 'RIGHT_SHOULDER', color: '#FFFFFF', width: 4 },
 { from: 'LEFT_SHOULDER', to: 'LEFT_HIP', color: '#FFFFFF', width: 4 },
 { from: 'RIGHT_SHOULDER', to: 'RIGHT_HIP', color: '#FFFFFF', width: 4 },
 { from: 'LEFT_HIP', to: 'RIGHT_HIP', color: '#FFFFFF', width: 4 },

 // Arms
 { from: 'LEFT_SHOULDER', to: 'LEFT_ELBOW', color: '#FFFFFF', width: 4 },
 { from: 'LEFT_ELBOW', to: 'LEFT_WRIST', color: '#FFFFFF', width: 3 },
 { from: 'RIGHT_SHOULDER', to: 'RIGHT_ELBOW', color: '#FFFFFF', width: 4 },
 { from: 'RIGHT_ELBOW', to: 'RIGHT_WRIST', color: '#FFFFFF', width: 3 },

 // Legs
 { from: 'LEFT_HIP', to: 'LEFT_KNEE', color: '#FFFFFF', width: 5 },
 { from: 'LEFT_KNEE', to: 'LEFT_ANKLE', color: '#FFFFFF', width: 4 },
 { from: 'RIGHT_HIP', to: 'RIGHT_KNEE', color: '#FFFFFF', width: 5 },
 { from: 'RIGHT_KNEE', to: 'RIGHT_ANKLE', color: '#FFFFFF', width: 4 },
];

// Joints to draw as circles with their radii
export const JOINTS: { landmark: keyof typeof LANDMARK; radius: number; color: string }[] = [
 { landmark: 'NOSE', radius: 8, color: '#FFFFFF' },
 { landmark: 'LEFT_SHOULDER', radius: 7, color: '#FF9500' },
 { landmark: 'RIGHT_SHOULDER', radius: 7, color: '#FF9500' },
 { landmark: 'LEFT_ELBOW', radius: 6, color: '#FF9500' },
 { landmark: 'RIGHT_ELBOW', radius: 6, color: '#FF9500' },
 { landmark: 'LEFT_WRIST', radius: 5, color: '#FF3B30' },
 { landmark: 'RIGHT_WRIST', radius: 5, color: '#FF3B30' },
 { landmark: 'LEFT_HIP', radius: 7, color: '#34C759' },
 { landmark: 'RIGHT_HIP', radius: 7, color: '#34C759' },
 { landmark: 'LEFT_KNEE', radius: 6, color: '#34C759' },
 { landmark: 'RIGHT_KNEE', radius: 6, color: '#34C759' },
 { landmark: 'LEFT_ANKLE', radius: 5, color: '#007AFF' },
 { landmark: 'RIGHT_ANKLE', radius: 5, color: '#007AFF' },
];

// ─── Helpers ────────────────────────────────────────────────────────────

export function getJoint(
 landmarks: PoseLandmark[] | undefined,
 lm: keyof typeof LANDMARK,
 width: number,
 height: number,
): Joint | null {
 if (!landmarks || landmarks.length === 0) return null;
 const idx = LANDMARK[lm];
 const point = landmarks[idx];
 if (!point || point.visibility < 0.5) return null;
 return {
 x: point.x * width,
 y: point.y * height,
 visibility: point.visibility,
 };
}

export function getMidpoint(a: Joint, b: Joint): Joint {
 return {
 x: (a.x + b.x) / 2,
 y: (a.y + b.y) / 2,
 visibility: Math.min(a.visibility, b.visibility),
 };
}
