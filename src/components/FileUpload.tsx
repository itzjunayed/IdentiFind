// src/components/FileUpload.tsx

'use client';

import { useState, useRef, useCallback } from 'react';
import { validateImageFile, blobToDataURL } from '@/lib/utils';

interface FileUploadProps {
    onFileUploaded: (imageData: string) => void;
}

export default function FileUpload({ onFileUploaded }: FileUploadProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = useCallback(async (file: File) => {
        setError(null);
        setIsUploading(true);

        try {
            // Validate file
            const validation = validateImageFile(file);
            if (!validation.valid) {
                setError(validation.error || 'Invalid file');
                return;
            }

            // Convert to data URL
            const imageData = await blobToDataURL(file);
            setPreview(imageData);

            // Call the callback
            onFileUploaded(imageData);

            // Clear preview after a delay
            setTimeout(() => {
                setPreview(null);
            }, 3000);

        } catch (err) {
            console.error('Error processing file:', err);
            setError('Failed to process the image file');
        } finally {
            setIsUploading(false);
        }
    }, [onFileUploaded]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const files = Array.from(e.dataTransfer.files);
        const imageFile = files.find(file => file.type.startsWith('image/'));

        if (imageFile) {
            handleFileSelect(imageFile);
        } else {
            setError('Please drop an image file');
        }
    }, [handleFileSelect]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFileSelect(file);
        }
        // Reset input value to allow selecting the same file again
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, [handleFileSelect]);

    const handleClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className="space-y-4">
            {/* Drop Zone */}
            <div
                className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
          ${isDragging
                        ? 'border-blue-400 bg-blue-50'
                        : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                    }
          ${isUploading ? 'opacity-50 pointer-events-none' : ''}
        `}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={handleClick}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileInputChange}
                    className="hidden"
                />

                {isUploading ? (
                    <div className="space-y-3">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="text-gray-600">Processing image...</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="text-gray-400 text-6xl">📷</div>
                        <div>
                            <p className="text-lg text-gray-600">
                                {isDragging ? 'Drop your image here' : 'Drag & drop an image here'}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                                or click to select a file
                            </p>
                        </div>
                        <div className="text-xs text-gray-400">
                            Supports: JPEG, PNG, WebP (max 10MB)
                        </div>
                    </div>
                )}
            </div>

            {/* Error Message */}
            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-red-600 text-sm">{error}</p>
                </div>
            )}

            {/* Preview */}
            {preview && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                    <div className="flex items-center space-x-3">
                        <img
                            src={preview}
                            alt="Upload preview"
                            className="w-16 h-16 object-cover rounded border"
                        />
                        <div className="flex-1">
                            <p className="text-green-800 font-medium">✓ Image uploaded successfully!</p>
                            <p className="text-green-600 text-sm">Added to processing queue</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                    onClick={handleClick}
                    disabled={isUploading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                    <span>📁</span>
                    <span>Choose File</span>
                </button>

                <button
                    onClick={() => {
                        setPreview(null);
                        setError(null);
                    }}
                    disabled={isUploading || (!preview && !error)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                    <span>🗑️</span>
                    <span>Clear</span>
                </button>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 p-4 rounded-md">
                <h3 className="text-sm font-medium text-blue-900 mb-2">Upload Instructions:</h3>
                <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Upload clear images with visible faces</li>
                    <li>• Supported formats: JPEG, PNG, WebP</li>
                    <li>• Maximum file size: 10MB</li>
                    <li>• Images will be automatically processed and analyzed</li>
                </ul>
            </div>

            {/* Sample Images */}
            <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Need test images?</h3>
                <div className="grid grid-cols-3 gap-2">
                    <SampleImageButton
                        label="Portrait 1"
                        onSelect={onFileUploaded}
                        disabled={isUploading}
                    />
                    <SampleImageButton
                        label="Portrait 2"
                        onSelect={onFileUploaded}
                        disabled={isUploading}
                    />
                    <SampleImageButton
                        label="Portrait 3"
                        onSelect={onFileUploaded}
                        disabled={isUploading}
                    />
                </div>
            </div>
        </div>
    );
}

interface SampleImageButtonProps {
    label: string;
    onSelect: (imageData: string) => void;
    disabled: boolean;
}

function SampleImageButton({ label, onSelect, disabled }: SampleImageButtonProps) {
    const generateSampleImage = useCallback(() => {
        // Create a sample image using canvas
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 400;
        const ctx = canvas.getContext('2d')!;

        // Draw a simple sample "face"
        ctx.fillStyle = '#f3f4f6';
        ctx.fillRect(0, 0, 400, 400);

        // Face outline
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(200, 200, 150, 0, 2 * Math.PI);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#1f2937';
        ctx.beginPath();
        ctx.arc(160, 170, 15, 0, 2 * Math.PI);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(240, 170, 15, 0, 2 * Math.PI);
        ctx.fill();

        // Smile
        ctx.strokeStyle = '#1f2937';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(200, 220, 50, 0, Math.PI);
        ctx.stroke();

        // Add label
        ctx.fillStyle = '#1f2937';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(label, 200, 350);

        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        onSelect(imageData);
    }, [label, onSelect]);

    return (
        <button
            onClick={generateSampleImage}
            disabled={disabled}
            className="p-2 text-xs bg-gray-100 text-gray-700 rounded border hover:bg-gray-200 disabled:opacity-50"
        >
            {label}
        </button>
    );
}