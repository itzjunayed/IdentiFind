// src/components/Camera.tsx

'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { FaceDetectionManager, createTargetRegion, drawTargetRegion } from '@/lib/face-detection';
import { FaceDetectionResult, FaceDetectionConfig } from '@/types';
import { playNotificationSound, resizeImage } from '@/lib/utils';

interface CameraProps {
    onImageCaptured: (imageData: string) => void;
    isActive: boolean;
}

export default function Camera({ onImageCaptured, isActive }: CameraProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const faceDetectionManagerRef = useRef<FaceDetectionManager | null>(null);

    const [isInitialized, setIsInitialized] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [faceInRegion, setFaceInRegion] = useState(false);
    const [faceStableTime, setFaceStableTime] = useState<number | null>(null);

    const config: FaceDetectionConfig = {
        minDetectionConfidence: 0.7,
        stabilityThreshold: 5000, // 5 seconds
        captureDelay: 5000,
    };

    const targetRegion = createTargetRegion(640, 480);

    const initializeCamera = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current || !isActive) return;

        try {
            setError(null);

            // Get user media
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                },
                audio: false,
            });

            videoRef.current.srcObject = stream;

            // Wait for video to load
            await new Promise<void>((resolve) => {
                if (videoRef.current) {
                    videoRef.current.onloadedmetadata = () => resolve();
                }
            });

            // Initialize face detection
            faceDetectionManagerRef.current = new FaceDetectionManager(config);

            await faceDetectionManagerRef.current.initialize(
                videoRef.current,
                canvasRef.current,
                handleFaceDetectionResults
            );

            setIsInitialized(true);
        } catch (err) {
            console.error('Error initializing camera:', err);
            setError('Failed to access camera. Please check permissions.');
        }
    }, [isActive]);

    const handleFaceDetectionResults = useCallback((results: FaceDetectionResult[]) => {
        if (!overlayCanvasRef.current || !faceDetectionManagerRef.current) return;

        const canvas = overlayCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear overlay
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw target region
        drawTargetRegion(canvas, targetRegion, faceInRegion);

        // Check if face is in target region
        const faceInTargetRegion = results.some(detection =>
            faceDetectionManagerRef.current?.isInTargetRegion(detection, targetRegion)
        );

        if (faceInTargetRegion && !isCapturing) {
            if (!faceInRegion) {
                setFaceInRegion(true);
                setFaceStableTime(Date.now());
            }
        } else {
            if (faceInRegion) {
                setFaceInRegion(false);
                setFaceStableTime(null);
                setCountdown(null);
            }
        }

        // Draw instruction text
        ctx.fillStyle = faceInTargetRegion ? '#00FF00' : '#FFD700';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(
            faceInTargetRegion
                ? 'Hold steady...'
                : 'Position your face in the box',
            canvas.width / 2,
            30
        );

        // Draw countdown if applicable
        if (countdown !== null) {
            ctx.fillStyle = '#FF0000';
            ctx.font = 'bold 48px Arial';
            ctx.fillText(
                countdown.toString(),
                canvas.width / 2,
                canvas.height / 2
            );
        }
    }, [faceInRegion, isCapturing, countdown]);

    // Handle face stability and countdown
    useEffect(() => {
        if (!faceInRegion || !faceStableTime || isCapturing) return;

        const interval = setInterval(() => {
            const elapsed = Date.now() - faceStableTime;
            const remaining = Math.ceil((config.stabilityThreshold - elapsed) / 1000);

            if (remaining <= 0) {
                captureImage();
                clearInterval(interval);
            } else {
                setCountdown(remaining);
            }
        }, 100);

        return () => clearInterval(interval);
    }, [faceInRegion, faceStableTime, isCapturing]);

    const captureImage = useCallback(async () => {
        if (!faceDetectionManagerRef.current || !canvasRef.current || isCapturing) return;

        setIsCapturing(true);
        setCountdown(0);

        try {
            // Play capture sound
            playNotificationSound();

            // Capture and resize image
            const imageData = faceDetectionManagerRef.current.captureImage();
            if (imageData) {
                const resizedImageData = resizeImage(canvasRef.current, 800, 600, 0.8);
                onImageCaptured(resizedImageData);
            }

            // Flash effect
            if (overlayCanvasRef.current) {
                const ctx = overlayCanvasRef.current.getContext('2d');
                if (ctx) {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

                    setTimeout(() => {
                        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                    }, 200);
                }
            }

        } catch (error) {
            console.error('Error capturing image:', error);
            setError('Failed to capture image');
        } finally {
            setTimeout(() => {
                setIsCapturing(false);
                setFaceInRegion(false);
                setFaceStableTime(null);
                setCountdown(null);
            }, 1000);
        }
    }, [isCapturing, onImageCaptured]);

    const stopCamera = useCallback(() => {
        if (faceDetectionManagerRef.current) {
            faceDetectionManagerRef.current.stop();
            faceDetectionManagerRef.current = null;
        }

        if (videoRef.current?.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }

        setIsInitialized(false);
        setFaceInRegion(false);
        setFaceStableTime(null);
        setCountdown(null);
    }, []);

    useEffect(() => {
        if (isActive && !isInitialized) {
            initializeCamera();
        } else if (!isActive && isInitialized) {
            stopCamera();
        }

        return () => {
            if (isInitialized) {
                stopCamera();
            }
        };
    }, [isActive, isInitialized, initializeCamera, stopCamera]);

    if (!isActive) {
        return null;
    }

    return (
        <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Live Camera</h2>
                {isInitialized && (
                    <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-sm text-green-600 font-medium">Live</span>
                    </div>
                )}
            </div>

            {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-red-600 text-sm">{error}</p>
                    <button
                        onClick={initializeCamera}
                        className="mt-2 text-sm text-red-700 underline hover:text-red-800"
                    >
                        Try Again
                    </button>
                </div>
            )}

            <div className="relative inline-block">
                {/* Video element (hidden) */}
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="hidden"
                    width={640}
                    height={480}
                />

                {/* Main canvas for video display */}
                <canvas
                    ref={canvasRef}
                    width={640}
                    height={480}
                    className="rounded-lg border-2 border-gray-300"
                />

                {/* Overlay canvas for UI elements */}
                <canvas
                    ref={overlayCanvasRef}
                    width={640}
                    height={480}
                    className="absolute top-0 left-0 pointer-events-none"
                />

                {!isInitialized && !error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-200 rounded-lg">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                            <p className="text-gray-600">Initializing camera...</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Instructions */}
            <div className="mt-4 p-4 bg-blue-50 rounded-md">
                <h3 className="text-sm font-medium text-blue-900 mb-2">Instructions:</h3>
                <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Position your face within the highlighted region</li>
                    <li>• Stay still for 5 seconds to capture your photo</li>
                    <li>• The countdown will appear when you're in position</li>
                    <li>• Multiple people can queue up for processing</li>
                </ul>
            </div>

            {/* Status indicators */}
            <div className="mt-4 flex items-center justify-between text-sm">
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${faceInRegion ? 'bg-green-500' : 'bg-gray-300'
                            }`}></div>
                        <span className="text-gray-600">Face Detected</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${isCapturing ? 'bg-yellow-500' : 'bg-gray-300'
                            }`}></div>
                        <span className="text-gray-600">Capturing</span>
                    </div>
                </div>

                {countdown !== null && countdown > 0 && (
                    <div className="text-blue-600 font-medium">
                        Capturing in {countdown}s...
                    </div>
                )}
            </div>
        </div>
    );
}