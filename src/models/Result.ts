// src/models/Result.ts

import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IResult extends Document {
    imageData: string;
    result: string;
    processingTimeMs: number;
    capturedAt: Date;
    createdAt: Date;
}

const ResultSchema: Schema<IResult> = new Schema({
    imageData: {
        type: String,
        required: true,
    },
    result: {
        type: String,
        required: true,
    },
    processingTimeMs: {
        type: Number,
        required: true,
    },
    capturedAt: {
        type: Date,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true,
});

// Index for efficient querying
ResultSchema.index({ createdAt: -1 });
ResultSchema.index({ capturedAt: -1 });

const Result: Model<IResult> = mongoose.models.Result || mongoose.model<IResult>('Result', ResultSchema);

export default Result;