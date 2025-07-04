// src/types/index.ts

export interface FaceDetectionResult {
    confidence: number;
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
    stabilityThreshold: number;
    captureDelay: number; // milliseconds
}

export interface CameraStatus {
    isOn: boolean;
    isInitialized: boolean;
    error: string | null;
    stream: MediaStream | null;
}

export interface ApiResponse<T = any> {
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