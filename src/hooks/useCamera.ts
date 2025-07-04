// src/hooks/useCamera.ts

import { useState, useEffect, useRef, useCallback } from 'react';
import { CameraStatus } from '@/types';

interface UseCameraOptions {
    width?: number;
    height?: number;
    facingMode?: 'user' | 'environment';
    autoStart?: boolean;
}

interface UseCameraReturn {
    videoRef: React.RefObject<HTMLVideoElement>;
    status: CameraStatus;
    startCamera: () => Promise<void>;
    stopCamera: () => void;
    captureFrame: () => string | null;
    switchCamera: () => Promise<void>;
    requestPermission: () => Promise<boolean>;
}

export function useCamera(options: UseCameraOptions = {}): UseCameraReturn {
    const {
        width = 640,
        height = 480,
        facingMode = 'user',
        autoStart = false,
    } = options;

    const videoRef = useRef<HTMLVideoElement>(null) as React.RefObject<HTMLVideoElement>;
    const streamRef = useRef<MediaStream | null>(null);
    const [currentFacingMode, setCurrentFacingMode] = useState(facingMode);

    const [status, setStatus] = useState<CameraStatus>({
        isOn: false,
        isInitialized: false,
        error: null,
        stream: null,
    });

    const requestPermission = useCallback(async (): Promise<boolean> => {
        try {
            // Check if getUserMedia is supported
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Camera access is not supported by this browser');
            }

            // Request permissions without starting the camera
            const tempStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: currentFacingMode },
            });

            // Stop the temporary stream immediately
            tempStream.getTracks().forEach(track => track.stop());

            return true;
        } catch (error) {
            console.error('Camera permission error:', error);
            setStatus(prev => ({
                ...prev,
                error: getErrorMessage(error),
            }));
            return false;
        }
    }, [currentFacingMode]);

    const startCamera = useCallback(async (): Promise<void> => {
        try {
            setStatus(prev => ({ ...prev, error: null }));

            // Check if already running
            if (streamRef.current) {
                stopCamera();
            }

            // Request camera access
            const constraints: MediaStreamConstraints = {
                video: {
                    width: { ideal: width },
                    height: { ideal: height },
                    facingMode: currentFacingMode,
                },
                audio: false,
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;

                // Wait for video to be ready
                await new Promise<void>((resolve, reject) => {
                    if (!videoRef.current) {
                        reject(new Error('Video element not available'));
                        return;
                    }

                    const video = videoRef.current;

                    const handleLoadedMetadata = () => {
                        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
                        video.removeEventListener('error', handleError);
                        resolve();
                    };

                    const handleError = (event: Event) => {
                        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
                        video.removeEventListener('error', handleError);
                        reject(new Error('Failed to load video'));
                    };

                    video.addEventListener('loadedmetadata', handleLoadedMetadata);
                    video.addEventListener('error', handleError);
                });

                setStatus({
                    isOn: true,
                    isInitialized: true,
                    error: null,
                    stream,
                });
            }
        } catch (error) {
            console.error('Error starting camera:', error);
            const errorMessage = getErrorMessage(error);

            setStatus(prev => ({
                ...prev,
                isOn: false,
                error: errorMessage,
            }));

            // Clean up on error
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
        }
    }, [width, height, currentFacingMode]);

    const stopCamera = useCallback((): void => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }

        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }

        setStatus({
            isOn: false,
            isInitialized: false,
            error: null,
            stream: null,
        });
    }, []);

    const captureFrame = useCallback((): string | null => {
        if (!videoRef.current || !status.isOn) {
            return null;
        }

        try {
            const video = videoRef.current;
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                throw new Error('Canvas context not available');
            }

            canvas.width = video.videoWidth || width;
            canvas.height = video.videoHeight || height;

            // Draw the current video frame to canvas
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Convert to data URL
            return canvas.toDataURL('image/jpeg', 0.8);
        } catch (error) {
            console.error('Error capturing frame:', error);
            return null;
        }
    }, [status.isOn, width, height]);

    const switchCamera = useCallback(async (): Promise<void> => {
        const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';

        // Check if multiple cameras are available
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');

            if (videoDevices.length < 2) {
                throw new Error('Only one camera detected');
            }

            setCurrentFacingMode(newFacingMode);

            if (status.isOn) {
                stopCamera();
                // Small delay to ensure cleanup
                setTimeout(() => {
                    startCamera();
                }, 100);
            }
        } catch (error) {
            console.error('Error switching camera:', error);
            setStatus(prev => ({
                ...prev,
                error: 'Unable to switch camera',
            }));
        }
    }, [currentFacingMode, status.isOn, startCamera, stopCamera]);

    // Auto-start camera if requested
    useEffect(() => {
        if (autoStart) {
            startCamera();
        }

        // Cleanup on unmount
        return () => {
            stopCamera();
        };
    }, [autoStart, startCamera, stopCamera]);

    // Handle visibility change (pause/resume when tab is hidden/visible)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden && status.isOn) {
                // Optionally pause camera when tab is not visible
                // This can help with performance
            } else if (!document.hidden && status.isInitialized && !status.isOn) {
                // Resume camera when tab becomes visible again
                startCamera();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [status.isOn, status.isInitialized, startCamera]);

    return {
        videoRef,
        status,
        startCamera,
        stopCamera,
        captureFrame,
        switchCamera,
        requestPermission,
    };
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        // Handle specific camera errors
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            return 'Camera access denied. Please allow camera permissions and try again.';
        }

        if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            return 'No camera found. Please connect a camera and try again.';
        }

        if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
            return 'Camera is already in use by another application.';
        }

        if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
            return 'Camera does not support the requested settings.';
        }

        if (error.name === 'NotSupportedError') {
            return 'Camera access is not supported by this browser.';
        }

        if (error.name === 'AbortError') {
            return 'Camera access was aborted.';
        }

        return error.message || 'An unknown camera error occurred';
    }

    if (typeof error === 'string') {
        return error;
    }

    return 'An unknown error occurred while accessing the camera';
}