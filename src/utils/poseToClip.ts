// ─────────────────────────────────────────────────────────────────────────────
// poseToClip — convert a raw MediaPipe pose recording (33 landmarks/frame, as
// produced by hooks/useRecording.ts) into a front-facing Clip the StickFigure
// player can consume.
//
// Raw format:
//   { frameRate, width, height, landmarks[], frames: [{ t, lm: [[x,y,z,vis]×33] }] }
// where x,y are normalized 0..1 in image space (+x right, +y down).
//
// We keep a 15-joint front-facing skeleton (head + neck + shoulders/elbows/wrists
// + pelvis + hips/knees/ankles), with neck/pelvis computed as shoulder/hip
// midpoints. Positions are fit into a 100×100 viewBox with ONE global bounding
// box over the whole clip (not per-frame) so real translation — stepping,
// swaying, jumping — is preserved instead of being normalized away.
// ─────────────────────────────────────────────────────────────────────────────

export type Pt = [number, number];
export type Frame = Pt[];
export type Bone = [number, number];

export interface Clip {
 id: string;
 name: string;
 source: 'builtin' | 'recorded';
 fps: number;
 frameCount: number;
 loop: boolean;
 viewBox: [number, number, number, number];
 head: { r: number };
 headIndex: number;
 joints: string[];
 bones: Bone[];
 frames: Frame[];
}

interface PoseFrame {
 t: number;
 lm: number[][];
}
export interface PoseRecording {
 version: string;
 frameRate: number;
 width: number;
 height: number;
 duration: number;
 landmarks: string[];
 frames: PoseFrame[];
}

// MediaPipe Pose landmark indices (subset we use) — mirrors
// src/utils/skeletonMapping.ts.
const NOSE = 0;
const L_SHOULDER = 11, R_SHOULDER = 12;
const L_ELBOW = 13, R_ELBOW = 14;
const L_WRIST = 15, R_WRIST = 16;
const L_HIP = 23, R_HIP = 24;
const L_KNEE = 25, R_KNEE = 26;
const L_ANKLE = 27, R_ANKLE = 28;

// Base joints pulled directly from MediaPipe, in a stable local order.
const BASE = [
 NOSE,
 L_SHOULDER, R_SHOULDER,
 L_ELBOW, R_ELBOW,
 L_WRIST, R_WRIST,
 L_HIP, R_HIP,
 L_KNEE, R_KNEE,
 L_ANKLE, R_ANKLE,
];
// local-array positions
const B_NOSE = 0;
const B_LSH = 1, B_RSH = 2;
const B_LHIP = 7, B_RHIP = 8;

// Final clip joint order (neck + pelvis are computed midpoints inserted in).
export const RECORDED_JOINTS = [
 'head', 'neck',
 'left_shoulder', 'right_shoulder',
 'left_elbow', 'right_elbow',
 'left_wrist', 'right_wrist',
 'pelvis',
 'left_hip', 'right_hip',
 'left_knee', 'right_knee',
 'left_ankle', 'right_ankle',
];
const J_HEAD = 0, J_NECK = 1, J_LSH = 2, J_RSH = 3, J_LEL = 4, J_REL = 5,
 J_LWR = 6, J_RWR = 7, J_PELVIS = 8, J_LHIP = 9, J_RHIP = 10,
 J_LKN = 11, J_RKN = 12, J_LAN = 13, J_RAN = 14;

export const RECORDED_BONES: Bone[] = [
 [J_HEAD, J_NECK],            // head → neck
 [J_NECK, J_PELVIS],          // spine
 [J_LSH, J_RSH],              // shoulder line (passes through neck)
 [J_LHIP, J_RHIP],            // hip line (passes through pelvis)
 [J_LSH, J_LEL], [J_LEL, J_LWR], // left arm
 [J_RSH, J_REL], [J_REL, J_RWR], // right arm
 [J_LHIP, J_LKN], [J_LKN, J_LAN], // left leg
 [J_RHIP, J_RKN], [J_RKN, J_RAN], // right leg
];

const HEAD_INDEX = J_HEAD;

// Mirror X so playback reads like the mirrored (selfie) view the user recorded
// against — raising the hand you saw on the left plays back on the left.
const MIRROR_X = true;
const VIS_MIN = 0.3; // below this, hold the joint's last good position
const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Convert a raw recording into a playable Clip. Returns null if the recording
 * is too short or has no usable landmark data.
 */
