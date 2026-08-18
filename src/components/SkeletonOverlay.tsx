import React from 'react';
import { PoseLandmark } from '../hooks/usePoseDetection';
import {
 BONES,
 JOINTS,
 LANDMARK,
 getJoint,
 getMidpoint,
} from '../utils/skeletonMapping';

interface SkeletonOverlayProps {
 landmarks: PoseLandmark[] | undefined;
 width: number;
 height: number;
}

const SkeletonOverlay: React.FC<SkeletonOverlayProps> = ({ landmarks, width, height }) => {
 if (!landmarks || landmarks.length === 0) return null;

 // ═══ Render bones ═══
 const boneElements = BONES.map((bone, i) => {
 const from = getJoint(landmarks, bone.from, width, height);
 const to = getJoint(landmarks, bone.to, width, height);
 if (!from || !to) return null;

 return (
 <line
 key={`bone-${i}`}
 x1={from.x}
 y1={from.y}
 x2={to.x}
 y2={to.y}
 stroke={bone.color}
 strokeWidth={bone.width}
 strokeLinecap="round"
 opacity={0.9}
 />
 );
 });

 // ═══ Render joint circles ═══
 const jointElements = JOINTS.map((joint, i) => {
 const pos = getJoint(landmarks, joint.landmark, width, height);
 if (!pos) return null;

 return (
 <circle
 key={`joint-${i}`}
 cx={pos.x}
 cy={pos.y}
 r={joint.radius}
 fill={joint.color}
 opacity={0.9}
 />
 );
 });

 // ═══ Render head circle (nose + ear distance) ═══
 const nose = getJoint(landmarks, 'NOSE', width, height);
 const leftEar = getJoint(landmarks, 'LEFT_EAR', width, height);
 const rightEar = getJoint(landmarks, 'RIGHT_EAR', width, height);
 let headEl: React.ReactNode = null;
 if (nose) {
 const headRadius = (leftEar && rightEar)
 ? Math.abs(rightEar.x - leftEar.x) * 0.4
 : 24;
 headEl = (
 <circle
 cx={nose.x}
 cy={nose.y - headRadius * 0.3}
 r={headRadius}
 fill="none"
 stroke="#FFFFFF"
 strokeWidth={3}
 opacity={0.9}
 />
 );
 }

 // ═══ Render figure SVG connecting to skeleton ═══
 // Compute neck and mid-hip for the torso centerline
 const leftShoulder = getJoint(landmarks, 'LEFT_SHOULDER', width, height);
 const rightShoulder = getJoint(landmarks, 'RIGHT_SHOULDER', width, height);
 const leftHip = getJoint(landmarks, 'LEFT_HIP', width, height);
 const rightHip = getJoint(landmarks, 'RIGHT_HIP', width, height);

 const neck = leftShoulder && rightShoulder
 ? getMidpoint(leftShoulder, rightShoulder)
 : null;
 const midHip = leftHip && rightHip
 ? getMidpoint(leftHip, rightHip)
 : null;

 // Torso centerline
 const torsoLine = neck && midHip ? (
 <line
 x1={neck.x}
 y1={neck.y}
 x2={midHip.x}
 y2={midHip.y}
 stroke="#FFFFFF"
 strokeWidth={6}
 strokeLinecap="round"
 opacity={0.9}
 />
 ) : null;

 // Head-to-neck connector
 const headNeckLine = nose && neck ? (
 <line
 x1={nose.x}
 y1={nose.y}
 x2={neck.x}
 y2={neck.y}
 stroke="#FFFFFF"
 strokeWidth={4}
 strokeLinecap="round"
 opacity={0.9}
 />
 ) : null;

 return (
 <svg
 width={width}
 height={height}
 style={{
 position: 'absolute',
 top: 0,
 left: 0,
 zIndex: 10,
 }}
 >
 {boneElements}
 {torsoLine}
 {headNeckLine}
 {headEl}
 {jointElements}
 </svg>
 );
};

export default SkeletonOverlay;
