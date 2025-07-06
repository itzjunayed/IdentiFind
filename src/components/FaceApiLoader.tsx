// src/components/FaceApiLoader.tsx
'use client';

import { useEffect, useState } from 'react';

// Type for window object with face-api extensions
interface WindowWithFaceApi extends Window {
    faceApiLoaded?: boolean;
    faceApiError?: string | null;
}

export default function FaceApiLoader() {
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Only run on client side
        if (typeof window === 'undefined') return;

        let mounted = true;

        const loadModels = async () => {
            try {
                console.log('Loading face-api.js models...');

                // Dynamic import to avoid SSR issues
                const faceapi = await import('face-api.js');

                // Load all required models from public/models directory
                await Promise.all([
                    faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
                    faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
                    faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
                    faceapi.nets.faceExpressionNet.loadFromUri('/models')
                ]);

                if (mounted) {
                    console.log('✅ Face-api.js models loaded successfully');
                    setIsLoaded(true);

                    // Make loading status available globally
                    (window as WindowWithFaceApi).faceApiLoaded = true;
                    (window as WindowWithFaceApi).faceApiError = null;

                    // Dispatch custom event for components that need to know
                    window.dispatchEvent(new CustomEvent('faceApiLoaded'));
                }
            } catch (err) {
                console.error('❌ Failed to load face-api.js models:', err);
                if (mounted) {
                    const errorMessage = 'Failed to load face detection models. Please check if model files are available.';
                    setError(errorMessage);

                    // Make error status available globally
                    (window as WindowWithFaceApi).faceApiLoaded = false;
                    (window as WindowWithFaceApi).faceApiError = errorMessage;

                    // Dispatch error event
                    window.dispatchEvent(new CustomEvent('faceApiError', { detail: errorMessage }));
                }
            }
        };

        // Small delay to ensure DOM is ready
        const timer = setTimeout(() => {
            loadModels();
        }, 100);

        return () => {
            mounted = false;
            clearTimeout(timer);
        };
    }, []);

    // Initialize global state
    useEffect(() => {
        if (typeof window !== 'undefined') {
            (window as WindowWithFaceApi).faceApiLoaded = isLoaded;
            (window as WindowWithFaceApi).faceApiError = error;
        }
    }, [isLoaded, error]);

    return null; // This component doesn't render anything
}