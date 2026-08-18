import React, { useRef, useEffect } from 'react';
import SkeletonOverlay from './SkeletonOverlay';
import { PoseLandmark } from '../hooks/usePoseDetection';

interface CameraViewProps {
 videoRef: React.RefObject<HTMLVideoElement | null>;
 landmarks: PoseLandmark[] | undefined;
 width: number;
 height: number;
 flipped: boolean;
}

const CameraView: React.FC<CameraViewProps> = ({
 videoRef,
 landmarks,
 width,
 height,
 flipped,
}) => {
 return (
 <div
 style={{
 position: 'relative',
 width: '100%',
 maxWidth: 640,
 aspectRatio: '4 / 3',
 overflow: 'hidden',
 borderRadius: 16,
 backgroundColor: '#1a1a2e',
 boxShadow: '0 0 40px rgba(0,0,0,0.5)',
 }}
 >
 <video
 ref={videoRef as React.RefObject<HTMLVideoElement>}
 style={{
 width: '100%',
 height: '100%',
 objectFit: 'cover',
 transform: flipped ? 'scaleX(-1)' : 'none',
 }}
 playsInline
 muted
 />
 <SkeletonOverlay
 landmarks={landmarks}
 width={width}
 height={height}
 />
 </div>
 );
};

export default CameraView;
