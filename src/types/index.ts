// src/types/index.ts

export interface FaceDetectionResult {
    confidence: number;
    isFacingCamera: boolean;
    faceAngle: {
        yaw: number;    // Left-right rotation
        pitch: number;  // Up-down rotation
        roll: number;   // Tilt rotation
    };
    frontalConfidence: number;
    bbox: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}

export interface CapturedImage {
    id: string;
    imageData: string; // base64
    timestamp: Date;
    status: 'pending' | 'processing' | 'completed' | 'error';
    processingStartTime?: Date;
    processingEndTime?: Date;
    result?: string;
    processingTimeMs?: number;
}

export interface ProcessingQueue {
    items: CapturedImage[];
    currentProcessingId: string | null;
}

export interface DatabaseResult {
    _id: string;
    imageData: string;
    result: string;
    processingTimeMs: number;
    createdAt: Date;
    capturedAt: Date;
}

export interface FaceDetectionConfig {
    minDetectionConfidence: number;
    minFrontalConfidence: number;
    maxYawAngle: number;    // Maximum left-right rotation in degrees
    maxPitchAngle: number;  // Maximum up-down rotation in degrees
    stabilityThreshold: number;
    captureDelay: number; // milliseconds
}

export interface CameraStatus {
    isOn: boolean;
    isInitialized: boolean;
    error: string | null;
    stream: MediaStream | null;
}

export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export interface HuggingFaceResponse {
    generated_text: string;
}

export interface HistoryItem {
    _id: string;
    imageData: string;
    result: string;
    processingTimeMs: number;
    createdAt: string;
    capturedAt: string;
}