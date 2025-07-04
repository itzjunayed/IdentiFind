// src/components/HistoryPanel.tsx

'use client';

import { useState } from 'react';
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

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this result?')) return;

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

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Analysis History</h1>
                        <p className="text-gray-600 mt-1">
                            {history.length} total results
                        </p>
                    </div>
                    <div className="flex space-x-3">
                        <button
                            onClick={onRefresh}
                            disabled={isLoading}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
                        >
                            {isLoading ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            ) : (
                                <span>🔄</span>
                            )}
                            <span>Refresh</span>
                        </button>
                        {history.length > 0 && (
                            <>
                                <button
                                    onClick={handleExport}
                                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center space-x-2"
                                >
                                    <span>📊</span>
                                    <span>Export CSV</span>
                                </button>
                                <button
                                    onClick={handleClearAll}
                                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center space-x-2"
                                >
                                    <span>🗑️</span>
                                    <span>Clear All</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* History Grid */}
            {isLoading ? (
                <div className="bg-white rounded-lg shadow-md p-12 text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading history...</p>
                </div>
            ) : history.length === 0 ? (
                <div className="bg-white rounded-lg shadow-md p-12 text-center">
                    <div className="text-gray-400 text-6xl mb-4">📚</div>
                    <p className="text-gray-500 text-lg">No history found</p>
                    <p className="text-gray-400 mt-2">
                        Start capturing faces to build your analysis history
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {history.map((item) => (
                        <HistoryCard
                            key={item._id}
                            item={item}
                            onSelect={() => setSelectedItem(item)}
                            onDelete={() => handleDelete(item._id)}
                            isDeleting={isDeleting === item._id}
                        />
                    ))}
                </div>
            )}

            {/* Detail Modal */}
            {selectedItem && (
                <HistoryDetailModal
                    item={selectedItem}
                    onClose={() => setSelectedItem(null)}
                />
            )}
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
        <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
            {/* Image */}
            <div className="aspect-square bg-gray-100">
                <img
                    src={item.imageData}
                    alt="Analysis result"
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={onSelect}
                />
            </div>

            {/* Content */}
            <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                    <div className="text-sm text-gray-500">
                        {formatTimestamp(item.capturedAt)}
                    </div>
                    <div className="text-sm text-blue-600 font-medium">
                        {formatProcessingTime(item.processingTimeMs)}
                    </div>
                </div>

                <p className="text-sm text-gray-700 line-clamp-3 mb-3">
                    {item.result}
                </p>

                <div className="flex justify-between items-center">
                    <button
                        onClick={onSelect}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                        View Details
                    </button>
                    <button
                        onClick={onDelete}
                        disabled={isDeleting}
                        className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                    >
                        {isDeleting ? 'Deleting...' : 'Delete'}
                    </button>
                </div>
            </div>
        </div>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b">
                    <h2 className="text-xl font-semibold text-gray-900">Analysis Details</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 text-2xl"
                    >
                        ×
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Image */}
                        <div>
                            <img
                                src={item.imageData}
                                alt="Analysis result"
                                className="w-full rounded-lg border"
                            />
                            <button
                                onClick={handleDownloadImage}
                                className="mt-3 w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center space-x-2"
                            >
                                <span>⬇️</span>
                                <span>Download Image</span>
                            </button>
                        </div>

                        {/* Details */}
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-sm font-medium text-gray-900 mb-2">Analysis Result</h3>
                                <p className="text-gray-700 leading-relaxed">{item.result}</p>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <h4 className="text-sm font-medium text-gray-900">Captured At</h4>
                                    <p className="text-gray-600">{formatTimestamp(item.capturedAt)}</p>
                                </div>

                                <div>
                                    <h4 className="text-sm font-medium text-gray-900">Processed At</h4>
                                    <p className="text-gray-600">{formatTimestamp(item.createdAt)}</p>
                                </div>

                                <div>
                                    <h4 className="text-sm font-medium text-gray-900">Processing Time</h4>
                                    <p className="text-gray-600">{formatProcessingTime(item.processingTimeMs)}</p>
                                </div>

                                <div>
                                    <h4 className="text-sm font-medium text-gray-900">Record ID</h4>
                                    <p className="text-gray-600 font-mono text-sm">{item._id}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}