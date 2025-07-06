// src/components/Camera.tsx

'use client';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Card, Alert, Badge, Button, Row, Col, ProgressBar } from 'react-bootstrap';
import { FaceDetectionManager, createTargetRegion, drawTargetRegion } from '@/lib/face-detection';
import { FaceDetectionResult, FaceDetectionConfig } from '@/types';
import { playNotificationSound } from '@/lib/utils';

interface CameraProps {
    onImageCaptured: (imageData: string) => void;
    isActive: boolean;
}

export default function Camera({ onImageCaptured, isActive }: CameraProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const faceDetectionManagerRef = useRef<FaceDetectionManager | null>(null);
    const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const stabilityCheckRef = useRef<NodeJS.Timeout | null>(null);

    const [isInitialized, setIsInitialized] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [faceInRegion, setFaceInRegion] = useState(false);
    const [faceStableTime, setFaceStableTime] = useState<number | null>(null);
    const [detectionResults, setDetectionResults] = useState<FaceDetectionResult[]>([]);
    const [stabilityProgress, setStabilityProgress] = useState(0);

    const config: FaceDetectionConfig = useMemo(() => ({
        minDetectionConfidence: 0.5, // Lower threshold for better detection
        minFrontalConfidence: 0.6, // Face must be facing camera with 60% confidence
        maxYawAngle: 25, // Maximum side-to-side head rotation in degrees
        maxPitchAngle: 20, // Maximum up-down head rotation in degrees
        stabilityThreshold: 2000, // 2 seconds stability (reduced for better UX)
        captureDelay: 2000, // 2 second countdown
    }), []);

    const targetRegion = useMemo(() => createTargetRegion(640, 480), []);

    // Check if face-api.js models are loaded
    const checkModelsLoaded = useCallback(() => {
        return (window as any).faceApiLoaded === true;
    }, []);

    // Start stability check
    const startStabilityCheck = useCallback(() => {
        if (stabilityCheckRef.current) return;

        stabilityCheckRef.current = setInterval(() => {
            if (!faceStableTime || isCapturing) return;

            const elapsed = Date.now() - faceStableTime;
            const progress = Math.min((elapsed / config.stabilityThreshold) * 100, 100);
            setStabilityProgress(progress);

            if (elapsed >= config.stabilityThreshold) {
                console.log('✅ Face stable enough - starting countdown');
                if (stabilityCheckRef.current) {
                    clearInterval(stabilityCheckRef.current);
                    stabilityCheckRef.current = null;
                }
                setStabilityProgress(0);

                // Start countdown
                let count = Math.ceil(config.captureDelay / 1000);
                setCountdown(count);

                countdownIntervalRef.current = setInterval(() => {
                    count--;
                    console.log(`⏰ Countdown: ${count}`);
                    setCountdown(count);

                    if (count <= 0) {
                        console.log('📸 Countdown finished - capturing!');
                        if (countdownIntervalRef.current) {
                            clearInterval(countdownIntervalRef.current);
                            countdownIntervalRef.current = null;
                        }
                        setCountdown(null);

                        // Capture image
                        if (!faceDetectionManagerRef.current || isCapturing) return;

                        console.log('📸 Capturing target region...');
                        setIsCapturing(true);
                        setCountdown(0);

                        try {
                            // Play capture sound
                            playNotificationSound();

                            // Capture ONLY the target region without overlays
                            const imageData = faceDetectionManagerRef.current.captureTargetRegion(targetRegion);
                            if (imageData) {
                                console.log('✅ Target region captured successfully');
                                onImageCaptured(imageData);
                            } else {
                                throw new Error('Failed to capture target region');
                            }

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
                            console.error('❌ Error capturing image:', error);
                            setError('Failed to capture image');
                        } finally {
                            setTimeout(() => {
                                console.log('🔄 Resetting capture state');
                                setIsCapturing(false);
                                setFaceInRegion(false);
                                setFaceStableTime(null);
                                setCountdown(null);
                                setStabilityProgress(0);
                            }, 1000);
                        }
                    }
                }, 1000);
            }
        }, 100); // Check more frequently for smoother progress
    }, [faceStableTime, isCapturing, config.stabilityThreshold, config.captureDelay, targetRegion, onImageCaptured]);

    // Stop stability check
    const stopStabilityCheck = useCallback(() => {
        if (stabilityCheckRef.current) {
            clearInterval(stabilityCheckRef.current);
            stabilityCheckRef.current = null;
        }
        setStabilityProgress(0);
    }, []);

    // Stop countdown
    const stopCountdown = useCallback(() => {
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
        }
        setCountdown(null);
    }, []);

    const handleFaceDetectionResults = useCallback((results: FaceDetectionResult[]) => {
        setDetectionResults(results);

        if (!overlayCanvasRef.current || !faceDetectionManagerRef.current || isCapturing) return;

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

            // REQUIREMENT 2: Face must be facing camera (improved detection)
            const isFacingCamera = detection.isFacingCamera;

            // REQUIREMENT 3: Good detection confidence
            const hasGoodDetection = detection.confidence >= config.minDetectionConfidence;

            // REQUIREMENT 4: Face should be reasonable size (not too tiny or huge)
            const faceArea = bbox.width * bbox.height;
            const regionArea = scaledRegion.width * scaledRegion.height;
            const sizeRatio = faceArea / regionArea;
            const isGoodSize = sizeRatio >= 0.08 && sizeRatio <= 0.8; // 8% to 80% of region

            // REQUIREMENT 5: Face angle constraints
            const isGoodAngle = Math.abs(detection.faceAngle.yaw) <= config.maxYawAngle &&
                Math.abs(detection.faceAngle.pitch) <= config.maxPitchAngle;

            return faceFullyInRegion && isFacingCamera && hasGoodDetection && isGoodSize && isGoodAngle;
        });

        const faceInTargetRegion = validFacesInRegion.length > 0;

        console.log('🎯 Enhanced Face Detection:', {
            totalFaces: results.length,
            facingCamera: results.filter(r => r.isFacingCamera).length,
            validInRegion: validFacesInRegion.length,
            confidences: results.map(r => `${(r.confidence * 100).toFixed(0)}%`),
            angles: results.map(r => `Y:${r.faceAngle.yaw.toFixed(1)}° P:${r.faceAngle.pitch.toFixed(1)}°`),
            READY_TO_CAPTURE: faceInTargetRegion ? '🎯 YES! PERFECT!' : '⏳ Waiting for perfect alignment...'
        });

        // Update face detection state
        if (faceInTargetRegion && !isCapturing) {
            if (!faceInRegion) {
                console.log('🎯 Perfect face detected - starting stability timer');
                setFaceInRegion(true);
                setFaceStableTime(Date.now());
                setStabilityProgress(0);
                startStabilityCheck();
            }
        } else {
            if (faceInRegion) {
                console.log('⏳ Face alignment lost - resetting timer');
                setFaceInRegion(false);
                setFaceStableTime(null);
                setCountdown(null);
                setStabilityProgress(0);
                stopCountdown();
                stopStabilityCheck();
            }
        }

        // Draw target region with enhanced visual feedback
        drawTargetRegion(canvas, {
            x: targetRegion.x * (canvas.width / 640),
            y: targetRegion.y * (canvas.height / 480),
            width: targetRegion.width * (canvas.width / 640),
            height: targetRegion.height * (canvas.height / 480)
        }, faceInTargetRegion);

        // Draw instruction text with better feedback
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
            if (faceStableTime) {
                const elapsed = Date.now() - faceStableTime;
                if (elapsed < config.stabilityThreshold) {
                    instruction = `Perfect! Hold still... ${Math.ceil((config.stabilityThreshold - elapsed) / 1000)}s`;
                    ctx.fillStyle = '#4ECDC4';
                } else {
                    instruction = 'Excellent! Capturing soon...';
                    ctx.fillStyle = '#00FF00';
                }
            } else {
                instruction = 'Great alignment! Stay still...';
                ctx.fillStyle = '#FFE66D';
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

        // Draw animated countdown with enhanced visuals
        if (countdown !== null && countdown > 0) {
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const radius = 60;

            // Animated background circle
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius + 15, 0, 2 * Math.PI);
            ctx.fill();

            // Progress circle with animation
            const progress = (Date.now() % 1000) / 1000;
            const gradientColors = ['#FF6B6B', '#FFE66D', '#4ECDC4'];
            const colorIndex = Math.min(countdown - 1, gradientColors.length - 1);

            ctx.strokeStyle = gradientColors[colorIndex] || '#FF6B6B';
            ctx.lineWidth = 8;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + (2 * Math.PI * progress));
            ctx.stroke();

            // Countdown number with dynamic scaling
            const scale = 1 + Math.sin(progress * Math.PI * 4) * 0.15;
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.scale(scale, scale);

            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 54px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 4;
            ctx.strokeText(countdown.toString(), 0, 0);
            ctx.fillText(countdown.toString(), 0, 0);

            ctx.restore();
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

        // Draw stability progress bar
        if (faceInRegion && stabilityProgress > 0) {
            const barWidth = 250;
            const barHeight = 8;
            const barX = (canvas.width - barWidth) / 2;
            const barY = canvas.height - 100;

            // Background
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fillRect(barX, barY, barWidth, barHeight);

            // Progress with gradient
            const gradient = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
            gradient.addColorStop(0, '#FF6B6B');
            gradient.addColorStop(0.5, '#FFE66D');
            gradient.addColorStop(1, '#00FF00');

            ctx.fillStyle = gradient;
            ctx.fillRect(barX, barY, barWidth * (stabilityProgress / 100), barHeight);

            // Progress text
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.strokeText(`Stability: ${stabilityProgress.toFixed(0)}%`, canvas.width / 2, barY - 8);
            ctx.fillText(`Stability: ${stabilityProgress.toFixed(0)}%`, canvas.width / 2, barY - 8);
        }
    }, [faceInRegion, isCapturing, countdown, faceStableTime, targetRegion, config, stabilityProgress, startStabilityCheck, stopCountdown, stopStabilityCheck]);

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
        if (!faceDetectionManagerRef.current || !canvasRef.current || isCapturing) return;

        console.log('📸 Manual capture initiated...');
        setIsCapturing(true);
        setCountdown(0);

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

            // Play capture sound
            playNotificationSound();

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
            setTimeout(() => {
                console.log('🔄 Resetting capture state');
                setIsCapturing(false);
                setFaceInRegion(false);
                setFaceStableTime(null);
                setCountdown(null);
                setStabilityProgress(0);
                stopCountdown();
                stopStabilityCheck();
            }, 1000);
        }
    }, [isCapturing, onImageCaptured, targetRegion, stopCountdown, stopStabilityCheck]);

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

        stopCountdown();
        stopStabilityCheck();
        setIsInitialized(false);
        setFaceInRegion(false);
        setFaceStableTime(null);
        setCountdown(null);
        setStabilityProgress(0);
        setDetectionResults([]);
    }, [stopCountdown, stopStabilityCheck]);

    useEffect(() => {
        let isMounted = true;

        if (isActive && !isInitialized && isMounted) {
            // Small delay to ensure face-api.js models are loaded
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
            if (isInitialized) {
                stopCamera();
            }
        };
    }, [isActive]); // Only depend on isActive, not isInitialized to prevent loops

    if (!isActive) {
        return null;
    }

    const facingCameraFaces = detectionResults.filter(r => r.isFacingCamera).length;
    const bestConfidence = detectionResults.length > 0
        ? Math.max(...detectionResults.map(r => r.confidence))
        : 0;

    return (
        <Card className="h-100">
            <Card.Header className="bg-primary text-white d-flex justify-content-between align-items-center">
                <h5 className="mb-0">
                    <i className="bi bi-camera-video me-2"></i>
                    Enhanced Live Camera (face-api.js)
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
                        {/* Video element for debugging - make it visible temporarily */}
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className={isInitialized ? "d-none" : "border border-danger"} // Show video until canvas works
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
                                backgroundColor: '#000', // Black background for debugging
                                display: isInitialized ? 'block' : 'none' // Only show when initialized
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

                {/* Stability Progress */}
                {faceInRegion && stabilityProgress > 0 && (
                    <div className="mt-3">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                            <small className="text-muted">Perfect alignment - hold still:</small>
                            <small className="text-primary">{stabilityProgress.toFixed(0)}%</small>
                        </div>
                        <ProgressBar
                            now={stabilityProgress}
                            variant={stabilityProgress >= 100 ? "success" : "primary"}
                            style={{ height: '8px' }}
                            animated
                        />
                    </div>
                )}

                {/* Enhanced Instructions */}
                <Alert variant="info" className="mt-3 mb-3">
                    <Alert.Heading className="h6">
                        <i className="bi bi-info-circle me-2"></i>
                        Enhanced Face Detection Instructions
                    </Alert.Heading>
                    <ul className="mb-0">
                        <li><strong>Position your entire face</strong> inside the detection frame</li>
                        <li><strong>Look directly at the camera</strong> - face must be frontal (±25° rotation)</li>
                        <li><strong>Stay still for 2 seconds</strong> when perfectly aligned</li>
                        <li><strong>Works at any distance</strong> - near or far from camera</li>
                        <li><strong>Auto-capture</strong> when perfect alignment is detected</li>
                        <li><strong>Real-time feedback</strong> shows detection status and angles</li>
                    </ul>
                </Alert>

                {/* Enhanced Status indicators */}
                <Row className="g-3">
                    <Col sm={6} md={3}>
                        <div className="d-flex align-items-center">
                            <Badge
                                bg={detectionResults.length > 0 ? "success" : "secondary"}
                                className="me-2"
                            >
                                <i className={`bi bi-${detectionResults.length > 0 ? 'person-check' : 'person'}`}></i>
                            </Badge>
                            <small className="text-muted">
                                Faces: {detectionResults.length}
                            </small>
                        </div>
                    </Col>
                    <Col sm={6} md={3}>
                        <div className="d-flex align-items-center">
                            <Badge
                                bg={facingCameraFaces > 0 ? "success" : "secondary"}
                                className="me-2"
                            >
                                <i className={`bi bi-${facingCameraFaces > 0 ? 'eye-fill' : 'eye'}`}></i>
                            </Badge>
                            <small className="text-muted">
                                Frontal: {facingCameraFaces}
                            </small>
                        </div>
                    </Col>
                    <Col sm={6} md={3}>
                        <div className="d-flex align-items-center">
                            <Badge
                                bg={bestConfidence >= config.minDetectionConfidence ? "success" : "warning"}
                                className="me-2"
                            >
                                <i className="bi bi-speedometer2"></i>
                            </Badge>
                            <small className="text-muted">
                                Quality: {(bestConfidence * 100).toFixed(0)}%
                            </small>
                        </div>
                    </Col>
                    <Col sm={6} md={3}>
                        <div className="d-flex align-items-center">
                            <Badge
                                bg={faceInRegion ? "success" : "secondary"}
                                className="me-2"
                            >
                                <i className={`bi bi-${faceInRegion ? 'bullseye' : 'geo-alt'}`}></i>
                            </Badge>
                            <small className="text-muted">Perfect Alignment</small>
                        </div>
                    </Col>
                    <Col sm={6} md={3}>
                        <div className="d-flex align-items-center">
                            <Badge
                                bg={isCapturing ? "warning" : "secondary"}
                                className="me-2"
                            >
                                <i className={`bi bi-${isCapturing ? 'camera' : 'circle'}`}></i>
                            </Badge>
                            <small className="text-muted">
                                {isCapturing ? 'Capturing' : 'Ready'}
                            </small>
                        </div>
                    </Col>
                    <Col sm={6} md={3}>
                        <div className="d-flex align-items-center">
                            <Badge
                                bg={(window as any).faceApiLoaded ? "success" : "warning"}
                                className="me-2"
                            >
                                <i className="bi bi-cpu"></i>
                            </Badge>
                            <small className="text-muted">
                                AI Models: {(window as any).faceApiLoaded ? 'Loaded' : 'Loading'}
                            </small>
                        </div>
                    </Col>
                </Row>

                {/* Countdown display */}
                {countdown !== null && countdown > 0 && (
                    <Alert variant="success" className="mt-3 text-center">
                        <h4 className="mb-0">
                            <i className="bi bi-camera me-2"></i>
                            Perfect! Capturing in {countdown} second{countdown !== 1 ? 's' : ''}...
                        </h4>
                    </Alert>
                )}

                {/* Manual capture button */}
                <div className="text-center mt-3">
                    <Button
                        variant="outline-primary"
                        onClick={captureImage}
                        disabled={!isInitialized || isCapturing}
                        size="sm"
                    >
                        <i className="bi bi-camera me-1"></i>
                        Manual Capture
                        {!faceInRegion && ' (Auto-capture when aligned)'}
                    </Button>
                </div>
            </Card.Body>
        </Card>
    );
}