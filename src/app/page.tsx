// src/app/page.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Button, Alert, Navbar, Nav } from 'react-bootstrap';
import Camera from '@/components/Camera';
import ResultsPanel from '@/components/ResultsPanel';
import QueueManager from '@/components/QueueManager';
import HistoryPanel from '@/components/HistoryPanel';
import FileUpload from '@/components/FileUpload';
import { CapturedImage, ProcessingQueue, HistoryItem } from '@/types';
import { generateId } from '@/lib/utils';

// Type for window object with face-api extensions
interface WindowWithFaceApi extends Window {
  faceApiLoaded?: boolean;
  faceApiError?: string | null;
}

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
  const [error, setError] = useState<string | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);

  // Check if face-api.js models are loaded
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    const checkModels = () => {
      const loaded = (window as WindowWithFaceApi).faceApiLoaded === true;
      setModelsLoaded(loaded);
    };

    // Check immediately
    checkModels();

    // Listen for model loading events
    const handleModelLoaded = () => {
      console.log('Models loaded event received');
      setModelsLoaded(true);
    };

    const handleModelError = (event: CustomEvent<string>) => {
      console.error('Models loading error:', event.detail);
      setError(event.detail || 'Failed to load AI models');
      setModelsLoaded(false);
    };

    window.addEventListener('faceApiLoaded', handleModelLoaded);
    window.addEventListener('faceApiError', handleModelError as EventListener);

    // Also check periodically if events don't fire
    const interval = setInterval(() => {
      if (!(window as WindowWithFaceApi).faceApiLoaded) {
        checkModels();
      } else {
        clearInterval(interval);
      }
    }, 1000);

    return () => {
      window.removeEventListener('faceApiLoaded', handleModelLoaded);
      window.removeEventListener('faceApiError', handleModelError as EventListener);
      clearInterval(interval);
    };
  }, []);

  // Load history on component mount
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch('/api/history');
      const data = await response.json();

      if (response.ok && data.success) {
        // Ensure data.data is an array
        const historyArray = Array.isArray(data.data) ? data.data : [];
        setHistory(historyArray);
      } else {
        setError(data.error || 'Failed to load history');
        setHistory([]); // Set empty array on error
      }
    } catch (error) {
      console.error('Error loading history:', error);
      setError('Network error while loading history');
      setHistory([]); // Set empty array on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  const processQueue = useCallback(async () => {
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
  }, [queue.currentProcessingId, queue.items, loadHistory]);

  // Process queue
  useEffect(() => {
    processQueue();
  }, [processQueue]);

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
    <>
      {/* Navigation Bar */}
      <Navbar bg="primary" variant="dark" expand="lg" className="mb-4">
        <Container>
          <Navbar.Brand href="#home">
            <i className="bi bi-camera-video me-2"></i>
            IdentiFind
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="ms-auto">
              <Button
                variant={showHistory ? "light" : "outline-light"}
                onClick={toggleHistory}
                className="me-2"
              >
                <i className="bi bi-clock-history me-1"></i>
                {showHistory ? 'Hide History' : 'Show History'}
              </Button>
              <Button
                variant={isCameraOn ? "danger" : "success"}
                onClick={toggleCamera}
                disabled={!modelsLoaded}
              >
                <i className={`bi bi-camera${isCameraOn ? '-video-off' : '-video'} me-1`}></i>
                {isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
              </Button>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <Container fluid>
        {/* Error Alert */}
        {error && (
          <Alert variant="danger" dismissible onClose={() => setError(null)}>
            <Alert.Heading>Error</Alert.Heading>
            {error}
          </Alert>
        )}

        {/* Models Loading Alert */}
        {!modelsLoaded && (
          <Alert variant="info" className="mb-4">
            <div className="d-flex align-items-center">
              <div className="spinner-border spinner-border-sm me-3" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <div>
                <Alert.Heading className="h6 mb-1">Loading AI Models</Alert.Heading>
                <p className="mb-0">
                  Face detection models are being loaded. This may take a few moments on first visit.
                  Camera will be available once models are ready.
                </p>
              </div>
            </div>
          </Alert>
        )}

        {showHistory ? (
          <HistoryPanel
            history={history}
            isLoading={isLoading}
            onRefresh={loadHistory}
          />
        ) : (
          <Row>
            {/* Left Panel - Results & Queue */}
            <Col lg={6} className="mb-4">
              <Row>
                <Col xs={12} className="mb-4">
                  <ResultsPanel
                    results={completedResults}
                    onClear={handleClearResults}
                  />
                </Col>
                <Col xs={12}>
                  <QueueManager
                    queue={queue}
                    onClear={handleClearQueue}
                  />
                </Col>
              </Row>
            </Col>

            {/* Right Panel - Camera/Upload */}
            <Col lg={6} className="mb-4">
              {isCameraOn && modelsLoaded ? (
                <Camera
                  onImageCaptured={handleImageCaptured}
                  isActive={true}
                />
              ) : (
                <Card className="h-100">
                  <Card.Header className={`${!modelsLoaded ? 'bg-info' : 'bg-warning'} text-${!modelsLoaded ? 'white' : 'dark'}`}>
                    <h5 className="mb-0">
                      <i className={`bi bi-${!modelsLoaded ? 'hourglass-split' : 'camera-video-off'} me-2`}></i>
                      {!modelsLoaded ? 'AI Models Loading...' : 'Camera is Off'}
                    </h5>
                  </Card.Header>
                  <Card.Body>
                    {!modelsLoaded ? (
                      <div className="text-center py-4">
                        <div className="spinner-border text-primary mb-3" role="status">
                          <span className="visually-hidden">Loading...</span>
                        </div>
                        <h6>Loading Face Detection Models</h6>
                        <p className="text-muted mb-4">
                          This usually takes 10-30 seconds on first visit. The models are being downloaded
                          and initialized for optimal face detection performance.
                        </p>
                        <div className="progress mb-3" style={{ height: '8px' }}>
                          <div
                            className="progress-bar progress-bar-striped progress-bar-animated"
                            role="progressbar"
                            style={{ width: '100%' }}
                          ></div>
                        </div>
                        <small className="text-muted">
                          Please wait while we prepare the enhanced face detection system...
                        </small>
                      </div>
                    ) : (
                      <>
                        <p className="text-muted">
                          Upload an image to analyze, or turn on the camera to capture faces.
                          Queue processing will continue in the background.
                        </p>
                        <FileUpload onFileUploaded={handleFileUploaded} />
                      </>
                    )}
                  </Card.Body>
                </Card>
              )}
            </Col>
          </Row>
        )}
      </Container>
    </>
  );
}