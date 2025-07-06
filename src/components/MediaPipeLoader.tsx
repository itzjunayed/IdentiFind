// src/components/MediaPipeLoader.tsx
'use client';

import Script from 'next/script';

export default function MediaPipeLoader() {
    return (
        <>
            <Script
                src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"
                strategy="afterInteractive"
                onLoad={() => console.log('CameraUtils loaded successfully')}
                onError={() => console.error('Failed to load CameraUtils')}
            />
            <Script
                src="https://cdn.jsdelivr.net/npm/@mediapipe/control_utils/control_utils.js"
                strategy="afterInteractive"
                onLoad={() => console.log('ControlUtils loaded successfully')}
                onError={() => console.error('Failed to load ControlUtils')}
            />
            <Script
                src="https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js"
                strategy="afterInteractive"
                onLoad={() => console.log('DrawingUtils loaded successfully')}
                onError={() => console.error('Failed to load DrawingUtils')}
            />
            <Script
                src="https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/face_detection.js"
                strategy="afterInteractive"
                onLoad={() => console.log('FaceDetection loaded successfully')}
                onError={() => console.error('Failed to load FaceDetection')}
            />
        </>
    );
}