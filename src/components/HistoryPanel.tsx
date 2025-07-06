// src/components/HistoryPanel.tsx

'use client';

import { useState } from 'react';
import { Card, Button, Row, Col, Modal, Badge, Table, Spinner } from 'react-bootstrap';
import Image from 'next/image';
import { HistoryItem } from '@/types';
import { formatTimestamp, formatProcessingTime, downloadFile } from '@/lib/utils';

interface HistoryPanelProps {
    history: HistoryItem[];
    isLoading: boolean;
    onRefresh: () => void;
}

export default function HistoryPanel({ history, isLoading, onRefresh }: HistoryPanelProps) {
    const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    const handleDelete = async (id: string) => {
        setIsDeleting(id);
        try {
            const response = await fetch(`/api/history?id=${id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                onRefresh();
            } else {
                alert('Failed to delete result');
            }
        } catch (error) {
            console.error('Error deleting result:', error);
            alert('Failed to delete result');
        } finally {
            setIsDeleting(null);
            setShowDeleteConfirm(false);
            setItemToDelete(null);
        }
    };

    const handleClearAll = async () => {
        if (!confirm('Are you sure you want to clear all history? This action cannot be undone.')) return;

        try {
            const response = await fetch('/api/history', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ action: 'clear_all' }),
            });

            if (response.ok) {
                onRefresh();
            } else {
                alert('Failed to clear history');
            }
        } catch (error) {
            console.error('Error clearing history:', error);
            alert('Failed to clear history');
        }
    };

    const handleExport = () => {
        const exportData = history.map(item => ({
            id: item._id,
            capturedAt: item.capturedAt,
            createdAt: item.createdAt,
            processingTimeMs: item.processingTimeMs,
            result: item.result,
        }));

        const csvContent = [
            'ID,Captured At,Created At,Processing Time (ms),Result',
            ...exportData.map(item =>
                `"${item.id}","${item.capturedAt}","${item.createdAt}",${item.processingTimeMs},"${item.result.replace(/"/g, '""')}"`
            )
        ].join('\n');

        downloadFile(csvContent, `face-analysis-history-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
    };

    const confirmDelete = (id: string) => {
        setItemToDelete(id);
        setShowDeleteConfirm(true);
    };

    return (
        <div className="d-grid gap-4">
            {/* Header */}
            <Card>
                <Card.Header className="bg-primary text-white">
                    <Row className="align-items-center">
                        <Col>
                            <h2 className="mb-0">
                                <i className="bi bi-clock-history me-2"></i>
                                Generated Profiles History
                            </h2>
                            <p className="mb-0 opacity-75">
                                <Badge bg="light" text="dark">{history.length}</Badge> total results
                            </p>
                        </Col>
                        <Col xs="auto">
                            <div className="d-flex gap-2">
                                <Button
                                    variant="light"
                                    onClick={onRefresh}
                                    disabled={isLoading}
                                    className="d-flex align-items-center"
                                >
                                    {isLoading ? (
                                        <Spinner animation="border" size="sm" className="me-2" />
                                    ) : (
                                        <i className="bi bi-arrow-clockwise me-2"></i>
                                    )}
                                    Refresh
                                </Button>
                                {history.length > 0 && (
                                    <>
                                        <Button
                                            variant="success"
                                            onClick={handleExport}
                                            className="d-flex align-items-center"
                                        >
                                            <i className="bi bi-download me-2"></i>
                                            Export CSV
                                        </Button>
                                        <Button
                                            variant="danger"
                                            onClick={handleClearAll}
                                            className="d-flex align-items-center"
                                        >
                                            <i className="bi bi-trash me-2"></i>
                                            Clear All
                                        </Button>
                                    </>
                                )}
                            </div>
                        </Col>
                    </Row>
                </Card.Header>
            </Card>

            {/* Content */}
            {isLoading ? (
                <Card>
                    <Card.Body className="text-center py-5">
                        <Spinner animation="border" variant="primary" />
                        <p className="text-muted mt-3 mb-0">Loading history...</p>
                    </Card.Body>
                </Card>
            ) : history.length === 0 ? (
                <Card>
                    <Card.Body className="text-center py-5">
                        <i className="bi bi-archive text-muted" style={{ fontSize: '4rem' }}></i>
                        <h4 className="text-muted mt-3">No history found</h4>
                        <p className="text-muted">
                            Start capturing faces to build your generated profiles history
                        </p>
                    </Card.Body>
                </Card>
            ) : (
                <Row className="g-4">
                    {history.map((item) => (
                        <Col key={item._id} xs={12} md={6} lg={4}>
                            <HistoryCard
                                item={item}
                                onSelect={() => setSelectedItem(item)}
                                onDelete={() => confirmDelete(item._id)}
                                isDeleting={isDeleting === item._id}
                            />
                        </Col>
                    ))}
                </Row>
            )}

            {/* Detail Modal */}
            {selectedItem && (
                <HistoryDetailModal
                    item={selectedItem}
                    onClose={() => setSelectedItem(null)}
                />
            )}

            {/* Delete Confirmation Modal */}
            <Modal show={showDeleteConfirm} onHide={() => setShowDeleteConfirm(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>
                        <i className="bi bi-exclamation-triangle text-warning me-2"></i>
                        Confirm Delete
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    Are you sure you want to delete this profile? This action cannot be undone.
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
                        Cancel
                    </Button>
                    <Button
                        variant="danger"
                        onClick={() => itemToDelete && handleDelete(itemToDelete)}
                        disabled={!!isDeleting}
                    >
                        {isDeleting ? (
                            <>
                                <Spinner animation="border" size="sm" className="me-2" />
                                Deleting...
                            </>
                        ) : (
                            <>
                                <i className="bi bi-trash me-2"></i>
                                Delete
                            </>
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
}

interface HistoryCardProps {
    item: HistoryItem;
    onSelect: () => void;
    onDelete: () => void;
    isDeleting: boolean;
}

function HistoryCard({ item, onSelect, onDelete, isDeleting }: HistoryCardProps) {
    return (
        <Card className="h-100 shadow-sm">
            {/* Image */}
            <div style={{ height: '200px', overflow: 'hidden', position: 'relative' }}>
                <Image
                    src={item.imageData}
                    alt="Person pictures"
                    fill
                    className="object-fit-cover"
                    style={{ cursor: 'pointer' }}
                    onClick={onSelect}
                    sizes="(max-width: 768px) 100vw, (max-width: 992px) 50vw, 33vw"
                />
            </div>

            {/* Content */}
            <Card.Body className="d-flex flex-column">
                <div className="d-flex justify-content-between align-items-start mb-2">
                    <small className="text-muted">
                        <i className="bi bi-calendar me-1"></i>
                        {formatTimestamp(item.capturedAt)}
                    </small>
                    <Badge bg="info">
                        <i className="bi bi-stopwatch me-1"></i>
                        {formatProcessingTime(item.processingTimeMs)}
                    </Badge>
                </div>

                <p className="text-sm flex-grow-1" style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                }}>
                    {item.result}
                </p>

                <div className="d-flex justify-content-between align-items-center mt-auto">
                    <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={onSelect}
                    >
                        <i className="bi bi-eye me-1"></i>
                        View Details
                    </Button>
                    <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={onDelete}
                        disabled={isDeleting}
                    >

                        <i className="bi bi-trash"></i>
                        Delete
                    </Button>
                </div>
            </Card.Body>
        </Card>
    );
}

interface HistoryDetailModalProps {
    item: HistoryItem;
    onClose: () => void;
}

function HistoryDetailModal({ item, onClose }: HistoryDetailModalProps) {
    const handleDownloadImage = () => {
        const link = document.createElement('a');
        link.href = item.imageData;
        link.download = `face-analysis-${item._id}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <Modal show={true} onHide={onClose} size="lg" centered>
            <Modal.Header closeButton>
                <Modal.Title>
                    <i className="bi bi-info-circle me-2"></i>
                    Generated Profile Details
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Row className="g-4">
                    {/* Image */}
                    <Col md={6}>
                        <div style={{ position: 'relative', width: '100%', height: '300px' }}>
                            <Image
                                src={item.imageData}
                                alt="Profile Information"
                                fill
                                className="rounded border object-fit-cover"
                                sizes="(max-width: 768px) 100vw, 50vw"
                            />
                        </div>
                        <Button
                            variant="primary"
                            className="w-100 mt-3"
                            onClick={handleDownloadImage}
                        >
                            <i className="bi bi-download me-2"></i>
                            Download Image
                        </Button>
                    </Col>

                    {/* Details */}
                    <Col md={6}>
                        <Card>
                            <Card.Header>
                                <h6 className="mb-0">
                                    <i className="bi bi-chat-quote me-2"></i>
                                    Profile Information
                                </h6>
                            </Card.Header>
                            <Card.Body>
                                <p className="mb-0">{item.result}</p>
                            </Card.Body>
                        </Card>

                        <Table striped bordered className="mt-3">
                            <tbody>
                                <tr>
                                    <td><strong>Captured At</strong></td>
                                    <td>{formatTimestamp(item.capturedAt)}</td>
                                </tr>
                                <tr>
                                    <td><strong>Processed At</strong></td>
                                    <td>{formatTimestamp(item.createdAt)}</td>
                                </tr>
                                <tr>
                                    <td><strong>Processing Time</strong></td>
                                    <td>{formatProcessingTime(item.processingTimeMs)}</td>
                                </tr>
                                <tr>
                                    <td><strong>Record ID</strong></td>
                                    <td><code className="small">{item._id}</code></td>
                                </tr>
                            </tbody>
                        </Table>
                    </Col>
                </Row>
            </Modal.Body>
        </Modal>
    );
}