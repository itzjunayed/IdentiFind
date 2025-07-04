# Face Detection & Analysis App

A real-time face detection and AI-powered analysis system built with Next.js, MediaPipe, and MongoDB.

## Features

- ✅ Live camera interface with face detection
- ✅ Face region detection and capture
- ✅ 5-second countdown timer
- ✅ Queue management system
- ✅ Processing status indicators
- ✅ MongoDB storage
- ✅ History panel with timestamps
- ✅ Camera on/off functionality
- ✅ File upload when camera is off
- ✅ HuggingFace API integration

## Quick Start

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables in `.env.local`
4. Run the development server: `npm run dev`
5. Open [http://localhost:3000](http://localhost:3000)

## Environment Setup

Create a `.env.local` file with the following variables:

```env
MONGODB_URI=your_mongodb_connection_string
HUGGINGFACE_API_KEY=your_huggingface_api_key
HUGGINGFACE_API_URL=your_huggingface_model_endpoint