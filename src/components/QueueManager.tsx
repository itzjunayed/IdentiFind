// src/components/QueueManager.tsx

'use client';

import { ProcessingQueue } from '@/types';
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
        <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                    Processing Queue ({queue.items.length})
                </h2>
                {queue.items.length > 0 && (
                    <button
                        onClick={onClear}
                        className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                    >
                        Clear Queue
                    </button>
                )}
            </div>

            {queue.items.length === 0 ? (
                <div className="text-center py-8">
                    <div className="text-gray-400 text-6xl mb-4">⏳</div>
                    <p className="text-gray-500">Queue is empty</p>
                    <p className="text-sm text-gray-400 mt-2">
                        Captured images will appear here before processing
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Currently Processing */}
                    {processingItems.length > 0 && (
                        <div>
                            <h3 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                                <div className="w-2 h-2 bg-yellow-500 rounded-full mr-2 animate-pulse"></div>
                                Currently Processing
                            </h3>
                            <div className="space-y-2">
                                {processingItems.map((item) => (
                                    <QueueItem key={item.id} item={item} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Pending Items */}
                    {pendingItems.length > 0 && (
                        <div>
                            <h3 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                                <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                                Waiting in Queue ({pendingItems.length})
                            </h3>
                            <div className="space-y-2">
                                {pendingItems.map((item, index) => (
                                    <QueueItem key={item.id} item={item} position={index + 1} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Error Items */}
                    {errorItems.length > 0 && (
                        <div>
                            <h3 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                                <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                                Failed ({errorItems.length})
                            </h3>
                            <div className="space-y-2">
                                {errorItems.map((item) => (
                                    <QueueItem key={item.id} item={item} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Queue Statistics */}
            {queue.items.length > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-200">
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <div className="text-2xl font-bold text-blue-600">{pendingItems.length}</div>
                            <div className="text-xs text-gray-500">Pending</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-yellow-600">{processingItems.length}</div>
                            <div className="text-xs text-gray-500">Processing</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-red-600">{errorItems.length}</div>
                            <div className="text-xs text-gray-500">Errors</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

interface QueueItemProps {
    item: any;
    position?: number;
}

function QueueItem({ item, position }: QueueItemProps) {
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending':
                return 'bg-blue-100 text-blue-800';
            case 'processing':
                return 'bg-yellow-100 text-yellow-800';
            case 'error':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pending':
                return '⏳';
            case 'processing':
                return '⚡';
            case 'error':
                return '❌';
            default:
                return '❓';
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
        <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
            {/* Position Badge */}
            {position && (
                <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center font-medium">
                    {position}
                </div>
            )}

            {/* Image Thumbnail */}
            <div className="flex-shrink-0">
                <img
                    src={item.imageData}
                    alt="Queued image"
                    className="w-12 h-12 object-cover rounded border"
                />
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                        {getStatusIcon(item.status)} {item.status}
                    </span>
                    {processingSeconds !== null && (
                        <span className="text-xs text-gray-500">
                            {processingSeconds}s elapsed
                        </span>
                    )}
                </div>

                <div className="text-xs text-gray-500">
                    Captured: {formatTimestamp(item.timestamp)}
                </div>

                {item.status === 'error' && item.result && (
                    <div className="text-xs text-red-600 mt-1">
                        Error: {item.result}
                    </div>
                )}
            </div>

            {/* Processing Animation */}
            {item.status === 'processing' && (
                <div className="flex-shrink-0">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-600"></div>
                </div>
            )}
        </div>
    );
}