// src/components/FileUpload.tsx

'use client';

import { useState, useRef, useCallback } from 'react';
import { Card, Button, Alert, Row, Col, Form, Badge } from 'react-bootstrap';
import { validateImageFile, blobToDataURL } from '@/lib/utils';

interface FileUploadProps {
    onFileUploaded: (imageData: string) => void;
}

export default function FileUpload({ onFileUploaded }: FileUploadProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = useCallback(async (file: File) => {
        setError(null);
        setSuccess(null);
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

            // Call the callback
            onFileUploaded(imageData);

            setSuccess(`✅ Successfully uploaded: ${file.name}`);

            // Clear success message after delay
            setTimeout(() => {
                setSuccess(null);
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
            setError('Please drop an image file (JPEG, PNG, WebP)');
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

    const generateSampleImage = useCallback((label: string) => {
        // Create a sample image using canvas
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 400;
        const ctx = canvas.getContext('2d')!;

        // Draw a simple sample "face"
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, 400, 400);

        // Face outline
        ctx.fillStyle = '#ffc107';
        ctx.beginPath();
        ctx.arc(200, 200, 150, 0, 2 * Math.PI);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#212529';
        ctx.beginPath();
        ctx.arc(160, 170, 15, 0, 2 * Math.PI);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(240, 170, 15, 0, 2 * Math.PI);
        ctx.fill();

        // Smile
        ctx.strokeStyle = '#212529';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(200, 220, 50, 0, Math.PI);
        ctx.stroke();

        // Add label
        ctx.fillStyle = '#212529';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(label, 200, 350);

        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        onFileUploaded(imageData);
        setSuccess(`✅ Generated sample: ${label}`);
        setTimeout(() => setSuccess(null), 3000);
    }, [onFileUploaded]);

    return (
        <div className="d-grid gap-3">
            {/* Drop Zone */}
            <Card
                className={`border-2 border-dashed text-center ${isDragging
                        ? 'border-primary bg-primary bg-opacity-10'
                        : 'border-secondary'
                    } ${isUploading ? 'opacity-50' : ''}`}
                style={{ cursor: isUploading ? 'not-allowed' : 'pointer' }}
                onClick={!isUploading ? handleClick : undefined}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
            >
                <Card.Body className="py-5">
                    <Form.Control
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileInputChange}
                        className="d-none"
                    />

                    {isUploading ? (
                        <div>
                            <div className="spinner-border text-primary mb-3" role="status">
                                <span className="visually-hidden">Processing...</span>
                            </div>
                            <p className="text-muted mb-0">Processing image...</p>
                        </div>
                    ) : (
                        <div>
                            <i className="bi bi-cloud-upload text-muted" style={{ fontSize: '3rem' }}></i>
                            <h6 className="mt-3 mb-2">
                                {isDragging ? 'Drop your image here' : 'Drag & drop an image here'}
                            </h6>
                            <p className="text-muted small mb-3">
                                or click to select a file
                            </p>
                            <div className="d-flex justify-content-center gap-2 flex-wrap">
                                <Badge bg="secondary">JPEG</Badge>
                                <Badge bg="secondary">PNG</Badge>
                                <Badge bg="secondary">WebP</Badge>
                                <Badge bg="secondary">Max 10MB</Badge>
                            </div>
                        </div>
                    )}
                </Card.Body>
            </Card>

            {/* Error Message */}
            {error && (
                <Alert variant="danger" dismissible onClose={() => setError(null)}>
                    <Alert.Heading className="h6">
                        <i className="bi bi-exclamation-triangle me-2"></i>
                        Upload Error
                    </Alert.Heading>
                    {error}
                </Alert>
            )}

            {/* Success Message */}
            {success && (
                <Alert variant="success" dismissible onClose={() => setSuccess(null)}>
                    <Alert.Heading className="h6">
                        <i className="bi bi-check-circle me-2"></i>
                        Upload Success
                    </Alert.Heading>
                    {success}
                    <hr />
                    <p className="mb-0 small">Image has been added to the processing queue.</p>
                </Alert>
            )}

            {/* Quick Actions */}
            <Row className="g-2">
                <Col>
                    <Button
                        variant="primary"
                        className="w-100"
                        onClick={handleClick}
                        disabled={isUploading}
                    >
                        <i className="bi bi-folder2-open me-2"></i>
                        Choose File
                    </Button>
                </Col>
                <Col>
                    <Button
                        variant="outline-secondary"
                        className="w-100"
                        onClick={() => {
                            setError(null);
                            setSuccess(null);
                        }}
                        disabled={isUploading || (!error && !success)}
                    >
                        <i className="bi bi-x-circle me-2"></i>
                        Clear
                    </Button>
                </Col>
            </Row>

            {/* Instructions */}
            <Alert variant="info">
                <Alert.Heading className="h6">
                    <i className="bi bi-info-circle me-2"></i>
                    Upload Instructions
                </Alert.Heading>
                <ul className="mb-0 small">
                    <li>Upload clear images with visible faces</li>
                    <li>Supported formats: JPEG, PNG, WebP</li>
                    <li>Maximum file size: 10MB</li>
                    <li>Images will be automatically processed and analyzed</li>
                </ul>
            </Alert>

            {/* Sample Images */}
            <Card>
                <Card.Header>
                    <h6 className="mb-0">
                        <i className="bi bi-images me-2"></i>
                        Need test images?
                    </h6>
                </Card.Header>
                <Card.Body>
                    <p className="text-muted small mb-3">
                        Generate sample face images for testing:
                    </p>
                    <Row className="g-2">
                        <Col xs={4}>
                            <Button
                                variant="outline-primary"
                                size="sm"
                                className="w-100"
                                onClick={() => generateSampleImage('Sample 1')}
                                disabled={isUploading}
                            >
                                Portrait 1
                            </Button>
                        </Col>
                        <Col xs={4}>
                            <Button
                                variant="outline-primary"
                                size="sm"
                                className="w-100"
                                onClick={() => generateSampleImage('Sample 2')}
                                disabled={isUploading}
                            >
                                Portrait 2
                            </Button>
                        </Col>
                        <Col xs={4}>
                            <Button
                                variant="outline-primary"
                                size="sm"
                                className="w-100"
                                onClick={() => generateSampleImage('Sample 3')}
                                disabled={isUploading}
                            >
                                Portrait 3
                            </Button>
                        </Col>
                    </Row>
                </Card.Body>
            </Card>
        </div>
    );
}