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
    const restPeriodRef = useRef<NodeJS.Timeout | null>(null);
    const faceStableTimeRef = useRef<number | null>(null);

    const [isInitialized, setIsInitialized] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const [detectionResults, setDetectionResults] = useState<FaceDetectionResult[]>([]);
    const [isInRestPeriod, setIsInRestPeriod] = useState(false);
    const [restCountdown, setRestCountdown] = useState<number | null>(null);

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

        // NOW continue with normal detection ONLY if not in rest or capturing
        setDetectionResults(results);

        if (!overlayCanvasRef.current) return;

        const canvas = overlayCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear overlay
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Check if ANY face is ENTIRELY within target region AND facing camera
        const validFacesInRegion = results.filter(detection => {
            const { bbox } = detection;

            // Scale target region to match canvas dimensions
            const scaleX = canvas.width / 640;
            const scaleY = canvas.height / 480;

            const scaledRegion = {
                x: targetRegion.x * scaleX,
                y: targetRegion.y * scaleY,
                width: targetRegion.width * scaleX,
                height: targetRegion.height * scaleY
            };

            // REQUIREMENT 1: ENTIRE face must be within the region
            const faceLeft = bbox.x;
            const faceRight = bbox.x + bbox.width;
            const faceTop = bbox.y;
            const faceBottom = bbox.y + bbox.height;

            const targetLeft = scaledRegion.x;
            const targetRight = scaledRegion.x + scaledRegion.width;
            const targetTop = scaledRegion.y;
            const targetBottom = scaledRegion.y + scaledRegion.height;

            const faceFullyInRegion = (
                faceLeft >= targetLeft &&
                faceRight <= targetRight &&
                faceTop >= targetTop &&
                faceBottom <= targetBottom
            );

            // REQUIREMENT 2: Face must be facing camera
            const isFacingCamera = detection.isFacingCamera;

            // REQUIREMENT 3: Good detection confidence
            const hasGoodDetection = detection.confidence >= config.minDetectionConfidence;

            // REQUIREMENT 4: Face should be reasonable size
            const faceArea = bbox.width * bbox.height;
            const regionArea = scaledRegion.width * scaledRegion.height;
            const sizeRatio = faceArea / regionArea;
            const isGoodSize = sizeRatio >= 0.08 && sizeRatio <= 0.8;

            // REQUIREMENT 5: Face angle constraints
            const isGoodAngle = Math.abs(detection.faceAngle.yaw) <= config.maxYawAngle &&
                Math.abs(detection.faceAngle.pitch) <= config.maxPitchAngle;

            return faceFullyInRegion && isFacingCamera && hasGoodDetection && isGoodSize && isGoodAngle;
        });

        const faceInTargetRegion = validFacesInRegion.length > 0;

        // CHANGE FROM 1000ms TO 3000ms (3 seconds)
        if (faceInTargetRegion && !isCapturing && !isInRestPeriod) {
            // ONLY start new timer if we don't have one already
            if (!faceStableTimeRef.current) {
                console.log('🎯 NEW Perfect alignment detected - starting 3-second countdown!');
                const now = Date.now();
                faceStableTimeRef.current = now;
            } else {
                // CONTINUE with existing timer - DON'T restart
                const elapsed = Date.now() - faceStableTimeRef.current;
                console.log(`⏱️ CONTINUING timer: ${elapsed}ms / 3000ms`);

                if (elapsed >= 3000) { // CHANGED: 3 seconds instead of 1 second
                    console.log('📸 ✅ 3 SECONDS COMPLETE - CAPTURING NOW!');

                    // PREVENT MULTIPLE CAPTURES - Check if already processing
                    if (!isCapturing) {
                        setIsCapturing(true);

                        // IMMEDIATE RESET to prevent multiple triggers
                        faceStableTimeRef.current = null;

                        // Perform capture with debouncing
                        const performSingleCapture = async () => {
                            try {
                                console.log('📸 Starting single capture...');

                                // Check if face detection manager is still available
                                if (!faceDetectionManagerRef.current) {
                                    throw new Error('Face detection manager not available');
                                }

                                // Capture ONLY the target region without overlays
                                const imageData = faceDetectionManagerRef.current.captureTargetRegion(targetRegion);
                                if (imageData) {
                                    console.log('✅ Target region captured successfully - sending to queue');
                                    onImageCaptured(imageData); // This should only be called ONCE
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
                                // Start MANDATORY 5-second rest period
                                console.log('😴 STARTING MANDATORY 5-second rest period...');
                                setIsInRestPeriod(true);
                                setIsCapturing(false);

                                let restTime = 5;
                                setRestCountdown(restTime);

                                // Clear any existing rest timer
                                if (restPeriodRef.current) {
                                    clearInterval(restPeriodRef.current);
                                }

                                restPeriodRef.current = setInterval(() => {
                                    restTime--;
                                    setRestCountdown(restTime);
                                    console.log(`😴 Rest period: ${restTime}s remaining`);

                                    if (restTime <= 0) {
                                        console.log('✅ Rest period finished - ready to detect again');
                                        if (restPeriodRef.current) {
                                            clearInterval(restPeriodRef.current);
                                            restPeriodRef.current = null;
                                        }
                                        setIsInRestPeriod(false);
                                        setRestCountdown(null);
                                        console.log('🎯 Detection system REACTIVATED');
                                    }
                                }, 1000);
                            }
                        };

                        // Execute capture with delay to prevent race conditions
                        setTimeout(performSingleCapture, 100);
                    }
                }
            }
        } else if (!faceInTargetRegion) {
            // ONLY reset if we were tracking and now lost the face
            if (faceStableTimeRef.current && !isCapturing && !isInRestPeriod) {
                console.log('⏳ Face alignment lost - resetting stability timer');
                faceStableTimeRef.current = null;
            }
        }

        // Draw target region with enhanced visual feedback
        drawTargetRegion(canvas, {
            x: targetRegion.x * (canvas.width / 640),
            y: targetRegion.y * (canvas.height / 480),
            width: targetRegion.width * (canvas.width / 640),
            height: targetRegion.height * (canvas.height / 480)
        }, faceInTargetRegion);

        // Calculate progress for display - CHANGED to 3 seconds
        let progress = 0;
        let progressText = '';
        if (faceStableTimeRef.current && faceInTargetRegion && !isCapturing) {
            const elapsed = Date.now() - faceStableTimeRef.current;
            progress = Math.min(elapsed / 3000, 1); // CHANGED: 3000ms instead of 1000ms
            const remaining = Math.max(0, 3000 - elapsed); // CHANGED: 3000ms
            progressText = remaining > 0 ? `${Math.ceil(remaining / 1000)}s` : 'NOW!';
        }

        // Draw instruction text with progress info
        ctx.fillStyle = faceInTargetRegion ? '#00FF00' : '#FFD700';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;

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

        // Draw text with outline for better visibility
        ctx.strokeText(instruction, canvas.width / 2, 35);
        ctx.fillText(instruction, canvas.width / 2, 35);

        // PROGRESS BAR - CHANGED to 3 seconds
        if (faceStableTimeRef.current && faceInTargetRegion && !isCapturing) {
            const barWidth = 300;
            const barHeight = 20;
            const barX = (canvas.width - barWidth) / 2;
            const barY = canvas.height - 120;

            // Progress bar background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(barX - 5, barY - 5, barWidth + 10, barHeight + 10);

            // Progress bar background
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
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            const progressPercent = Math.round(progress * 100);
            ctx.strokeText(`Capturing Progress: ${progressPercent}%`, canvas.width / 2, barY - 10);
            ctx.fillText(`Capturing Progress: ${progressPercent}%`, canvas.width / 2, barY - 10);

            // Animated pulse effect when almost ready
            if (progress > 0.8) {
                const pulse = Math.sin(Date.now() / 100) * 0.3 + 0.7;
                ctx.shadowColor = '#00FF00';
                ctx.shadowBlur = 15 * pulse;
                ctx.strokeRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4);
                ctx.shadowBlur = 0;
            }
        }

        // Enhanced face count and status info
        const validFaces = validFacesInRegion.length;
        const totalFaces = results.length;

        ctx.font = '16px Arial';
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(10, canvas.height - 80, 300, 70);

        ctx.fillStyle = validFaces > 0 ? '#00FF00' : (totalFaces > 0 ? '#FFD700' : '#FF6B6B');
        ctx.fillText(`Faces detected: ${totalFaces}`, 15, canvas.height - 60);
        ctx.fillText(`Perfect alignment: ${validFaces}`, 15, canvas.height - 40);

        if (results.length > 0) {
            const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
            ctx.fillText(`Avg confidence: ${(avgConfidence * 100).toFixed(0)}%`, 15, canvas.height - 20);
        }

        // Debug timer info - CHANGED to show 3000ms target
        if (faceStableTimeRef.current) {
            const elapsed = Date.now() - faceStableTimeRef.current;
            ctx.fillStyle = '#FFFF00';
            ctx.font = '12px Arial';
            ctx.fillText(`Timer: ${elapsed}ms / 3000ms`, 15, canvas.height - 100);
        }

    }, [isInRestPeriod, restCountdown, isCapturing, targetRegion.x, targetRegion.y, targetRegion.width, targetRegion.height, config.minDetectionConfidence, config.maxYawAngle, config.maxPitchAngle, onImageCaptured]);

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
        if (isInRestPeriod) {
            console.log('⏳ Manual capture BLOCKED - in rest period');
            setError(`Manual capture blocked - wait ${restCountdown}s`);
            return;
        }

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

        // IMMEDIATE RESET to prevent auto-capture interference
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

            // Capture ONLY the target region without overlays
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
            // MANDATORY 5-second rest after manual capture too
            console.log('😴 Starting 5-second rest after manual capture...');
            setIsInRestPeriod(true);
            setIsCapturing(false);

            let restTime = 5;
            setRestCountdown(restTime);

            // Clear any existing rest timer
            if (restPeriodRef.current) {
                clearInterval(restPeriodRef.current);
            }

            restPeriodRef.current = setInterval(() => {
                restTime--;
                setRestCountdown(restTime);
                console.log(`😴 Manual capture rest: ${restTime}s remaining`);

                if (restTime <= 0) {
                    console.log('✅ Manual capture rest finished');
                    if (restPeriodRef.current) {
                        clearInterval(restPeriodRef.current);
                        restPeriodRef.current = null;
                    }
                    setIsInRestPeriod(false);
                    setRestCountdown(null);
                }
            }, 1000);
        }
    }, [isCapturing, isInRestPeriod, restCountdown, onImageCaptured, targetRegion]);

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

        // Clear all timers
        if (restPeriodRef.current) {
            clearInterval(restPeriodRef.current);
            restPeriodRef.current = null;
        }

        setIsInitialized(false);
        faceStableTimeRef.current = null;
        setDetectionResults([]);
        setIsInRestPeriod(false);
        setRestCountdown(null);
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
            // Clean up rest period only
            if (restPeriodRef.current) {
                clearInterval(restPeriodRef.current);
            }
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
                    <div className="position-relative d-inline-block">
                        {/* Video element for debugging */}
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className={isInitialized ? "d-none" : "border border-danger"}
                            width={640}
                            height={480}
                            style={{ maxWidth: '100%', height: 'auto' }}
                        />

                        {/* Main canvas for video display */}
                        <canvas
                            ref={canvasRef}
                            width={640}
                            height={480}
                            className="border border-2 border-secondary rounded"
                            style={{
                                maxWidth: '100%',
                                height: 'auto',
                                backgroundColor: '#000',
                                display: isInitialized ? 'block' : 'none'
                            }}
                        />

                        {/* Overlay canvas for UI elements */}
                        <canvas
                            ref={overlayCanvasRef}
                            width={640}
                            height={480}
                            className="position-absolute top-0 start-0"
                            style={{
                                maxWidth: '100%',
                                height: 'auto',
                                pointerEvents: 'none',
                                display: isInitialized ? 'block' : 'none'
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
                        disabled={!isInitialized || isCapturing || isInRestPeriod}
                        size="sm"
                    >
                        <i className="bi bi-camera me-1"></i>
                        {isInRestPeriod
                            ? `Wait ${restCountdown}s`
                            : isCapturing
                                ? 'Capturing...'
                                : 'Manual Capture'
                        }
                    </Button>
                </div>
            </Card.Body>
        </Card>
    );
}