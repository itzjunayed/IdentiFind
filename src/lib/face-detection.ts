// src/lib/face-detection.ts

import { FaceDetectionResult, FaceDetectionConfig } from '@/types';

// Declare global MediaPipe objects (loaded via CDN)
declare global {
    interface Window {
        FaceDetection: any;
        Camera: any;
    }
}

export class FaceDetectionManager {
    private faceDetection: any = null;
    private camera: any = null;
    private config: FaceDetectionConfig;
    private onResultsCallback?: (results: FaceDetectionResult[]) => void;
    private canvasElement: HTMLCanvasElement | null = null;
    private videoElement: HTMLVideoElement | null = null;
    private isInitialized: boolean = false;

    constructor(config: FaceDetectionConfig) {
        this.config = config;
    }

    async initialize(
        videoElement: HTMLVideoElement,
        canvasElement: HTMLCanvasElement,
        onResults: (results: FaceDetectionResult[]) => void
    ): Promise<void> {
        this.videoElement = videoElement;
        this.canvasElement = canvasElement;
        this.onResultsCallback = onResults;

        // Wait for MediaPipe to load
        await this.waitForMediaPipe();

        try {
            // Initialize MediaPipe Face Detection
            this.faceDetection = new window.FaceDetection({
                locateFile: (file: string) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`;
                }
            });

            this.faceDetection.setOptions({
                model: 'short',
                minDetectionConfidence: this.config.minDetectionConfidence,
            });

            this.faceDetection.onResults((results: any) => {
                this.onResults(results);
            });

            // Initialize camera
            this.camera = new window.Camera(videoElement, {
                onFrame: async () => {
                    if (this.faceDetection && this.isInitialized) {
                        await this.faceDetection.send({ image: videoElement });
                    }
                },
                width: 640,
                height: 480
            });

            await this.camera.start();
            this.isInitialized = true;

        } catch (error) {
            console.error('Error initializing MediaPipe:', error);
            throw new Error('Failed to initialize face detection. Please check MediaPipe CDN connection.');
        }
    }

    private async waitForMediaPipe(): Promise<void> {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 50; // 5 seconds max wait

            const checkMediaPipe = () => {
                attempts++;

                if (window.FaceDetection && window.Camera) {
                    resolve();
                } else if (attempts >= maxAttempts) {
                    reject(new Error('MediaPipe failed to load within timeout'));
                } else {
                    setTimeout(checkMediaPipe, 100);
                }
            };

            checkMediaPipe();
        });
    }

    private onResults(results: any): void {
        if (!this.canvasElement || !this.videoElement || !this.onResultsCallback) {
            return;
        }

        const canvasCtx = this.canvasElement.getContext('2d');
        if (!canvasCtx) return;

        // Clear canvas
        canvasCtx.save();
        canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);

        // Draw the video frame
        canvasCtx.drawImage(
            results.image,
            0,
            0,
            this.canvasElement.width,
            this.canvasElement.height
        );

        const detectionResults: FaceDetectionResult[] = [];

        if (results.detections && results.detections.length > 0) {
            for (const detection of results.detections) {
                // Extract bounding box
                const bbox = detection.boundingBox;
                if (bbox) {
                    const result: FaceDetectionResult = {
                        confidence: detection.score ? detection.score[0] : 0,
                        bbox: {
                            x: bbox.xCenter * this.canvasElement.width - (bbox.width * this.canvasElement.width) / 2,
                            y: bbox.yCenter * this.canvasElement.height - (bbox.height * this.canvasElement.height) / 2,
                            width: bbox.width * this.canvasElement.width,
                            height: bbox.height * this.canvasElement.height,
                        }
                    };

                    detectionResults.push(result);

                    // Draw detection rectangle
                    canvasCtx.strokeStyle = '#00FF00';
                    canvasCtx.lineWidth = 2;
                    canvasCtx.strokeRect(
                        result.bbox.x,
                        result.bbox.y,
                        result.bbox.width,
                        result.bbox.height
                    );

                    // Draw confidence score
                    canvasCtx.fillStyle = '#00FF00';
                    canvasCtx.font = '16px Arial';
                    canvasCtx.fillText(
                        `${(result.confidence * 100).toFixed(1)}%`,
                        result.bbox.x,
                        result.bbox.y - 5
                    );
                }
            }
        }

        canvasCtx.restore();
        this.onResultsCallback(detectionResults);
    }

    isInTargetRegion(
        detection: FaceDetectionResult,
        targetRegion: { x: number; y: number; width: number; height: number }
    ): boolean {
        const { bbox } = detection;
        const centerX = bbox.x + bbox.width / 2;
        const centerY = bbox.y + bbox.height / 2;

        return (
            centerX >= targetRegion.x &&
            centerX <= targetRegion.x + targetRegion.width &&
            centerY >= targetRegion.y &&
            centerY <= targetRegion.y + targetRegion.height &&
            detection.confidence >= this.config.minDetectionConfidence
        );
    }

    captureImage(): string | null {
        if (!this.canvasElement) return null;

        return this.canvasElement.toDataURL('image/jpeg', 0.8);
    }

    stop(): void {
        this.isInitialized = false;

        if (this.camera) {
            try {
                this.camera.stop();
            } catch (error) {
                console.warn('Error stopping camera:', error);
            }
        }

        if (this.faceDetection) {
            try {
                this.faceDetection.close();
            } catch (error) {
                console.warn('Error closing face detection:', error);
            }
        }
    }

    updateConfig(newConfig: Partial<FaceDetectionConfig>): void {
        this.config = { ...this.config, ...newConfig };

        if (this.faceDetection && this.isInitialized) {
            this.faceDetection.setOptions({
                model: 'short',
                minDetectionConfidence: this.config.minDetectionConfidence,
            });
        }
    }
}

export const createTargetRegion = (
    canvasWidth: number,
    canvasHeight: number
): { x: number; y: number; width: number; height: number } => {
    const regionWidth = canvasWidth * 0.3;
    const regionHeight = canvasHeight * 0.4;
    const x = (canvasWidth - regionWidth) / 2;
    const y = (canvasHeight - regionHeight) / 2;

    return { x, y, width: regionWidth, height: regionHeight };
};

export const drawTargetRegion = (
    canvas: HTMLCanvasElement,
    region: { x: number; y: number; width: number; height: number },
    isActive: boolean = false
): void => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = isActive ? '#FF0000' : '#FFD700';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 5]);
    ctx.strokeRect(region.x, region.y, region.width, region.height);

    // Draw corner indicators
    const cornerSize = 20;
    ctx.setLineDash([]);
    ctx.lineWidth = 4;

    // Top-left corner
    ctx.beginPath();
    ctx.moveTo(region.x, region.y + cornerSize);
    ctx.lineTo(region.x, region.y);
    ctx.lineTo(region.x + cornerSize, region.y);
    ctx.stroke();

    // Top-right corner
    ctx.beginPath();
    ctx.moveTo(region.x + region.width - cornerSize, region.y);
    ctx.lineTo(region.x + region.width, region.y);
    ctx.lineTo(region.x + region.width, region.y + cornerSize);
    ctx.stroke();

    // Bottom-left corner
    ctx.beginPath();
    ctx.moveTo(region.x, region.y + region.height - cornerSize);
    ctx.lineTo(region.x, region.y + region.height);
    ctx.lineTo(region.x + cornerSize, region.y + region.height);
    ctx.stroke();

    // Bottom-right corner
    ctx.beginPath();
    ctx.moveTo(region.x + region.width - cornerSize, region.y + region.height);
    ctx.lineTo(region.x + region.width, region.y + region.height);
    ctx.lineTo(region.x + region.width, region.y + region.height - cornerSize);
    ctx.stroke();
}

// Alternative implementation using browser's native Face Detection API (if available)
export class BrowserFaceDetectionManager {
    private detector: any = null;
    private config: FaceDetectionConfig;
    private onResultsCallback?: (results: FaceDetectionResult[]) => void;
    private isDetecting: boolean = false;
    private detectionInterval: NodeJS.Timeout | null = null;

    constructor(config: FaceDetectionConfig) {
        this.config = config;
    }

    async initialize(
        videoElement: HTMLVideoElement,
        canvasElement: HTMLCanvasElement,
        onResults: (results: FaceDetectionResult[]) => void
    ): Promise<void> {
        this.onResultsCallback = onResults;

        // Check if browser supports Face Detection API
        if ('FaceDetector' in window) {
            try {
                // @ts-ignore
                this.detector = new window.FaceDetector({
                    maxDetectedFaces: 10,
                    fastMode: false
                });

                this.startDetection(videoElement, canvasElement);
            } catch (error) {
                console.warn('Browser Face Detection API not available, falling back to MediaPipe');
                throw error;
            }
        } else {
            throw new Error('Browser Face Detection API not supported');
        }
    }

    private startDetection(videoElement: HTMLVideoElement, canvasElement: HTMLCanvasElement): void {
        this.isDetecting = true;

        const detect = async () => {
            if (!this.isDetecting || !this.detector || !this.onResultsCallback) return;

            try {
                const faces = await this.detector.detect(videoElement);
                const results: FaceDetectionResult[] = faces.map((face: any) => ({
                    confidence: 0.9, // Browser API doesn't provide confidence
                    bbox: {
                        x: face.boundingBox.x,
                        y: face.boundingBox.y,
                        width: face.boundingBox.width,
                        height: face.boundingBox.height,
                    }
                }));

                this.onResultsCallback(results);
            } catch (error) {
                console.warn('Face detection error:', error);
            }
        };

        // Run detection every 100ms
        this.detectionInterval = setInterval(detect, 100);
    }

    stop(): void {
        this.isDetecting = false;
        if (this.detectionInterval) {
            clearInterval(this.detectionInterval);
            this.detectionInterval = null;
        }
    }

    isInTargetRegion(
        detection: FaceDetectionResult,
        targetRegion: { x: number; y: number; width: number; height: number }
    ): boolean {
        const { bbox } = detection;
        const centerX = bbox.x + bbox.width / 2;
        const centerY = bbox.y + bbox.height / 2;

        return (
            centerX >= targetRegion.x &&
            centerX <= targetRegion.x + targetRegion.width &&
            centerY >= targetRegion.y &&
            centerY <= targetRegion.y + targetRegion.height
        );
    }

    captureImage(): string | null {
        // This would need to be implemented separately
        return null;
    }

    updateConfig(newConfig: Partial<FaceDetectionConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }
}