// src/components/QueueManager.tsx

'use client';

import { Card, Button, Badge, Row, Col, ProgressBar } from 'react-bootstrap';
import Image from 'next/image';
import { ProcessingQueue, CapturedImage } from '@/types';
import { formatTimestamp } from '@/lib/utils';

interface QueueManagerProps {
    queue: ProcessingQueue;
    onClear: () => void;
}

export default function QueueManager({ queue, onClear }: QueueManagerProps) {
    const pendingItems = queue.items.filter(item => item.status === 'pending');
    const processingItems = queue.items.filter(item => item.status === 'processing');
    const errorItems = queue.items.filter(item => item.status === 'error');

    return (
        <Card>
            <Card.Header className="bg-gradient-warning text-dark border-0 d-flex justify-content-between align-items-center">
                <h5 className="mb-0 fw-bold">
                    <i className="bi bi-list-task me-2"></i>
                    Processing Queue ({queue.items.length})
                </h5>
                {queue.items.length > 0 && (
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onClear}
                    >
                        <i className="bi bi-trash me-1"></i>
                        Clear Queue
                    </Button>
                )}
            </Card.Header>

            <Card.Body>
                {queue.items.length === 0 ? (
                    <div className="text-center py-4">
                        <i className="bi bi-hourglass text-muted" style={{ fontSize: '3rem' }}></i>
                        <p className="text-muted mt-3 mb-1">Queue is empty</p>
                        <small className="text-muted">
                            Captured images will appear here before processing
                        </small>
                    </div>
                ) : (
                    <>
                        {/* Currently Processing */}
                        {processingItems.length > 0 && (
                            <div className="mb-4">
                                <h6 className="d-flex align-items-center mb-3">
                                    <Badge bg="warning" className="me-2">
                                        <i className="bi bi-gear-fill"></i>
                                    </Badge>
                                    Currently Processing
                                </h6>
                                <div className="d-grid gap-2">
                                    {processingItems.map((item) => (
                                        <QueueItem key={item.id} item={item} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Pending Items */}
                        {pendingItems.length > 0 && (
                            <div className="mb-4">
                                <h6 className="d-flex align-items-center mb-3">
                                    <Badge bg="primary" className="me-2">
                                        <i className="bi bi-clock"></i>
                                    </Badge>
                                    Waiting in Queue ({pendingItems.length})
                                </h6>
                                <div className="d-grid gap-2">
                                    {pendingItems.map((item, index) => (
                                        <QueueItem key={item.id} item={item} position={index + 1} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Error Items */}
                        {errorItems.length > 0 && (
                            <div className="mb-4">
                                <h6 className="d-flex align-items-center mb-3">
                                    <Badge bg="danger" className="me-2">
                                        <i className="bi bi-exclamation-triangle"></i>
                                    </Badge>
                                    Failed ({errorItems.length})
                                </h6>
                                <div className="d-grid gap-2">
                                    {errorItems.map((item) => (
                                        <QueueItem key={item.id} item={item} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Queue Statistics */}
                        <Card className="bg-light">
                            <Card.Body>
                                <h6 className="mb-3">
                                    <i className="bi bi-bar-chart me-2"></i>
                                    Queue Statistics
                                </h6>
                                <Row className="g-3 text-center">
                                    <Col xs={3}>
                                        <div className="fs-4 fw-bold text-primary">{pendingItems.length}</div>
                                        <small className="text-muted">Pending</small>
                                    </Col>
                                    <Col xs={3}>
                                        <div className="fs-4 fw-bold text-warning">{processingItems.length}</div>
                                        <small className="text-muted">Processing</small>
                                    </Col>
                                    <Col xs={3}>
                                        <div className="fs-4 fw-bold text-danger">{errorItems.length}</div>
                                        <small className="text-muted">Errors</small>
                                    </Col>
                                    <Col xs={3}>
                                        <div className="fs-4 fw-bold text-success">{queue.items.length}</div>
                                        <small className="text-muted">Total</small>
                                    </Col>
                                </Row>
                            </Card.Body>
                        </Card>
                    </>
                )}
            </Card.Body>
        </Card>
    );
}

interface QueueItemProps {
    item: CapturedImage;
    position?: number;
}

function QueueItem({ item, position }: QueueItemProps) {
    const getStatusVariant = (status: string) => {
        switch (status) {
            case 'pending': return 'primary';
            case 'processing': return 'warning';
            case 'error': return 'danger';
            default: return 'secondary';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pending': return 'clock';
            case 'processing': return 'gear-fill';
            case 'error': return 'x-circle';
            default: return 'question-circle';
        }
    };

    const getProcessingTime = () => {
        if (item.status === 'processing' && item.processingStartTime) {
            const elapsed = Date.now() - new Date(item.processingStartTime).getTime();
            return Math.floor(elapsed / 1000);
        }
        return null;
    };

    const processingSeconds = getProcessingTime();

    return (
        <Card className="border-start border-4" style={{
            borderColor: `var(--bs-${getStatusVariant(item.status)})`
        }}>
            <Card.Body className="p-3">
                <Row className="g-3 align-items-center">
                    {/* Position Badge */}
                    {position && (
                        <Col xs="auto">
                            <Badge bg="primary" className="rounded-circle p-2" style={{ width: '30px', height: '30px' }}>
                                {position}
                            </Badge>
                        </Col>
                    )}

                    {/* Image Thumbnail */}
                    <Col xs="auto">
                        <div style={{ width: '50px', height: '50px', position: 'relative' }}>
                            <Image
                                src={item.imageData}
                                alt="Queued image"
                                fill
                                className="rounded border"
                                style={{ objectFit: 'cover' }}
                                sizes="50px"
                            />
                        </div>
                    </Col>

                    {/* Details */}
                    <Col>
                        <div className="d-flex align-items-center mb-1">
                            <Badge bg={getStatusVariant(item.status)} className="me-2">
                                <i className={`bi bi-${getStatusIcon(item.status)} me-1`}></i>
                                {item.status}
                            </Badge>
                            {processingSeconds !== null && (
                                <small className="text-muted">
                                    <i className="bi bi-stopwatch me-1"></i>
                                    {processingSeconds}s elapsed
                                </small>
                            )}
                        </div>

                        <small className="text-muted d-block">
                            <i className="bi bi-camera me-1"></i>
                            {formatTimestamp(item.timestamp)}
                        </small>

                        {item.status === 'error' && item.result && (
                            <small className="text-danger d-block mt-1">
                                <i className="bi bi-exclamation-triangle me-1"></i>
                                {item.result}
                            </small>
                        )}

                        {/* Processing Progress Bar */}
                        {item.status === 'processing' && (
                            <div className="mt-2">
                                <ProgressBar animated now={100} variant="warning" style={{ height: '4px' }} />
                            </div>
                        )}
                    </Col>

                    {/* Processing Animation */}
                    {item.status === 'processing' && (
                        <Col xs="auto">
                            <div className="spinner-border spinner-border-sm text-warning" role="status">
                                <span className="visually-hidden">Processing...</span>
                            </div>
                        </Col>
                    )}
                </Row>
            </Card.Body>
        </Card>
    );
}