/**
 * OCR Pipeline — Frame to text extraction using Tesseract.js
 *
 * Takes a base64 image (from OBS screenshot) and extracts readable text.
 * This is fed into the PatternEngine for detection.
 *
 * @see https://github.com/naptha/tesseract.js
 */

import { createWorker, Worker, PSM } from "tesseract.js";

export interface OCRResult {
  text: string;
  confidence: number;
  processingTimeMs: number;
}

export class OCRPipeline {
  private worker: Worker | null = null;
  private isProcessing = false;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log("[OCR] Initializing Tesseract worker...");

    this.worker = await createWorker("eng", 1, {
      logger: (m) => {
        if (m.status === "recognizing text") {
          console.log(`[OCR] Progress: ${Math.round(m.progress * 100)}%`);
        }
      },
    });

    // Configure for single block of text (faster for screen content)
    await this.worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
    });

    this.initialized = true;
    console.log("[OCR] Worker initialized and ready");
  }

  async processFrame(imageBase64: string): Promise<OCRResult | null> {
    // Skip if already processing (non-blocking, don't queue)
    if (this.isProcessing || !this.worker) {
      return null;
    }

    this.isProcessing = true;
    const startTime = Date.now();

    try {
      // Strip data URL prefix if present
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      
      // Use the base64 string directly with Tesseract
      const result = await this.worker.recognize(base64Data);
      const processingTimeMs = Date.now() - startTime;

      console.log(`[OCR] Processed frame in ${processingTimeMs}ms, confidence: ${result.data.confidence}%`);

      return {
        text: result.data.text,
        confidence: result.data.confidence / 100, // Convert 0-100 to 0-1
        processingTimeMs,
      };
    } catch (error) {
      console.error("[OCR] Error processing frame:", error);
      return null;
    } finally {
      this.isProcessing = false;
    }
  }

  async shutdown(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.initialized = false;
      console.log("[OCR] Worker terminated");
    }
  }

  isReady(): boolean {
    return this.initialized && !this.isProcessing;
  }

  isProcessingFrame(): boolean {
    return this.isProcessing;
  }
}

// Export default instance
export const ocrPipeline = new OCRPipeline();
