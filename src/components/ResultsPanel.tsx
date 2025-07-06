// src/components/ResultsPanel.tsx

'use client';

import { useState } from 'react';
import { Card, Button, Badge, Row, Col } from 'react-bootstrap';
import Image from 'next/image';
import { CapturedImage } from '@/types';
import { formatTimestamp, formatProcessingTime } from '@/lib/utils';

interface ResultsPanelProps {
    results: CapturedImage[];
    onClear: () => void;
}

export default function ResultsPanel({ results, onClear }: ResultsPanelProps) {
    if (results.length === 0) {
        return (
            <Card>
                <Card.Header className="bg-success text-white">
                    <h5 className="mb-0">
                        <i className="bi bi-graph-up me-2"></i>
                        Generated Profiles
                    </h5>
                </Card.Header>
                <Card.Body className="text-center py-5">
                    <i className="bi bi-graph-up text-muted" style={{ fontSize: '4rem' }}></i>
                    <p className="text-muted mt-3 mb-1">No results yet</p>
                    <small className="text-muted">
                        Capture a face or upload an image to see generated profiles here
                    </small>
                </Card.Body>
            </Card>
        );
    }

    return (
        <Card>
            <Card.Header className="bg-success text-white d-flex justify-content-between align-items-center">
                <h5 className="mb-0">
                    <i className="bi bi-graph-up me-2"></i>
                    Generated Profiles ({results.length})
                </h5>
                <Button
                    variant="light"
                    size="sm"
                    onClick={onClear}
                >
                    <i className="bi bi-trash me-1"></i>
                    Clear All
                </Button>
            </Card.Header>

            <Card.Body style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <div className="d-grid gap-3">
                    {results.map((result) => (
                        <ResultCard key={result.id} result={result} />
                    ))}
                </div>
            </Card.Body>
        </Card>
    );
}

function ResultCard({ result }: { result: CapturedImage }) {
    const [isExpanded, setIsExpanded] = useState(false);

    const getStatusVariant = (status: string) => {
        switch (status) {
            case 'completed': return 'success';
            case 'error': return 'danger';
            default: return 'warning';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed': return 'check-circle';
            case 'error': return 'x-circle';
            default: return 'clock';
        }
    };

    return (
        <Card className="border">
            <Card.Body className="p-3">
                <Row className="g-3">
                    {/* Image */}
                    <Col xs="auto">
                        <div style={{ width: '80px', height: '80px', position: 'relative' }}>
                            <Image
                                src={result.imageData}
                                alt="Captured face"
                                fill
                                className="rounded border"
                                style={{ objectFit: 'cover' }}
                                sizes="80px"
                            />
                        </div>
                    </Col>

                    {/* Content */}
                    <Col>
                        <div className="d-flex justify-content-between align-items-start mb-2">
                            <small className="text-muted">
                                <i className="bi bi-camera me-1"></i>
                                {formatTimestamp(result.timestamp)}
                            </small>
                            {result.processingTimeMs && (
                                <Badge bg="info">
                                    <i className="bi bi-stopwatch me-1"></i>
                                    {formatProcessingTime(result.processingTimeMs)}
                                </Badge>
                            )}
                        </div>

                        {/* Status */}
                        <div className="mb-2">
                            <Badge bg={getStatusVariant(result.status)}>
                                <i className={`bi bi-${getStatusIcon(result.status)} me-1`}></i>
                                {result.status === 'completed' ? 'Completed' :
                                    result.status === 'error' ? 'Error' : 'Processing'}
                            </Badge>
                        </div>

                        {/* Result text preview */}
                        <div className="text-sm">
                            {result.result ? (
                                <>
                                    <p className="mb-2" style={{
                                        display: '-webkit-box',
                                        WebkitLineClamp: isExpanded ? 'none' : 2,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden'
                                    }}>
                                        {result.result}
                                    </p>
                                    {result.result.length > 100 && (
                                        <Button
                                            variant="link"
                                            size="sm"
                                            className="p-0 text-decoration-none"
                                            onClick={() => setIsExpanded(!isExpanded)}
                                        >
                                            <i className={`bi bi-chevron-${isExpanded ? 'up' : 'down'} me-1`}></i>
                                            {isExpanded ? 'Show Less' : 'Show More'}
                                        </Button>
                                    )}
                                </>
                            ) : (
                                <p className="text-muted fst-italic mb-0">
                                    <i className="bi bi-hourglass-split me-1"></i>
                                    Processing...
                                </p>
                            )}
                        </div>
                    </Col>
                </Row>
            </Card.Body>
        </Card>
    );
}