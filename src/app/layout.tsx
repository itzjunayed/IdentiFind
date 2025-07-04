// src/app/layout.tsx

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Script from 'next/script';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Face Detection & Analysis',
  description: 'Real-time face detection and AI-powered analysis system',
  keywords: ['face detection', 'AI analysis', 'machine learning', 'computer vision'],
  authors: [{ name: 'Face Detection Team' }],
  viewport: 'width=device-width, initial-scale=1',
  robots: 'index, follow',
  openGraph: {
    title: 'Face Detection & Analysis',
    description: 'Real-time face detection and AI-powered analysis system',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Face Detection & Analysis',
    description: 'Real-time face detection and AI-powered analysis system',
  },
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <head>
        {/* Preload critical resources */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />

        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />

        {/* Theme color */}
        <meta name="theme-color" content="#2563eb" />
        <meta name="msapplication-TileColor" content="#2563eb" />
      </head>
      <body className={`${inter.className} antialiased`}>
        {/* Skip to main content for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded-md z-50"
        >
          Skip to main content
        </a>

        {/* MediaPipe Scripts - Load before React components */}
        <Script
          src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"
          strategy="beforeInteractive"
        />
        <Script
          src="https://cdn.jsdelivr.net/npm/@mediapipe/control_utils/control_utils.js"
          strategy="beforeInteractive"
        />
        <Script
          src="https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js"
          strategy="beforeInteractive"
        />
        <Script
          src="https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/face_detection.js"
          strategy="beforeInteractive"
        />

        {/* Main app container */}
        <div id="app" className="min-h-screen">
          <main id="main-content">
            {children}
          </main>
        </div>

        {/* Loading indicator portal */}
        <div id="loading-portal"></div>

        {/* Toast notifications portal */}
        <div id="toast-portal"></div>

        {/* Modal portal */}
        <div id="modal-portal"></div>

        {/* Development tools */}
        {process.env.NODE_ENV === 'development' && (
          <Script id="dev-tools" strategy="afterInteractive">
            {`
              // Add development helpers
              window.__DEV__ = true;
              console.log('🚀 Face Detection App - Development Mode');
              
              // Log MediaPipe loading status
              const checkMediaPipe = () => {
                if (window.FaceDetection && window.Camera) {
                  console.log('✅ MediaPipe loaded successfully');
                } else {
                  console.log('⏳ Waiting for MediaPipe to load...');
                  setTimeout(checkMediaPipe, 1000);
                }
              };
              setTimeout(checkMediaPipe, 1000);
            `}
          </Script>
        )}
      </body>
    </html>
  );
}