export function poseToClip(raw: PoseRecording, name: string): Clip | null {
 if (!raw || !Array.isArray(raw.frames) || raw.frames.length < 2) return null;

 const W = raw.width || 640;
 const H = raw.height || 480;

 // 1. Per-frame base joint positions in pixel space, holding last-good on
 //    low-visibility landmarks so brief dropouts don't cause popping.
 const prev: (number[] | null)[] = BASE.map(() => null);
 const basePx: number[][][] = []; // basePx[frame][baseJoint] = [px, py]
 for (const fr of raw.frames) {
 const row: number[][] = [];
 for (let b = 0; b < BASE.length; b++) {
 const l = fr.lm?.[BASE[b]];
 let px: number, py: number;
 if (l && (l[3] ?? 1) >= VIS_MIN) {
 px = l[0] * W; py = l[1] * H;
 } else if (prev[b]) {
 px = prev[b]![0]; py = prev[b]![1];
 } else if (l) {
 px = l[0] * W; py = l[1] * H; // low vis but nothing better yet
 } else {
 px = W / 2; py = H / 2;
 }
 row.push([px, py]);
 prev[b] = [px, py];
 }
 basePx.push(row);
 }

 // 2. Assemble the 15 final joints per frame (compute neck & pelvis midpoints).
 const mid = (a: number[], b: number[]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
 const framesPx: number[][][] = basePx.map((r) => {
 const neck = mid(r[B_LSH], r[B_RSH]);
 const pelvis = mid(r[B_LHIP], r[B_RHIP]);
 // order MUST match RECORDED_JOINTS
 return [
 r[B_NOSE], neck,
 r[B_LSH], r[B_RSH],
 r[3], r[4],   // L/R elbow
 r[5], r[6],   // L/R wrist
 pelvis,
 r[B_LHIP], r[B_RHIP],
 r[9], r[10],  // L/R knee
 r[11], r[12], // L/R ankle
 ];
 });

 // 3. Head radius from mean shoulder width (pixel space).
 let shoulderSum = 0;
 for (const r of basePx) {
 shoulderSum += Math.hypot(r[B_LSH][0] - r[B_RSH][0], r[B_LSH][1] - r[B_RSH][1]);
 }
 let headRpx = (shoulderSum / basePx.length) * 0.5;
 if (!isFinite(headRpx) || headRpx <= 0) headRpx = Math.min(W, H) * 0.06;

 // 4. Global bounding box over every joint of every frame, padded by the head
 //    radius (so the head circle never clips) + a little breathing room.
 let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
 for (const fr of framesPx) {
 for (const j of fr) {
 if (j[0] < minX) minX = j[0];
 if (j[0] > maxX) maxX = j[0];
 if (j[1] < minY) minY = j[1];
 if (j[1] > maxY) maxY = j[1];
 }
 }
 const pad = headRpx * 1.2;
 minX -= pad; maxX += pad; minY -= pad; maxY += pad;

 const bboxW = Math.max(maxX - minX, 1e-3);
 const bboxH = Math.max(maxY - minY, 1e-3);

 // 5. Uniform fit into the viewBox (preserves body proportions), centered.
 const VB = 100;
 const margin = 4;
 const usable = VB - margin * 2;
 const scale = usable / Math.max(bboxW, bboxH);
 const offsetX = margin + (usable - bboxW * scale) / 2;
 const offsetY = margin + (usable - bboxH * scale) / 2;

 const frames = framesPx.map((fr) =>
 fr.map((j) => {
 let vx = offsetX + (j[0] - minX) * scale;
 const vy = offsetY + (j[1] - minY) * scale;
 if (MIRROR_X) vx = VB - vx;
 return [round(vx), round(vy)] as Pt;
 }),
 );

 const headR = round(Math.min(Math.max(headRpx * scale, 3), 16));
 const fps = raw.frameRate && raw.frameRate > 0 ? Math.round(raw.frameRate) : 30;

 return {
 id: `rec-${Date.now()}`,
 name: name.trim() || `Recording ${new Date().toLocaleDateString()}`,
 source: 'recorded',
 fps,
 frameCount: frames.length,
 loop: true,
 viewBox: [0, 0, VB, VB],
 head: { r: headR },
 headIndex: HEAD_INDEX,
 joints: RECORDED_JOINTS,
 bones: RECORDED_BONES,
 frames,
 };
}
