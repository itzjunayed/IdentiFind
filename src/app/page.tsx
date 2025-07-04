// src/app/page.tsx

'use client';

import { useState, useEffect } from 'react';
import Camera from '@/components/Camera';
import ResultsPanel from '@/components/ResultsPanel';
import QueueManager from '@/components/QueueManager';
import HistoryPanel from '@/components/HistoryPanel';
import FileUpload from '@/components/FileUpload';
import { CapturedImage, ProcessingQueue, HistoryItem } from '@/types';
import { generateId } from '@/lib/utils';

export default function Home() {
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [queue, setQueue] = useState<ProcessingQueue>({
    items: [],
    currentProcessingId: null,
  });
  const [completedResults, setCompletedResults] = useState<CapturedImage[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Load history on component mount
  useEffect(() => {
    loadHistory();
  }, []);

  // Process queue
  useEffect(() => {
    processQueue();
  }, [queue.items, queue.currentProcessingId]);

  const loadHistory = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/history');
      if (response.ok) {
        const data = await response.json();
        setHistory(data.data || []);
      }
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const processQueue = async () => {
    if (queue.currentProcessingId || queue.items.length === 0) {
      return;
    }

    const nextItem = queue.items.find(item => item.status === 'pending');
    if (!nextItem) {
      return;
    }

    // Update status to processing
    setQueue(prev => ({
      ...prev,
      currentProcessingId: nextItem.id,
      items: prev.items.map(item =>
        item.id === nextItem.id
          ? { ...item, status: 'processing', processingStartTime: new Date() }
          : item
      ),
    }));

    try {
      const startTime = Date.now();

      // Send to API for processing
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
      const processingTime = Date.now() - startTime;

      if (response.ok && result.success) {
        const completedItem: CapturedImage = {
          ...nextItem,
          status: 'completed',
          result: result.data.result,
          processingEndTime: new Date(),
          processingTimeMs: processingTime,
        };

        // Move to completed results
        setCompletedResults(prev => [completedItem, ...prev]);

        // Remove from queue
        setQueue(prev => ({
          items: prev.items.filter(item => item.id !== nextItem.id),
          currentProcessingId: null,
        }));

        // Reload history to include new result
        await loadHistory();
      } else {
        // Handle error
        setQueue(prev => ({
          ...prev,
          currentProcessingId: null,
          items: prev.items.map(item =>
            item.id === nextItem.id
              ? { ...item, status: 'error', result: result.error || 'Processing failed' }
              : item
          ),
        }));
      }
    } catch (error) {
      console.error('Error processing image:', error);
      setQueue(prev => ({
        ...prev,
        currentProcessingId: null,
        items: prev.items.map(item =>
          item.id === nextItem.id
            ? { ...item, status: 'error', result: 'Network error occurred' }
            : item
        ),
      }));
    }
  };

  const handleImageCaptured = (imageData: string) => {
    const newImage: CapturedImage = {
      id: generateId(),
      imageData,
      timestamp: new Date(),
      status: 'pending',
    };

    setQueue(prev => ({
      ...prev,
      items: [...prev.items, newImage],
    }));
  };

  const handleFileUploaded = (imageData: string) => {
    handleImageCaptured(imageData);
  };

  const handleClearQueue = () => {
    setQueue(prev => ({
      ...prev,
      items: prev.items.filter(item => item.status === 'processing'),
    }));
  };

  const handleClearResults = () => {
    setCompletedResults([]);
  };

  const toggleCamera = () => {
    setIsCameraOn(prev => !prev);
  };

  const toggleHistory = () => {
    setShowHistory(prev => !prev);
    if (!showHistory) {
      loadHistory();
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-900">
              Face Detection & Analysis
            </h1>
            <div className="flex items-center space-x-4">
              <button
                onClick={toggleHistory}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${showHistory
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
              >
                {showHistory ? 'Hide History' : 'Show History'}
              </button>
              <button
                onClick={toggleCamera}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${isCameraOn
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
              >
                {isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {showHistory ? (
          <HistoryPanel
            history={history}
            isLoading={isLoading}
            onRefresh={loadHistory}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Panel - Results */}
            <div className="space-y-6">
              <ResultsPanel
                results={completedResults}
                onClear={handleClearResults}
              />

              <QueueManager
                queue={queue}
                onClear={handleClearQueue}
              />
            </div>

            {/* Right Panel - Camera/Upload */}
            <div className="space-y-6">
              {isCameraOn ? (
                <Camera
                  onImageCaptured={handleImageCaptured}
                  isActive={true}
                />
              ) : (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    Camera is Off
                  </h2>
                  <p className="text-gray-600 mb-6">
                    Upload an image to analyze, or turn on the camera to capture faces.
                    Queue processing will continue in the background.
                  </p>
                  <FileUpload onFileUploaded={handleFileUploaded} />
                </div>
              )}

              {/* Status Information */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-3">
                  System Status
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Camera:</span>
                    <span className={`font-medium ${isCameraOn ? 'text-green-600' : 'text-red-600'
                      }`}>
                      {isCameraOn ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Queue Length:</span>
                    <span className="font-medium text-blue-600">
                      {queue.items.length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Processing:</span>
                    <span className={`font-medium ${queue.currentProcessingId ? 'text-yellow-600' : 'text-gray-400'
                      }`}>
                      {queue.currentProcessingId ? 'In Progress' : 'Idle'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Completed Results:</span>
                    <span className="font-medium text-green-600">
                      {completedResults.length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}