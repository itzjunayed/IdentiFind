// src/app/api/process-image/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Result from '@/models/Result';
import { ApiResponse, HuggingFaceResponse } from '@/types';

export async function POST(request: NextRequest) {
    try {
        const { imageData, capturedAt } = await request.json();

        if (!imageData) {
            return NextResponse.json<ApiResponse>({
                success: false,
                error: 'Image data is required',
            }, { status: 400 });
        }

        const processingStartTime = Date.now();

        // Connect to database
        await connectToDatabase();

        // For demo purposes, simulate HuggingFace API call with timeout
        // In production, replace this with actual HuggingFace API call
        const result = await simulateHuggingFaceAPI();

        const processingTimeMs = Date.now() - processingStartTime;

        // Save result to database
        const savedResult = await Result.create({
            imageData,
            result: result.generated_text,
            processingTimeMs,
            capturedAt: new Date(capturedAt),
        });

        return NextResponse.json<ApiResponse>({
            success: true,
            data: {
                id: savedResult._id,
                result: result.generated_text,
                processingTimeMs,
            },
        });

    } catch (error) {
        console.error('Error processing image:', error);
        return NextResponse.json<ApiResponse>({
            success: false,
            error: 'Internal server error',
        }, { status: 500 });
    }
}

// Simulate HuggingFace API call
async function simulateHuggingFaceAPI(): Promise<HuggingFaceResponse> {
    // Simulate processing time (1 minute as requested)
    await new Promise(resolve => setTimeout(resolve, 60000));

    // Generate a realistic response
    const responses = [
        "This image shows a person with a friendly expression. The individual appears confident and approachable, with clear facial features that suggest good lighting conditions during capture. The image quality is suitable for analysis purposes.",

        "The facial analysis reveals a subject with well-defined features and a neutral to positive expression. The person appears to be looking directly at the camera, which indicates good positioning during the capture process. The image demonstrates proper framing and clarity.",

        "This portrait captures an individual with distinctive facial characteristics. The subject's expression appears calm and composed, suggesting they were comfortable during the photo capture. The image quality meets the standards required for detailed facial analysis.",

        "The analysis shows a person with clear, well-lit facial features. The individual's expression conveys a sense of confidence and engagement. The capture angle and lighting conditions are optimal for recognition and analysis purposes.",

        "This image presents a subject with harmonious facial proportions and a pleasant expression. The person appears relaxed and natural in front of the camera. The technical quality of the image supports accurate facial feature detection and analysis.",
    ];

    const randomResponse = responses[Math.floor(Math.random() * responses.length)];

    // Uncomment and modify this section for actual HuggingFace API integration:
    /*
    try {
      // Convert base64 image to blob
      const base64Data = imageData.split(',')[1];
      const imageBuffer = Buffer.from(base64Data, 'base64');
      
      const response = await fetch(process.env.HUGGINGFACE_API_URL!, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: base64Data,
          // Add other parameters as needed for your specific model
        }),
      });
  
      if (!response.ok) {
        throw new Error(`HuggingFace API error: ${response.statusText}`);
      }
  
      const result = await response.json();
      return { generated_text: result[0]?.generated_text || 'No description generated' };
    } catch (error) {
      console.error('HuggingFace API error:', error);
      throw new Error('Failed to process image with HuggingFace API');
    }
    */

    return { generated_text: randomResponse };
}