// src/hooks/useFaceDetection.ts

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { FaceDetectionManager, createTargetRegion } from '@/lib/face-detection';
import { FaceDetectionResult, FaceDetectionConfig } from '@/types';

interface UseFaceDetectionOptions {
    canvasWidth?: number;
    canvasHeight?: number;
    minDetectionConfidence?: number;
    stabilityThreshold?: number;
    captureDelay?: number;
    onCapture?: (imageData: string) => void;
}

interface UseFaceDetectionReturn {
    isInitialized: boolean;
    isDetecting: boolean;
    faceDetected: boolean;
    faceStable: boolean;
    countdown: number | null;
    isCapturing: boolean;
    error: string | null;
    detectionResults: FaceDetectionResult[];
    targetRegion: { x: number; y: number; width: number; height: number };
    initialize: (
        videoElement: HTMLVideoElement,
        canvasElement: HTMLCanvasElement,
        overlayCanvas: HTMLCanvasElement
    ) => Promise<void>;
    start: () => void;
    stop: () => void;
    updateConfig: (newConfig: Partial<FaceDetectionConfig>) => void;
    manualCapture: () => void;
}

export function useFaceDetection(options: UseFaceDetectionOptions = {}): UseFaceDetectionReturn {
    const {
        canvasWidth = 640,
        canvasHeight = 480,
        minDetectionConfidence = 0.7,
        stabilityThreshold = 5000, // 5 seconds
        captureDelay = 5000,
        onCapture,
    } = options;

    const managerRef = useRef<FaceDetectionManager | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const stableTimeRef = useRef<number | null>(null);
    const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const captureTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const [isInitialized, setIsInitialized] = useState(false);
    const [isDetecting, setIsDetecting] = useState(false);
    const [faceDetected, setFaceDetected] = useState(false);
    const [faceStable, setFaceStable] = useState(false);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [detectionResults, setDetectionResults] = useState<FaceDetectionResult[]>([]);

    const config: FaceDetectionConfig = useMemo(() => ({
        minDetectionConfidence,
        stabilityThreshold,
        captureDelay,
    }), [minDetectionConfidence, stabilityThreshold, captureDelay]);

    const targetRegion = useMemo(() => createTargetRegion(canvasWidth, canvasHeight), [canvasWidth, canvasHeight]);

    // Start countdown for capture
    const startCountdown = useCallback(() => {
        if (countdownIntervalRef.current) return;

        let count = Math.ceil(captureDelay / 1000);
        setCountdown(count);

        countdownIntervalRef.current = setInterval(() => {
            count--;
            setCountdown(count);

            if (count <= 0) {
                if (countdownIntervalRef.current) {
                    clearInterval(countdownIntervalRef.current);
                    countdownIntervalRef.current = null;
                }
                setCountdown(null);

                // Perform capture
                if (managerRef.current && onCapture && !isCapturing) {
                    setIsCapturing(true);
                    try {
                        const imageData = managerRef.current.captureImage();
                        if (imageData) {
                            onCapture(imageData);

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
                        }
                    } catch (error) {
                        console.error('Error capturing image:', error);
                        setError('Failed to capture image');
                    } finally {
                        // Reset state after capture
                        captureTimeoutRef.current = setTimeout(() => {
                            setIsCapturing(false);
                            setFaceStable(false);
                            stableTimeRef.current = null;
                        }, 1000);
                    }
                }
            }
        }, 1000);
    }, [captureDelay, onCapture, isCapturing]);

    // Stop countdown
    const stopCountdown = useCallback(() => {
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
        }
        setCountdown(null);
    }, []);

    // Update overlay canvas with detection results
    const updateOverlay = useCallback((
        results: FaceDetectionResult[],
        faceInRegion: boolean
    ) => {
        if (!overlayCanvasRef.current) return;

        const canvas = overlayCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw target region
        ctx.strokeStyle = faceInRegion ? '#00FF00' : '#FFD700';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 5]);
        ctx.strokeRect(targetRegion.x, targetRegion.y, targetRegion.width, targetRegion.height);

        // Draw corner indicators
        const cornerSize = 20;
        ctx.setLineDash([]);
        ctx.lineWidth = 4;

        // Corners
        const corners = [
            { x: targetRegion.x, y: targetRegion.y }, // Top-left
            { x: targetRegion.x + targetRegion.width, y: targetRegion.y }, // Top-right
            { x: targetRegion.x, y: targetRegion.y + targetRegion.height }, // Bottom-left
            { x: targetRegion.x + targetRegion.width, y: targetRegion.y + targetRegion.height }, // Bottom-right
        ];

        corners.forEach((corner, index) => {
            ctx.beginPath();
            switch (index) {
                case 0: // Top-left
                    ctx.moveTo(corner.x, corner.y + cornerSize);
                    ctx.lineTo(corner.x, corner.y);
                    ctx.lineTo(corner.x + cornerSize, corner.y);
                    break;
                case 1: // Top-right
                    ctx.moveTo(corner.x - cornerSize, corner.y);
                    ctx.lineTo(corner.x, corner.y);
                    ctx.lineTo(corner.x, corner.y + cornerSize);
                    break;
                case 2: // Bottom-left
                    ctx.moveTo(corner.x, corner.y - cornerSize);
                    ctx.lineTo(corner.x, corner.y);
                    ctx.lineTo(corner.x + cornerSize, corner.y);
                    break;
                case 3: // Bottom-right
                    ctx.moveTo(corner.x - cornerSize, corner.y);
                    ctx.lineTo(corner.x, corner.y);
                    ctx.lineTo(corner.x, corner.y - cornerSize);
                    break;
            }
            ctx.stroke();
        });

        // Draw instruction text
        ctx.fillStyle = faceInRegion ? '#00FF00' : '#FFD700';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(
            faceInRegion
                ? (faceStable ? 'Hold steady...' : 'Getting ready...')
                : 'Position your face in the box',
            canvas.width / 2,
            30
        );

        // Draw countdown
        if (countdown !== null && countdown >= 0) {
            ctx.fillStyle = '#FF0000';
            ctx.font = 'bold 48px Arial';
            ctx.fillText(
                countdown.toString(),
                canvas.width / 2,
                canvas.height / 2
            );
        }

        // Draw face detection boxes
        results.forEach(detection => {
            ctx.strokeStyle = '#00FF00';
            ctx.lineWidth = 2;
            ctx.strokeRect(
                detection.bbox.x,
                detection.bbox.y,
                detection.bbox.width,
                detection.bbox.height
            );

            // Draw confidence
            ctx.fillStyle = '#00FF00';
            ctx.font = '16px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(
                `${(detection.confidence * 100).toFixed(1)}%`,
                detection.bbox.x,
                detection.bbox.y - 5
            );
        });
    }, [targetRegion, countdown, faceStable]);

    // Handle face detection results
    const handleDetectionResults = useCallback((results: FaceDetectionResult[]) => {
        setDetectionResults(results);

        if (!managerRef.current || isCapturing) return;

        // Check if face is in target region
        const faceInRegion = results.some(detection =>
            managerRef.current?.isInTargetRegion(detection, targetRegion)
        );

        setFaceDetected(faceInRegion);

        if (faceInRegion) {
            // Start or continue stability tracking
            if (!stableTimeRef.current) {
                stableTimeRef.current = Date.now();
                setFaceStable(false);
            } else {
                const elapsed = Date.now() - stableTimeRef.current;
                if (elapsed >= stabilityThreshold && !faceStable) {
                    setFaceStable(true);
                    startCountdown();
                }
            }
        } else {
            // Reset stability tracking
            if (stableTimeRef.current) {
                stableTimeRef.current = null;
                setFaceStable(false);
                stopCountdown();
            }
        }

        // Update overlay canvas
        updateOverlay(results, faceInRegion);
    }, [targetRegion, stabilityThreshold, faceStable, isCapturing, startCountdown, stopCountdown, updateOverlay]);

    // Perform image capture
    const performCapture = useCallback(async () => {
        if (!managerRef.current || !onCapture || isCapturing) return;

        setIsCapturing(true);

        try {
            const imageData = managerRef.current.captureImage();
            if (imageData) {
                onCapture(imageData);

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
            }
        } catch (error) {
            console.error('Error capturing image:', error);
            setError('Failed to capture image');
        } finally {
            // Reset state after capture
            captureTimeoutRef.current = setTimeout(() => {
                setIsCapturing(false);
                setFaceStable(false);
                stableTimeRef.current = null;
            }, 1000);
        }
    }, [onCapture, isCapturing]);

    // Initialize face detection
    const initialize = useCallback(async (
        videoElement: HTMLVideoElement,
        canvasElement: HTMLCanvasElement,
        overlayCanvas: HTMLCanvasElement
    ): Promise<void> => {
        try {
            setError(null);

            videoRef.current = videoElement;
            canvasRef.current = canvasElement;
            overlayCanvasRef.current = overlayCanvas;

            managerRef.current = new FaceDetectionManager(config);

            await managerRef.current.initialize(
                videoElement,
                canvasElement,
                handleDetectionResults
            );

            setIsInitialized(true);
        } catch (err) {
            console.error('Error initializing face detection:', err);
            setError('Failed to initialize face detection');
        }
    }, [config, handleDetectionResults]);

    // Start detection
    const start = useCallback(() => {
        if (!managerRef.current || !isInitialized) return;
        setIsDetecting(true);
    }, [isInitialized]);

    // Stop detection
    const stop = useCallback(() => {
        setIsDetecting(false);
        stopCountdown();

        if (managerRef.current) {
            managerRef.current.stop();
        }

        // Reset state
        setFaceDetected(false);
        setFaceStable(false);
        setIsCapturing(false);
        setDetectionResults([]);
        stableTimeRef.current = null;
    }, [stopCountdown]);

    // Update configuration
    const updateConfig = useCallback((newConfig: Partial<FaceDetectionConfig>) => {
        if (managerRef.current) {
            managerRef.current.updateConfig(newConfig);
        }
    }, []);

    // Manual capture
    const manualCapture = useCallback(() => {
        if (!isDetecting || isCapturing) return;
        performCapture();
    }, [isDetecting, isCapturing, performCapture]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stop();
            if (captureTimeoutRef.current) {
                clearTimeout(captureTimeoutRef.current);
                captureTimeoutRef.current = null;
            }
        };
    }, [stop]);

    return {
        isInitialized,
        isDetecting,
        faceDetected,
        faceStable,
        countdown,
        isCapturing,
        error,
        detectionResults,
        targetRegion,
        initialize,
        start,
        stop,
        updateConfig,
        manualCapture,
    };
}