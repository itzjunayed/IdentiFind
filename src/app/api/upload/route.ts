// src/app/api/upload/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { ApiResponse } from '@/types';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json<ApiResponse>({
                success: false,
                error: 'No file uploaded',
            }, { status: 400 });
        }

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json<ApiResponse>({
                success: false,
                error: 'Invalid file type. Please upload a JPEG, PNG, or WebP image.',
            }, { status: 400 });
        }

        // Validate file size (10MB limit)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            return NextResponse.json<ApiResponse>({
                success: false,
                error: 'File size too large. Please upload an image smaller than 10MB.',
            }, { status: 400 });
        }

        // Convert file to base64 for consistent handling with camera captures
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const base64 = buffer.toString('base64');
        const mimeType = file.type;
        const dataURL = `data:${mimeType};base64,${base64}`;

        // Optional: Save file to disk (for debugging or backup)
        if (process.env.NODE_ENV === 'development') {
            try {
                const uploadsDir = join(process.cwd(), 'uploads');
                const filename = `upload-${Date.now()}-${file.name}`;
                const filepath = join(uploadsDir, filename);

                // Create uploads directory if it doesn't exist
                if (!existsSync(uploadsDir)) {
                    mkdirSync(uploadsDir, { recursive: true });
                }

                await writeFile(filepath, buffer);
                console.log(`File saved to: ${filepath}`);
            } catch (saveError) {
                console.warn('Failed to save file to disk:', saveError);
                // Continue processing even if save fails
            }
        }

        return NextResponse.json<ApiResponse>({
            success: true,
            data: {
                filename: file.name,
                size: file.size,
                type: file.type,
                dataURL,
                uploadedAt: new Date().toISOString(),
            },
            message: 'File uploaded successfully',
        });

    } catch (error) {
        console.error('Error handling file upload:', error);
        return NextResponse.json<ApiResponse>({
            success: false,
            error: 'Internal server error during file upload',
        }, { status: 500 });
    }
}

// Handle file upload via multipart form data (alternative approach)
export async function PUT(request: NextRequest) {
    try {
        const { imageData, filename, metadata } = await request.json();

        if (!imageData) {
            return NextResponse.json<ApiResponse>({
                success: false,
                error: 'Image data is required',
            }, { status: 400 });
        }

        // Validate base64 data URL
        if (!imageData.startsWith('data:image/')) {
            return NextResponse.json<ApiResponse>({
                success: false,
                error: 'Invalid image data format',
            }, { status: 400 });
        }

        // Extract file information from data URL
        const [header, base64Data] = imageData.split(',');
        const mimeMatch = header.match(/data:(.+);base64/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

        // Validate MIME type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(mimeType)) {
            return NextResponse.json<ApiResponse>({
                success: false,
                error: 'Invalid image type',
            }, { status: 400 });
        }

        // Calculate approximate file size from base64
        const approximateSize = (base64Data.length * 3) / 4;
        const maxSize = 10 * 1024 * 1024; // 10MB

        if (approximateSize > maxSize) {
            return NextResponse.json<ApiResponse>({
                success: false,
                error: 'Image too large',
            }, { status: 400 });
        }

        // Optional: Save to disk in development
        if (process.env.NODE_ENV === 'development' && filename) {
            try {
                const uploadsDir = join(process.cwd(), 'uploads');
                const buffer = Buffer.from(base64Data, 'base64');
                const filepath = join(uploadsDir, `${Date.now()}-${filename}`);

                if (!existsSync(uploadsDir)) {
                    mkdirSync(uploadsDir, { recursive: true });
                }

                await writeFile(filepath, buffer);
                console.log(`Image saved to: ${filepath}`);
            } catch (saveError) {
                console.warn('Failed to save image to disk:', saveError);
            }
        }

        return NextResponse.json<ApiResponse>({
            success: true,
            data: {
                filename: filename || `upload-${Date.now()}.jpg`,
                size: approximateSize,
                type: mimeType,
                dataURL: imageData,
                metadata,
                uploadedAt: new Date().toISOString(),
            },
            message: 'Image processed successfully',
        });

    } catch (error) {
        console.error('Error processing image data:', error);
        return NextResponse.json<ApiResponse>({
            success: false,
            error: 'Internal server error during image processing',
        }, { status: 500 });
    }
}

// Get upload statistics
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');

        if (action === 'stats') {
            // Return upload statistics
            const stats = {
                maxFileSize: 10 * 1024 * 1024, // 10MB
                allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
                supportedFormats: ['JPEG', 'PNG', 'WebP'],
                maxFileSizeFormatted: '10MB',
                serverTime: new Date().toISOString(),
            };

            return NextResponse.json<ApiResponse>({
                success: true,
                data: stats,
            });
        }

        return NextResponse.json<ApiResponse>({
            success: false,
            error: 'Invalid action',
        }, { status: 400 });

    } catch (error) {
        console.error('Error handling GET request:', error);
        return NextResponse.json<ApiResponse>({
            success: false,
            error: 'Internal server error',
        }, { status: 500 });
    }
}