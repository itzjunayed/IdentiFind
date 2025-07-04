// src/hooks/useQueue.ts

import { useState, useCallback, useEffect, useRef } from 'react';
import { CapturedImage, ProcessingQueue } from '@/types';
import { generateId } from '@/lib/utils';

interface UseQueueOptions {
    maxQueueSize?: number;
    autoProcess?: boolean;
    processingTimeout?: number;
}

interface UseQueueReturn {
    queue: ProcessingQueue;
    addToQueue: (imageData: string) => string;
    removeFromQueue: (id: string) => void;
    clearQueue: () => void;
    processNext: () => Promise<void>;
    updateQueueItem: (id: string, updates: Partial<CapturedImage>) => void;
    getQueueStats: () => {
        total: number;
        pending: number;
        processing: number;
        completed: number;
        errors: number;
    };
}

export function useQueue(options: UseQueueOptions = {}): UseQueueReturn {
    const {
        maxQueueSize = 10,
        autoProcess = true,
        processingTimeout = 120000, // 2 minutes
    } = options;

    const [queue, setQueue] = useState<ProcessingQueue>({
        items: [],
        currentProcessingId: null,
    });

    const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isProcessingRef = useRef(false);

    // Add item to queue
    const addToQueue = useCallback((imageData: string): string => {
        const id = generateId();
        const newItem: CapturedImage = {
            id,
            imageData,
            timestamp: new Date(),
            status: 'pending',
        };

        setQueue(prev => {
            // Check queue size limit
            if (prev.items.length >= maxQueueSize) {
                console.warn(`Queue is full (${maxQueueSize} items). Removing oldest pending item.`);
                const filteredItems = prev.items.filter(item =>
                    item.status !== 'pending' || prev.items.indexOf(item) === prev.items.length - 1
                );
                return {
                    ...prev,
                    items: [...filteredItems, newItem],
                };
            }

            return {
                ...prev,
                items: [...prev.items, newItem],
            };
        });

        return id;
    }, [maxQueueSize]);

    // Remove item from queue
    const removeFromQueue = useCallback((id: string): void => {
        setQueue(prev => ({
            ...prev,
            items: prev.items.filter(item => item.id !== id),
            currentProcessingId: prev.currentProcessingId === id ? null : prev.currentProcessingId,
        }));
    }, []);

    // Clear queue (keep processing item)
    const clearQueue = useCallback((): void => {
        setQueue(prev => ({
            ...prev,
            items: prev.items.filter(item => item.status === 'processing'),
        }));
    }, []);

    // Update queue item
    const updateQueueItem = useCallback((id: string, updates: Partial<CapturedImage>): void => {
        setQueue(prev => ({
            ...prev,
            items: prev.items.map(item =>
                item.id === id ? { ...item, ...updates } : item
            ),
        }));
    }, []);

    // Process next item in queue
    const processNext = useCallback(async (): Promise<void> => {
        if (isProcessingRef.current) {
            return;
        }

        const nextItem = queue.items.find(item => item.status === 'pending');
        if (!nextItem || queue.currentProcessingId) {
            return;
        }

        isProcessingRef.current = true;

        try {
            // Update status to processing
            setQueue(prev => ({
                ...prev,
                currentProcessingId: nextItem.id,
            }));

            updateQueueItem(nextItem.id, {
                status: 'processing',
                processingStartTime: new Date(),
            });

            // Set processing timeout
            processingTimeoutRef.current = setTimeout(() => {
                console.warn(`Processing timeout for item ${nextItem.id}`);
                updateQueueItem(nextItem.id, {
                    status: 'error',
                    result: 'Processing timeout exceeded',
                });

                setQueue(prev => ({
                    ...prev,
                    currentProcessingId: null,
                }));

                isProcessingRef.current = false;
            }, processingTimeout);

            // Send to API for processing
            const startTime = Date.now();
            const response = await fetch('/api/process-image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    imageData: nextItem.imageData,
                    capturedAt: nextItem.timestamp,
                }),
            });

            const result = await response.json();
            const processingTimeMs = Date.now() - startTime;

            // Clear timeout
            if (processingTimeoutRef.current) {
                clearTimeout(processingTimeoutRef.current);
                processingTimeoutRef.current = null;
            }

            if (response.ok && result.success) {
                // Success - update item
                updateQueueItem(nextItem.id, {
                    status: 'completed',
                    result: result.data.result,
                    processingEndTime: new Date(),
                    processingTimeMs,
                });
            } else {
                // Error - update item with error
                updateQueueItem(nextItem.id, {
                    status: 'error',
                    result: result.error || 'Processing failed',
                    processingEndTime: new Date(),
                    processingTimeMs,
                });
            }

        } catch (error) {
            console.error('Error processing queue item:', error);

            // Clear timeout
            if (processingTimeoutRef.current) {
                clearTimeout(processingTimeoutRef.current);
                processingTimeoutRef.current = null;
            }

            // Update item with error
            updateQueueItem(nextItem.id, {
                status: 'error',
                result: error instanceof Error ? error.message : 'Unknown processing error',
                processingEndTime: new Date(),
            });
        } finally {
            // Reset processing state
            setQueue(prev => ({
                ...prev,
                currentProcessingId: null,
            }));

            isProcessingRef.current = false;
        }
    }, [queue.items, queue.currentProcessingId, updateQueueItem, processingTimeout]);

    // Get queue statistics
    const getQueueStats = useCallback(() => {
        const stats = queue.items.reduce(
            (acc, item) => {
                acc.total++;
                switch (item.status) {
                    case 'pending':
                        acc.pending++;
                        break;
                    case 'processing':
                        acc.processing++;
                        break;
                    case 'completed':
                        acc.completed++;
                        break;
                    case 'error':
                        acc.errors++;
                        break;
                }
                return acc;
            },
            { total: 0, pending: 0, processing: 0, completed: 0, errors: 0 }
        );

        return stats;
    }, [queue.items]);

    // Auto-process queue when new items are added
    useEffect(() => {
        if (autoProcess && !isProcessingRef.current && !queue.currentProcessingId) {
            const hasPendingItems = queue.items.some(item => item.status === 'pending');
            if (hasPendingItems) {
                // Small delay to allow state updates
                const timer = setTimeout(() => {
                    processNext();
                }, 100);

                return () => clearTimeout(timer);
            }
        }
    }, [queue.items, queue.currentProcessingId, autoProcess, processNext]);

    // Cleanup timeouts on unmount
    useEffect(() => {
        return () => {
            if (processingTimeoutRef.current) {
                clearTimeout(processingTimeoutRef.current);
            }
        };
    }, []);

    // Periodic cleanup of old completed/error items
    useEffect(() => {
        const cleanup = () => {
            const maxAge = 5 * 60 * 1000; // 5 minutes
            const now = Date.now();

            setQueue(prev => ({
                ...prev,
                items: prev.items.filter(item => {
                    // Keep pending and processing items
                    if (item.status === 'pending' || item.status === 'processing') {
                        return true;
                    }

                    // Remove old completed/error items
                    const itemAge = now - item.timestamp.getTime();
                    return itemAge < maxAge;
                }),
            }));
        };

        const cleanupInterval = setInterval(cleanup, 60000); // Run every minute

        return () => clearInterval(cleanupInterval);
    }, []);

    return {
        queue,
        addToQueue,
        removeFromQueue,
        clearQueue,
        processNext,
        updateQueueItem,
        getQueueStats,
    };
}