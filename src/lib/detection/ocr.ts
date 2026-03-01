/**
 * OCR Pipeline — Frame to text extraction using Tesseract.js
 *
 * Takes a base64 image (from OBS screenshot) and extracts readable text.
 * This is fed into the PatternEngine for detection.
 *
 * @see https://github.com/naptha/tesseract.js
 */

import { createWorker, Worker } from "tesseract.js";

export interface OCRResult {
  text: string;
  confidence: number;
  processingTimeMs: number;
}

/**
 * TODO (Franky): Implement the OCR pipeline
 *
 * Requirements:
 * 1. Initialize Tesseract.js worker on startup (warm start for performance)
 * 2. processFrame(imageBase64: string) -> OCRResult
 * 3. Target: <200ms per frame at 1920x1080
 * 4. Consider downscaling frames before OCR for speed (720p is enough for text)
 * 5. Support multiple languages (start with English, add more later)
 * 6. Worker pool: consider 2 workers for overlapping frame processing
 * 7. Graceful degradation: if OCR is slow, skip frames rather than queue
 */
export class OCRPipeline {
  private worker: Worker | null = null;
  private isProcessing = false;

  async initialize(): Promise<void> {
    // TODO: Create and initialize Tesseract worker
    // Pre-load English language data for fast first-frame processing
    throw new Error("Not implemented — Franky, this is yours");
  }

  async processFrame(imageBase64: string): Promise<OCRResult | null> {
    // TODO: Run OCR on the frame
    // Return null if already processing (skip frame, don't queue)
    throw new Error("Not implemented");
  }

  async shutdown(): Promise<void> {
    // TODO: Clean up Tesseract worker
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }

  isReady(): boolean {
    return this.worker !== null && !this.isProcessing;
  }
}
