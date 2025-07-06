// src/app/api/history/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Result from '@/models/Result';
import { ApiResponse, HistoryItem } from '@/types';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const skip = (page - 1) * limit;

        // Connect to database
        await connectToDatabase();

        // Fetch results with pagination
        const results = await Result.find({})
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        // Transform data for frontend - ensure we return an array
        const historyItems: HistoryItem[] = Array.isArray(results) ? results.map(result => ({
            _id: result._id.toString(),
            imageData: result.imageData,
            result: result.result,
            processingTimeMs: result.processingTimeMs,
            createdAt: result.createdAt.toISOString(),
            capturedAt: result.capturedAt.toISOString(),
        })) : [];

        return NextResponse.json<ApiResponse<HistoryItem[]>>({
            success: true,
            data: historyItems, // Return array directly
            message: `Found ${historyItems.length} results`,
        });

    } catch (error) {
        console.error('Error fetching history:', error);
        return NextResponse.json<ApiResponse>({
            success: false,
            error: 'Failed to fetch history',
            data: [], // Return empty array on error
        }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json<ApiResponse>({
                success: false,
                error: 'ID is required',
            }, { status: 400 });
        }

        // Connect to database
        await connectToDatabase();

        // Delete the result
        const deletedResult = await Result.findByIdAndDelete(id);

        if (!deletedResult) {
            return NextResponse.json<ApiResponse>({
                success: false,
                error: 'Result not found',
            }, { status: 404 });
        }

        return NextResponse.json<ApiResponse>({
            success: true,
            message: 'Result deleted successfully',
        });

    } catch (error) {
        console.error('Error deleting result:', error);
        return NextResponse.json<ApiResponse>({
            success: false,
            error: 'Failed to delete result',
        }, { status: 500 });
    }
}

// Clear all history
export async function POST(request: NextRequest) {
    try {
        const { action } = await request.json();

        if (action !== 'clear_all') {
            return NextResponse.json<ApiResponse>({
                success: false,
                error: 'Invalid action',
            }, { status: 400 });
        }

        // Connect to database
        await connectToDatabase();

        // Delete all results
        const result = await Result.deleteMany({});

        return NextResponse.json<ApiResponse>({
            success: true,
            message: `Cleared ${result.deletedCount} results`,
            data: { deletedCount: result.deletedCount },
        });

    } catch (error) {
        console.error('Error clearing history:', error);
        return NextResponse.json<ApiResponse>({
            success: false,
            error: 'Failed to clear history',
        }, { status: 500 });
    }
}