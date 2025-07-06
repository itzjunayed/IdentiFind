// src/lib/face-detection.ts
import { FaceDetectionResult, FaceDetectionConfig } from '@/types';

// Dynamic import type for face-api.js
type FaceAPI = typeof import('face-api.js');

export class FaceDetectionManager {
    private config: FaceDetectionConfig;
    private onResultsCallback?: (results: FaceDetectionResult[]) => void;
    private canvasElement: HTMLCanvasElement | null = null;
    private videoElement: HTMLVideoElement | null = null;
    private isInitialized: boolean = false;
    private detectionCanvas: HTMLCanvasElement;
    private animationFrameId: number | null = null;
    private isDetecting: boolean = false;
    private faceapi: FaceAPI | null = null;

    constructor(config: FaceDetectionConfig) {
        this.config = config;
        this.detectionCanvas = document.createElement('canvas');
        this.detectionCanvas.width = 640;
        this.detectionCanvas.height = 480;
    }

    async initialize(
        videoElement: HTMLVideoElement,
        canvasElement: HTMLCanvasElement,
        onResults: (results: FaceDetectionResult[]) => void
    ): Promise<void> {
        this.videoElement = videoElement;
        this.canvasElement = canvasElement;
        this.onResultsCallback = onResults;

        try {
            console.log('[FaceDetection] Starting face-api.js detection...');

            // Dynamic import face-api.js to avoid SSR issues
            this.faceapi = await import('face-api.js');

            // Check if face-api.js models are loaded
            if (!(window as any).faceApiLoaded) {
                throw new Error('Face detection models not loaded. Please wait for models to load.');
            }

            // Ensure video is playing
            if (this.videoElement.paused) {
                await this.videoElement.play();
            }

            // Wait for video to have proper dimensions
            await this.waitForVideo();

            // Start detection loop
            this.isDetecting = true;
            this.detectFaces();
            this.isInitialized = true;

            console.log('[FaceDetection] Face detection ready!');

        } catch (error) {
            console.error('[FaceDetection] Initialization failed:', error);
            throw new Error(`Face detection failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async waitForVideo(): Promise<void> {
        return new Promise((resolve) => {
            if (this.videoElement && this.videoElement.videoWidth > 0 && this.videoElement.videoHeight > 0) {
                resolve();
            } else {
                const checkVideo = () => {
                    if (this.videoElement && this.videoElement.videoWidth > 0 && this.videoElement.videoHeight > 0) {
                        resolve();
                    } else {
                        setTimeout(checkVideo, 100);
                    }
                };
                checkVideo();
            }
        });
    }

    private async detectFaces(): Promise<void> {
        if (!this.isDetecting || !this.videoElement || !this.canvasElement || !this.onResultsCallback || !this.faceapi) {
            return;
        }

        try {
            // Ensure video is ready and playing
            if (this.videoElement.readyState < 2 || this.videoElement.paused) {
                console.log('[FaceDetection] Video not ready, readyState:', this.videoElement.readyState, 'paused:', this.videoElement.paused);
                this.animationFrameId = requestAnimationFrame(() => this.detectFaces());
                return;
            }

            // Get video dimensions
            const videoWidth = this.videoElement.videoWidth;
            const videoHeight = this.videoElement.videoHeight;

            if (videoWidth === 0 || videoHeight === 0) {
                console.log('[FaceDetection] Waiting for video dimensions...', videoWidth, 'x', videoHeight);
                this.animationFrameId = requestAnimationFrame(() => this.detectFaces());
                return;
            }

            // Get canvas contexts
            const canvasCtx = this.canvasElement.getContext('2d');
            const detectionCtx = this.detectionCanvas.getContext('2d');

            if (!canvasCtx || !detectionCtx) {
                console.log('[FaceDetection] Canvas context not available');
                this.animationFrameId = requestAnimationFrame(() => this.detectFaces());
                return;
            }

            // Update canvas sizes to match video
            this.canvasElement.width = videoWidth;
            this.canvasElement.height = videoHeight;
            this.detectionCanvas.width = videoWidth;
            this.detectionCanvas.height = videoHeight;

            // Clear both canvases
            canvasCtx.clearRect(0, 0, videoWidth, videoHeight);
            detectionCtx.clearRect(0, 0, videoWidth, videoHeight);

            // Draw video frame to both canvases
            canvasCtx.drawImage(this.videoElement, 0, 0, videoWidth, videoHeight);
            detectionCtx.drawImage(this.videoElement, 0, 0, videoWidth, videoHeight);


            // Detect faces with landmarks
            const detections = await this.faceapi
                .detectAllFaces(this.videoElement, new this.faceapi.TinyFaceDetectorOptions({
                    inputSize: 416,
                    scoreThreshold: this.config.minDetectionConfidence
                }))
                .withFaceLandmarks()
                .withFaceExpressions();

            // Process detection results
            const results: FaceDetectionResult[] = [];

            for (const detection of detections) {
                const box = detection.detection.box;
                const landmarks = detection.landmarks;
                const confidence = detection.detection.score;

                // Calculate face orientation using landmarks
                const faceOrientation = this.calculateFaceOrientation(landmarks);
                const isFacingCamera = this.isFacingCamera(faceOrientation, confidence);

                const result: FaceDetectionResult = {
                    confidence,
                    isFacingCamera,
                    faceAngle: {
                        yaw: faceOrientation.yaw,
                        pitch: faceOrientation.pitch,
                        roll: faceOrientation.roll
                    },
                    frontalConfidence: isFacingCamera ? confidence : confidence * 0.3,
                    bbox: {
                        x: box.x,
                        y: box.y,
                        width: box.width,
                        height: box.height,
                    }
                };

                results.push(result);

                // Draw detection box on canvas (over the video)
                const boxColor = result.isFacingCamera ? '#00FF00' : '#FFD700';
                canvasCtx.strokeStyle = boxColor;
                canvasCtx.lineWidth = 3;
                canvasCtx.strokeRect(box.x, box.y, box.width, box.height);

                // Draw confidence and orientation info
                canvasCtx.fillStyle = boxColor;
                canvasCtx.font = 'bold 14px Arial';
                canvasCtx.shadowColor = 'black';
                canvasCtx.shadowBlur = 2;
                canvasCtx.fillText(
                    `${result.isFacingCamera ? '✓ Frontal' : '⚠ Turn to camera'} ${(confidence * 100).toFixed(0)}%`,
                    box.x,
                    box.y - 8
                );

                // Draw angle info
                canvasCtx.font = '12px Arial';
                canvasCtx.fillText(
                    `Yaw: ${faceOrientation.yaw.toFixed(1)}° Pitch: ${faceOrientation.pitch.toFixed(1)}°`,
                    box.x,
                    box.y + box.height + 15
                );

                // Reset shadow
                canvasCtx.shadowBlur = 0;
            }

            // Log detection info every 30 frames (about once per second at 30fps)
            if (Math.random() < 0.033) {
                console.log(`[FaceDetection] Video: ${videoWidth}x${videoHeight}, Faces: ${results.length}, Canvas: ${this.canvasElement.width}x${this.canvasElement.height}`);
            }

            // Call results callback
            this.onResultsCallback(results);

        } catch (error) {
            console.error('[FaceDetection] Detection error:', error);
            // Continue even if detection fails, so video keeps showing
        }

        // Continue detection loop
        if (this.isDetecting) {
            this.animationFrameId = requestAnimationFrame(() => this.detectFaces());
        }
    }

    private calculateFaceOrientation(landmarks: any): { yaw: number; pitch: number; roll: number } {
        // Get key facial landmarks
        const nose = landmarks.getNose();
        const leftEye = landmarks.getLeftEye();
        const rightEye = landmarks.getRightEye();
        const mouth = landmarks.getMouth();

        // Nose tip and nose bridge points
        const noseTip = nose[4]; // Bottom of nose
        const noseBridge = nose[1]; // Top of nose bridge

        // Eye centers
        const leftEyeCenter = this.getEyeCenter(leftEye);
        const rightEyeCenter = this.getEyeCenter(rightEye);

        // Mouth corners
        const leftMouth = mouth[0];
        const rightMouth = mouth[6];

        // Calculate yaw (left-right rotation)
        const eyeDistance = Math.abs(rightEyeCenter.x - leftEyeCenter.x);
        const noseCenterX = (leftEyeCenter.x + rightEyeCenter.x) / 2;
        const noseOffsetX = noseTip.x - noseCenterX;
        let yaw = (noseOffsetX / eyeDistance) * 60; // Scale to degrees
        yaw = Math.max(-45, Math.min(45, yaw)); // Clamp to reasonable range

        // Calculate pitch (up-down rotation)
        const eyeCenterY = (leftEyeCenter.y + rightEyeCenter.y) / 2;
        const noseToEyeDistance = Math.abs(noseTip.y - eyeCenterY);
        const expectedNoseDistance = eyeDistance * 0.8; // Expected ratio
        let pitch = ((noseToEyeDistance - expectedNoseDistance) / expectedNoseDistance) * 30;
        pitch = Math.max(-30, Math.min(30, pitch)); // Clamp to reasonable range

        // Calculate roll (tilt rotation)
        const eyeYDiff = rightEyeCenter.y - leftEyeCenter.y;
        let roll = Math.atan2(eyeYDiff, eyeDistance) * (180 / Math.PI);
        roll = Math.max(-25, Math.min(25, roll)); // Clamp to reasonable range

        return { yaw, pitch, roll };
    }

    private getEyeCenter(eyePoints: any[]): { x: number; y: number } {
        const x = eyePoints.reduce((sum, point) => sum + point.x, 0) / eyePoints.length;
        const y = eyePoints.reduce((sum, point) => sum + point.y, 0) / eyePoints.length;
        return { x, y };
    }

    private isFacingCamera(orientation: { yaw: number; pitch: number; roll: number }, confidence: number): boolean {
        // Check if face is facing the camera based on angles and confidence
        const isYawOk = Math.abs(orientation.yaw) <= this.config.maxYawAngle;
        const isPitchOk = Math.abs(orientation.pitch) <= this.config.maxPitchAngle;
        const isConfidenceOk = confidence >= this.config.minFrontalConfidence;

        return isYawOk && isPitchOk && isConfidenceOk;
    }

    stop(): void {
        this.isDetecting = false;
        this.isInitialized = false;

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    updateConfig(newConfig: Partial<FaceDetectionConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    captureTargetRegion(targetRegion: { x: number; y: number; width: number; height: number }): string | null {
        if (!this.videoElement) {
            console.error('❌ Capture failed: Video element not available');
            return null;
        }

        try {
            // Ensure video is playing and has valid dimensions
            if (this.videoElement.videoWidth === 0 || this.videoElement.videoHeight === 0) {
                console.error('❌ Capture failed: Video has no dimensions');
                return null;
            }

            if (this.videoElement.readyState < 2) {
                console.error('❌ Capture failed: Video not ready');
                return null;
            }

            // Update detection canvas with current video frame first
            const detectionCtx = this.detectionCanvas.getContext('2d');
            if (!detectionCtx) {
                console.error('❌ Capture failed: Cannot get detection canvas context');
                return null;
            }

            // Ensure canvas matches video dimensions
            this.detectionCanvas.width = this.videoElement.videoWidth;
            this.detectionCanvas.height = this.videoElement.videoHeight;

            // Draw current video frame to detection canvas
            detectionCtx.clearRect(0, 0, this.detectionCanvas.width, this.detectionCanvas.height);
            detectionCtx.drawImage(
                this.videoElement,
                0, 0, this.detectionCanvas.width, this.detectionCanvas.height
            );

            // Scale target region to match actual video dimensions
            const scaleX = this.detectionCanvas.width / 640;
            const scaleY = this.detectionCanvas.height / 480;

            const scaledRegion = {
                x: targetRegion.x * scaleX,
                y: targetRegion.y * scaleY,
                width: targetRegion.width * scaleX,
                height: targetRegion.height * scaleY
            };

            // Create a new canvas for the cropped region
            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = scaledRegion.width;
            cropCanvas.height = scaledRegion.height;
            const cropCtx = cropCanvas.getContext('2d');

            if (!cropCtx) {
                console.error('❌ Capture failed: Cannot get crop canvas context');
                return null;
            }

            // Validate target region bounds
            if (scaledRegion.x < 0 || scaledRegion.y < 0 ||
                scaledRegion.x + scaledRegion.width > this.detectionCanvas.width ||
                scaledRegion.y + scaledRegion.height > this.detectionCanvas.height) {
                console.error('❌ Capture failed: Target region out of bounds');
                return null;
            }

            // Draw only the target region from the clean detection canvas (no overlays)
            cropCtx.drawImage(
                this.detectionCanvas,
                scaledRegion.x, scaledRegion.y, scaledRegion.width, scaledRegion.height, // source
                0, 0, scaledRegion.width, scaledRegion.height // destination
            );

            const dataURL = cropCanvas.toDataURL('image/jpeg', 0.9);

            if (!dataURL || dataURL === 'data:,') {
                console.error('❌ Capture failed: Empty data URL generated');
                return null;
            }

            console.log('✅ Target region captured successfully');
            return dataURL;

        } catch (error) {
            console.error('❌ Error capturing target region:', error);
            return null;
        }
    }

    captureImage(): string | null {
        if (!this.videoElement) {
            console.error('❌ Capture failed: Video element not available');
            return null;
        }

        try {
            // Ensure video is playing and has valid dimensions
            if (this.videoElement.videoWidth === 0 || this.videoElement.videoHeight === 0) {
                console.error('❌ Capture failed: Video has no dimensions');
                return null;
            }

            if (this.videoElement.readyState < 2) {
                console.error('❌ Capture failed: Video not ready');
                return null;
            }

            // Update detection canvas with current video frame
            const detectionCtx = this.detectionCanvas.getContext('2d');
            if (!detectionCtx) {
                console.error('❌ Capture failed: Cannot get detection canvas context');
                return null;
            }

            this.detectionCanvas.width = this.videoElement.videoWidth;
            this.detectionCanvas.height = this.videoElement.videoHeight;

            detectionCtx.clearRect(0, 0, this.detectionCanvas.width, this.detectionCanvas.height);
            detectionCtx.drawImage(
                this.videoElement,
                0, 0, this.detectionCanvas.width, this.detectionCanvas.height
            );

            const dataURL = this.detectionCanvas.toDataURL('image/jpeg', 0.8);

            if (!dataURL || dataURL === 'data:,') {
                console.error('❌ Capture failed: Empty data URL generated');
                return null;
            }

            console.log('✅ Full image captured successfully');
            return dataURL;

        } catch (error) {
            console.error('❌ Error capturing image:', error);
            return null;
        }
    }
}

export const createTargetRegion = (
    canvasWidth: number,
    canvasHeight: number
) => {
    const regionWidth = canvasWidth * 0.4; // Slightly larger for better detection
    const regionHeight = canvasHeight * 0.5;
    return {
        x: (canvasWidth - regionWidth) / 2,
        y: (canvasHeight - regionHeight) / 2,
        width: regionWidth,
        height: regionHeight
    };
};

export const drawTargetRegion = (
    canvas: HTMLCanvasElement,
    region: { x: number; y: number; width: number; height: number },
    isActive: boolean = false
) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw main rectangle with rounded corners
    ctx.strokeStyle = isActive ? '#00FF00' : '#FFD700';
    ctx.lineWidth = 3;
    ctx.setLineDash([15, 8]);

    // Draw rounded rectangle
    const radius = 20;
    ctx.beginPath();
    ctx.moveTo(region.x + radius, region.y);
    ctx.lineTo(region.x + region.width - radius, region.y);
    ctx.quadraticCurveTo(region.x + region.width, region.y, region.x + region.width, region.y + radius);
    ctx.lineTo(region.x + region.width, region.y + region.height - radius);
    ctx.quadraticCurveTo(region.x + region.width, region.y + region.height, region.x + region.width - radius, region.y + region.height);
    ctx.lineTo(region.x + radius, region.y + region.height);
    ctx.quadraticCurveTo(region.x, region.y + region.height, region.x, region.y + region.height - radius);
    ctx.lineTo(region.x, region.y + radius);
    ctx.quadraticCurveTo(region.x, region.y, region.x + radius, region.y);
    ctx.closePath();
    ctx.stroke();

    // Draw corner indicators
    const cornerSize = 25;
    ctx.setLineDash([]);
    ctx.lineWidth = 5;
    ctx.strokeStyle = isActive ? '#00FF00' : '#FFD700';

    const corners = [
        { x: region.x, y: region.y, lines: [[0, cornerSize], [cornerSize, 0]] },
        { x: region.x + region.width, y: region.y, lines: [[-cornerSize, 0], [0, cornerSize]] },
        { x: region.x, y: region.y + region.height, lines: [[0, -cornerSize], [cornerSize, 0]] },
        { x: region.x + region.width, y: region.y + region.height, lines: [[-cornerSize, 0], [0, -cornerSize]] }
    ];

    corners.forEach(corner => {
        ctx.beginPath();
        ctx.moveTo(corner.x, corner.y);
        corner.lines.forEach(([dx, dy]) => {
            ctx.lineTo(corner.x + dx, corner.y + dy);
            ctx.moveTo(corner.x, corner.y);
        });
        ctx.stroke();
    });

    // Add a subtle glow effect when active
    if (isActive) {
        ctx.shadowColor = '#00FF00';
        ctx.shadowBlur = 15;
        ctx.setLineDash([]);
        ctx.strokeRect(region.x - 2, region.y - 2, region.width + 4, region.height + 4);
        ctx.shadowBlur = 0;
    }
};