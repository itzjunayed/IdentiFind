// src/components/Camera.tsx

'use client';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Card, Alert, Badge, Button } from 'react-bootstrap';
import { FaceDetectionManager, createTargetRegion, drawTargetRegion } from '@/lib/face-detection';
import { FaceDetectionResult, FaceDetectionConfig } from '@/types';

interface CameraProps {
    onImageCaptured: (imageData: string) => void;
    isActive: boolean;
}

// Type for window object with face-api extensions
interface WindowWithFaceApi extends Window {
    faceApiLoaded?: boolean;
}

export default function Camera({ onImageCaptured, isActive }: CameraProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const faceDetectionManagerRef = useRef<FaceDetectionManager | null>(null);
    const faceStableTimeRef = useRef<number | null>(null);

    const [isInitialized, setIsInitialized] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isCapturing, setIsCapturing] = useState(false);

    const config: FaceDetectionConfig = useMemo(() => ({
        minDetectionConfidence: 0.5,
        minFrontalConfidence: 0.6,
        maxYawAngle: 25,
        maxPitchAngle: 20,
        stabilityThreshold: 0, // Not used anymore
        captureDelay: 0, // Not used anymore
    }), []);

    const targetRegion = useMemo(() => createTargetRegion(640, 480), []);

    // Check if face-api.js models are loaded
    const checkModelsLoaded = useCallback(() => {
        return (window as WindowWithFaceApi).faceApiLoaded === true;
    }, []);

    // Handle face detection results with fixed capture and rest logic
    const handleFaceDetectionResults = useCallback((results: FaceDetectionResult[]) => {
        // FORCE BLOCK during capture state
        if (isCapturing) {
            console.log('🚫 BLOCKING - Already capturing');

            if (!overlayCanvasRef.current) return;
            const canvas = overlayCanvasRef.current;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Clear overlay
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Show capturing message
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'center';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            ctx.strokeText('📸 CAPTURING - PLEASE WAIT!', canvas.width / 2, 50);
            ctx.fillText('📸 CAPTURING - PLEASE WAIT!', canvas.width / 2, 50);

            // Show capture animation
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;

            // Pulsing capture effect
            const pulse = Math.sin(Date.now() / 100) * 0.3 + 0.7;
            ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
            ctx.beginPath();
            ctx.arc(centerX, centerY, 80 * pulse, 0, 2 * Math.PI);
            ctx.fill();

            // Capture icon
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 48px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('📸', centerX, centerY);

            return; // STOP ALL PROCESSING during capture
        }

        if (!overlayCanvasRef.current) return;

        const canvas = overlayCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas dimensions
        canvas.width = 640;
        canvas.height = 480;

        // Clear overlay
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Check if face is in target region
        const validFacesInRegion = results.filter(detection => {
            const { bbox } = detection;

            // Use direct coordinates since we're now using consistent canvas dimensions
            const faceLeft = bbox.x;
            const faceRight = bbox.x + bbox.width;
            const faceTop = bbox.y;
            const faceBottom = bbox.y + bbox.height;

            const targetLeft = targetRegion.x;
            const targetRight = targetRegion.x + targetRegion.width;
            const targetTop = targetRegion.y;
            const targetBottom = targetRegion.y + targetRegion.height;

            const faceFullyInRegion = (
                faceLeft >= targetLeft &&
                faceRight <= targetRight &&
                faceTop >= targetTop &&
                faceBottom <= targetBottom
            );

            const isFacingCamera = detection.isFacingCamera;
            const hasGoodDetection = detection.confidence >= config.minDetectionConfidence;

            const faceArea = bbox.width * bbox.height;
            const regionArea = targetRegion.width * targetRegion.height;
            const sizeRatio = faceArea / regionArea;
            const isGoodSize = sizeRatio >= 0.08 && sizeRatio <= 0.8;

            const isGoodAngle = Math.abs(detection.faceAngle.yaw) <= config.maxYawAngle &&
                Math.abs(detection.faceAngle.pitch) <= config.maxPitchAngle;

            return faceFullyInRegion && isFacingCamera && hasGoodDetection && isGoodSize && isGoodAngle;
        });

        const faceInTargetRegion = validFacesInRegion.length > 0;

        // CHANGE FROM 1000ms TO 3000ms (3 seconds)
        if (faceInTargetRegion && !isCapturing) {
            // ONLY start new timer if we don't have one already
            if (!faceStableTimeRef.current) {
                console.log('🎯 NEW Perfect alignment detected - starting 3-second countdown!');
                const now = Date.now();
                faceStableTimeRef.current = now;
            } else {
                // CONTINUE with existing timer - DON'T restart
                const elapsed = Date.now() - faceStableTimeRef.current;
                console.log(`⏱️ CONTINUING timer: ${elapsed}ms / 3000ms`);

                if (elapsed >= 3000) { // 3 seconds complete
                    console.log('📸 ✅ 3 SECONDS COMPLETE - CAPTURING NOW!');

                    if (!isCapturing) {
                        setIsCapturing(true);
                        faceStableTimeRef.current = null;

                        const performSingleCapture = async () => {
                            try {
                                console.log('📸 Starting single capture...');

                                if (!faceDetectionManagerRef.current) {
                                    throw new Error('Face detection manager not available');
                                }

                                const imageData = faceDetectionManagerRef.current.captureTargetRegion(targetRegion);
                                if (imageData) {
                                    console.log('✅ Target region captured successfully - sending to queue');
                                    onImageCaptured(imageData);
                                } else {
                                    throw new Error('Failed to capture target region');
                                }

                                // Flash effect
                                if (overlayCanvasRef.current) {
                                    const flashCtx = overlayCanvasRef.current.getContext('2d');
                                    if (flashCtx) {
                                        flashCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                                        flashCtx.fillRect(0, 0, flashCtx.canvas.width, flashCtx.canvas.height);
                                        setTimeout(() => {
                                            flashCtx.clearRect(0, 0, flashCtx.canvas.width, flashCtx.canvas.height);
                                        }, 300);
                                    }
                                }

                            } catch (error) {
                                console.error('❌ Error capturing image:', error);
                                setError('Failed to capture image');
                            } finally {
                                // Quick reset - no rest period
                                setTimeout(() => {
                                    setIsCapturing(false);
                                    console.log('🎯 Detection system ready again');
                                }, 1000);
                            }
                        };

                        setTimeout(performSingleCapture, 100);
                    }
                }
            }
        } else if (!faceInTargetRegion) {
            // ONLY reset if we were tracking and now lost the face
            if (faceStableTimeRef.current && !isCapturing) {
                console.log('⏳ Face alignment lost - resetting stability timer');
                faceStableTimeRef.current = null;
            }
        }

        // Draw target region
        drawTargetRegion(canvas, targetRegion, faceInTargetRegion);

        // Calculate progress for display
        let progress = 0;
        let progressText = '';
        if (faceStableTimeRef.current && faceInTargetRegion && !isCapturing) {
            const elapsed = Date.now() - faceStableTimeRef.current;
            progress = Math.min(elapsed / 3000, 1);
            const remaining = Math.max(0, 3000 - elapsed);
            progressText = remaining > 0 ? `${Math.ceil(remaining / 1000)}s` : 'NOW!';
        }

        // Draw instruction text with responsive font sizes
        const fontSize = Math.max(14, Math.min(20, canvas.width * 0.03));
        ctx.fillStyle = faceInTargetRegion ? '#00FF00' : '#FFD700';
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;

        let instruction = 'Position your face in the frame & look directly at camera';
        if (results.length === 0) {
            instruction = 'No face detected - move closer to camera';
            ctx.fillStyle = '#FF6B6B';
        } else if (faceInTargetRegion) {
            if (isCapturing) {
                instruction = '📸 CAPTURING!';
                ctx.fillStyle = '#FFFFFF';
            } else if (faceStableTimeRef.current) {
                instruction = `🎯 PERFECT! Capturing in ${progressText}`;
                ctx.fillStyle = progress >= 1 ? '#00FF00' : '#4ECDC4';
            } else {
                instruction = '🎯 PERFECT! Hold still...';
                ctx.fillStyle = '#00FF00';
            }
        } else if (results.length > 0) {
            const firstFace = results[0];
            if (!firstFace.isFacingCamera) {
                instruction = 'Face detected - please look directly at camera';
                ctx.fillStyle = '#FF9F43';
            } else {
                instruction = 'Move your entire face inside the frame';
                ctx.fillStyle = '#6C5CE7';
            }
        }

        // Draw text with outline
        ctx.strokeText(instruction, canvas.width / 2, 30);
        ctx.fillText(instruction, canvas.width / 2, 30);

        // Progress bar
        if (faceStableTimeRef.current && faceInTargetRegion && !isCapturing) {
            const barWidth = Math.min(300, canvas.width * 0.8);
            const barHeight = 16;
            const barX = (canvas.width - barWidth) / 2;
            const barY = canvas.height - 100;

            // Progress bar background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(barX - 3, barY - 3, barWidth + 6, barHeight + 6);

            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fillRect(barX, barY, barWidth, barHeight);

            // Progress bar fill
            const fillWidth = barWidth * progress;
            const gradient = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
            gradient.addColorStop(0, '#FF6B6B');
            gradient.addColorStop(0.5, '#FFE66D');
            gradient.addColorStop(1, '#00FF00');

            ctx.fillStyle = gradient;
            ctx.fillRect(barX, barY, fillWidth, barHeight);

            // Progress text
            ctx.fillStyle = '#FFFFFF';
            ctx.font = `bold ${Math.max(12, fontSize * 0.8)}px Arial`;
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            const progressPercent = Math.round(progress * 100);
            ctx.strokeText(`Capturing Progress: ${progressPercent}%`, canvas.width / 2, barY - 8);
            ctx.fillText(`Capturing Progress: ${progressPercent}%`, canvas.width / 2, barY - 8);
        }

        // Enhanced face info display
        const validFaces = validFacesInRegion.length;
        const totalFaces = results.length;

        const infoFontSize = Math.max(10, Math.min(14, canvas.width * 0.025));
        ctx.font = `${infoFontSize}px Arial`;
        ctx.textAlign = 'left';

        const infoBoxWidth = Math.min(280, canvas.width * 0.8);
        const infoBoxHeight = 60;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(8, canvas.height - infoBoxHeight - 8, infoBoxWidth, infoBoxHeight);

        ctx.fillStyle = validFaces > 0 ? '#00FF00' : (totalFaces > 0 ? '#FFD700' : '#FF6B6B');
        ctx.fillText(`Faces detected: ${totalFaces}`, 15, canvas.height - 45);
        ctx.fillText(`Perfect alignment: ${validFaces}`, 15, canvas.height - 28);

        if (results.length > 0) {
            const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
            ctx.fillText(`Avg confidence: ${(avgConfidence * 100).toFixed(0)}%`, 15, canvas.height - 11);
        }

    }, [isCapturing, targetRegion, config, onImageCaptured]);

    const initializeCamera = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current || !isActive) return;

        try {
            setError(null);
            console.log('🎥 Initializing camera...');

            // Check if face-api.js models are loaded
            if (!checkModelsLoaded()) {
                throw new Error('Face detection models are still loading. Please wait a moment and try again.');
            }

            // Get user media with better constraints
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280, min: 640, max: 1920 },
                    height: { ideal: 720, min: 480, max: 1080 },
                    facingMode: 'user',
                    frameRate: { ideal: 30, min: 15 }
                },
                audio: false,
            });

            const video = videoRef.current;
            video.srcObject = stream;

            // Ensure video plays and wait for metadata
            await new Promise<void>((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(new Error('Video loading timeout'));
                }, 10000);

                video.onloadedmetadata = () => {
                    clearTimeout(timeoutId);
                    console.log('📹 Video metadata loaded');
                    console.log(`📐 Video dimensions: ${video.videoWidth}x${video.videoHeight}`);

                    // Ensure video starts playing
                    video.play().then(() => {
                        console.log('▶️ Video is playing');
                        resolve();
                    }).catch(reject);
                };

                video.onerror = () => {
                    clearTimeout(timeoutId);
                    reject(new Error('Video loading failed'));
                };
            });

            // Wait a bit more to ensure video is fully ready
            await new Promise(resolve => setTimeout(resolve, 500));

            // Initialize face detection
            faceDetectionManagerRef.current = new FaceDetectionManager(config);

            await faceDetectionManagerRef.current.initialize(
                video,
                canvasRef.current,
                handleFaceDetectionResults
            );

            setIsInitialized(true);
            console.log('✅ Camera initialized successfully with face-api.js');
        } catch (err) {
            console.error('❌ Error initializing camera:', err);
            setError(err instanceof Error ? err.message : 'Failed to access camera. Please check permissions and try again.');
        }
    }, [isActive, config, handleFaceDetectionResults, checkModelsLoaded]);

    const captureImage = useCallback(async () => {
        if (!faceDetectionManagerRef.current || !canvasRef.current || isCapturing) {
            if (isCapturing) {
                console.log('⏳ Manual capture BLOCKED - already capturing');
                return;
            }
            if (!faceDetectionManagerRef.current) {
                console.log('❌ Manual capture BLOCKED - face detection manager not available');
                setError('Face detection not ready. Please wait for initialization.');
                return;
            }
            return;
        }

        console.log('📸 Manual capture initiated...');
        setIsCapturing(true);
        faceStableTimeRef.current = null;

        try {
            // Validate video state before capture
            if (!videoRef.current) {
                throw new Error('Video element not available');
            }

            if (videoRef.current.readyState < 2) {
                throw new Error('Video not ready for capture');
            }

            if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
                throw new Error('Video has no dimensions');
            }

            const imageData = faceDetectionManagerRef.current.captureTargetRegion(targetRegion);
            if (!imageData) {
                throw new Error('Failed to capture target region - please try again');
            }

            console.log('✅ Manual capture successful');
            onImageCaptured(imageData);

            // Flash effect
            if (overlayCanvasRef.current) {
                const ctx = overlayCanvasRef.current.getContext('2d');
                if (ctx) {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

                    setTimeout(() => {
                        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                    }, 300);
                }
            }

        } catch (error) {
            console.error('❌ Manual capture failed:', error);
            setError(`Capture failed: ${error instanceof Error ? error.message : 'Unknown error'}`);

            // Show error feedback on overlay
            if (overlayCanvasRef.current) {
                const ctx = overlayCanvasRef.current.getContext('2d');
                if (ctx) {
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 24px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText('CAPTURE FAILED', ctx.canvas.width / 2, ctx.canvas.height / 2);

                    setTimeout(() => {
                        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                    }, 1500);
                }
            }
        } finally {
            // Quick reset - no rest period
            setTimeout(() => {
                setIsCapturing(false);
                console.log('🎯 Manual capture ready again');
            }, 1000);
        }
    }, [isCapturing, onImageCaptured, targetRegion]);

    const stopCamera = useCallback(() => {
        console.log('🛑 Stopping camera');
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
        faceStableTimeRef.current = null;
        setIsCapturing(false);
    }, []);

    useEffect(() => {
        let isMounted = true;

        if (isActive && !isInitialized && isMounted) {
            const timer = setTimeout(() => {
                if (isMounted) {
                    initializeCamera();
                }
            }, 1000);
            return () => clearTimeout(timer);
        } else if (!isActive && isInitialized) {
            stopCamera();
        }

        return () => {
            isMounted = false;
        };
    }, [isActive, isInitialized, initializeCamera, stopCamera]);

    if (!isActive) {
        return null;
    }

    return (
        <Card className="h-100">
            <Card.Header className="bg-primary text-white d-flex justify-content-between align-items-center">
                <h5 className="mb-0">
                    <i className="bi bi-camera-video me-2"></i>
                    Live Camera
                </h5>
                {isInitialized && (
                    <Badge bg="success" className="d-flex align-items-center">
                        <div
                            className="bg-white rounded-circle me-1"
                            style={{ width: '8px', height: '8px', animation: 'pulse 2s infinite' }}
                        ></div>
                        Live
                    </Badge>
                )}
            </Card.Header>

            <Card.Body className="p-3">
                {error && (
                    <Alert variant="danger" className="mb-3" dismissible onClose={() => setError(null)}>
                        <Alert.Heading>
                            <i className="bi bi-exclamation-triangle me-2"></i>
                            Camera Error
                        </Alert.Heading>
                        {error}
                        <hr />
                        <div className="d-flex justify-content-end">
                            <Button
                                onClick={initializeCamera}
                                variant="outline-danger"
                                size="sm"
                            >
                                <i className="bi bi-arrow-clockwise me-1"></i>
                                Try Again
                            </Button>
                        </div>
                    </Alert>
                )}

                <div className="text-center">
                    <div className="position-relative d-inline-block" style={{ width: '100%', maxWidth: '640px' }}>
                        {/* Video element for debugging */}
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className={isInitialized ? "d-none" : "border border-danger"}
                            style={{
                                width: '100%',
                                height: 'auto',
                                aspectRatio: '4/3'
                            }}
                        />

                        {/* Main canvas for video display */}
                        <canvas
                            ref={canvasRef}
                            className="border border-2 border-primary rounded"
                            style={{
                                width: '100%',
                                height: 'auto',
                                backgroundColor: '#000',
                                display: isInitialized ? 'block' : 'none',
                                aspectRatio: '4/3'
                            }}
                        />

                        {/* Overlay canvas for UI elements */}
                        <canvas
                            ref={overlayCanvasRef}
                            className="position-absolute top-0 start-0"
                            style={{
                                width: '100%',
                                height: 'auto',
                                pointerEvents: 'none',
                                display: isInitialized ? 'block' : 'none',
                                aspectRatio: '4/3'
                            }}
                        />

                        {!isInitialized && !error && (
                            <div className="position-absolute top-50 start-50 translate-middle bg-white p-4 rounded shadow">
                                <div className="text-center">
                                    <div className="spinner-border text-primary mb-2" role="status">
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                    <p className="text-muted mb-0">Loading face detection models...</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Capture in Progress Alert */}
                {isCapturing && (
                    <Alert variant="info" className="mt-3 text-center">
                        <h6 className="mb-0">
                            <i className="bi bi-camera me-2"></i>
                            Capture in Progress
                        </h6>
                        <small>Please wait while image is being captured and processed...</small>
                    </Alert>
                )}

                {/* Enhanced Instructions */}
                <Alert variant="info" className="mt-3 mb-3">
                    <Alert.Heading className="h6">
                        <i className="bi bi-info-circle me-2"></i>
                        Instructions
                    </Alert.Heading>
                    <ul className="mb-0">
                        <li><strong>Position your entire face</strong> inside the detection frame</li>
                        <li><strong>Look directly at the camera</strong> - face must be frontal</li>
                        <li><strong>3-second countdown</strong> when perfect alignment is detected</li>
                    </ul>
                </Alert>

                {/* Manual capture button */}
                <div className="text-center mt-3">
                    <Button
                        variant="outline-primary"
                        onClick={captureImage}
                        disabled={!isInitialized || isCapturing}
                        size="sm"
                    >
                        <i className="bi bi-camera me-1"></i>
                        {isCapturing ? 'Capturing...' : 'Manual Capture'}
                    </Button>
                </div>
            </Card.Body>
        </Card>
    );
}