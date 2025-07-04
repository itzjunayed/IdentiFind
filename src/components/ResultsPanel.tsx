// src/components/ResultsPanel.tsx

'use client';

import { useState } from 'react';
import { CapturedImage } from '@/types';
import { formatTimestamp, formatProcessingTime } from '@/lib/utils';

interface ResultsPanelProps {
    results: CapturedImage[];
    onClear: () => void;
}

export default function ResultsPanel({ results, onClear }: ResultsPanelProps) {
    if (results.length === 0) {
        return (
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-gray-900">Analysis Results</h2>
                </div>
                <div className="text-center py-8">
                    <div className="text-gray-400 text-6xl mb-4">📊</div>
                    <p className="text-gray-500">No results yet</p>
                    <p className="text-sm text-gray-400 mt-2">
                        Capture a face or upload an image to see analysis results here
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                    Analysis Results ({results.length})
                </h2>
                <button
                    onClick={onClear}
                    className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
                >
                    Clear All
                </button>
            </div>

            <div className="space-y-4 max-h-96 overflow-y-auto">
                {results.map((result) => (
                    <ResultCard key={result.id} result={result} />
                ))}
            </div>
        </div>
    );
}

function ResultCard({ result }: { result: CapturedImage }) {
    return (
        <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex space-x-4">
                {/* Image */}
                <div className="flex-shrink-0">
                    <img
                        src={result.imageData}
                        alt="Captured face"
                        className="w-20 h-20 object-cover rounded-lg border"
                    />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-2">
                        <div className="text-sm text-gray-500">
                            Captured: {formatTimestamp(result.timestamp)}
                        </div>
                        {result.processingTimeMs && (
                            <div className="text-sm text-blue-600 font-medium">
                                {formatProcessingTime(result.processingTimeMs)}
                            </div>
                        )}
                    </div>

                    {/* Status */}
                    <div className="mb-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${result.status === 'completed'
                                ? 'bg-green-100 text-green-800'
                                : result.status === 'error'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-yellow-100 text-yellow-800'
                            }`}>
                            {result.status === 'completed' ? '✓ Completed' :
                                result.status === 'error' ? '✗ Error' : '⏳ Processing'}
                        </span>
                    </div>

                    {/* Result text */}
                    <div className="text-sm text-gray-700">
                        {result.result ? (
                            <p className="line-clamp-3">{result.result}</p>
                        ) : (
                            <p className="text-gray-400 italic">Processing...</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Expand button for long text */}
            {result.result && result.result.length > 150 && (
                <ExpandableText text={result.result} />
            )}
        </div>
    );
}

function ExpandableText({ text }: { text: string }) {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="mt-3 pt-3 border-t border-gray-100">
            <div className={`text-sm text-gray-700 ${isExpanded ? '' : 'line-clamp-3'}`}>
                {text}
            </div>
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
                {isExpanded ? 'Show Less' : 'Show More'}
            </button>
        </div>
    );
}

// Add this to your global CSS for line-clamp utility
const lineClampStyles = `
  .line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
`;