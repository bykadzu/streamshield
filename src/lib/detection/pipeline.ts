/**
 * Detection Pipeline — Orchestrates the full frame → detect → action loop
 *
 * This is the main loop:
 * 1. Capture frame from OBS (every 500ms = 2 FPS)
 * 2. Run OCR on frame → extract text
 * 3. Run pattern engine on text → find matches
 * 4. Determine highest severity match
 * 5. Execute appropriate action (log, mute, blur, block, kill)
 * 6. Log detection to SQLite
 *
 * The pipeline must complete within the stream delay window (typically 15-60s).
 * Our budget per frame: <1 second total.
 */

import { OBSClient } from "../obs/client";
import { OCRPipeline, OCRResult } from "./ocr";
import { PatternEngine, PatternMatch } from "./patterns";

export interface DetectionEvent {
  id: string;
  timestamp: number;
  frameIndex: number;
  ocrResult: OCRResult | null;
  matches: PatternMatch[];
  highestSeverity: number;
  actionTaken: ActionType;
  screenshotBase64?: string; // stored for review queue
}

export type ActionType = "none" | "log" | "mute" | "blur" | "block" | "kill";

export interface PipelineConfig {
  /** Frames per second to sample (default: 2) */
  fps: number;
  /** Source name in OBS to capture from */
  obsSourceName: string;
  /** Scene name to switch to when blocking */
  shieldSceneName: string;
  /** Minimum confidence for OCR text to be considered (0-1) */
  ocrMinConfidence: number;
  /** Whether to store screenshots of detections */
  storeScreenshots: boolean;
}

export type DetectionListener = (event: DetectionEvent) => void;

/**
 * TODO (Franky): Implement the detection pipeline
 *
 * Requirements:
 * 1. Start/stop the detection loop (frame sampling timer)
 * 2. Coordinate OBS capture → OCR → pattern matching → action
 * 3. Severity → action mapping:
 *    - 0 → log only (no visible action)
 *    - 1 → mute audio for 3 seconds
 *    - 2 → apply blur filter to source
 *    - 3 → switch to shield scene (full block)
 *    - 4 → end stream immediately
 * 4. Emit DetectionEvent for each processed frame (for UI updates)
 * 5. Skip frames if previous frame is still processing (never queue)
 * 6. Auto-recover from shield: remove blur/block after threat clears
 * 7. Performance metrics: track avg processing time per frame
 */
export class DetectionPipeline {
  private obs: OBSClient;
  private ocr: OCRPipeline;
  private patterns: PatternEngine;
  private config: PipelineConfig;
  private listeners: Set<DetectionListener> = new Set();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private frameIndex = 0;
  private isRunning = false;

  constructor(
    obs: OBSClient,
    ocr: OCRPipeline,
    patterns: PatternEngine,
    config: PipelineConfig,
  ) {
    this.obs = obs;
    this.ocr = ocr;
    this.patterns = patterns;
    this.config = config;
  }

  start(): void {
    // TODO: Start the frame sampling loop
    throw new Error("Not implemented — Franky, this is yours");
  }

  stop(): void {
    // TODO: Stop the loop, clean up any active shields
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
  }

  onDetection(listener: DetectionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  isActive(): boolean {
    return this.isRunning;
  }

  /** Manual override: dismiss current shield */
  async dismissShield(): Promise<void> {
    // TODO: Switch back to original scene, remove filters
    throw new Error("Not implemented");
  }

  private async processFrame(): Promise<void> {
    // TODO: Single frame processing cycle
    // 1. Capture screenshot from OBS
    // 2. Run OCR
    // 3. Run pattern matching
    // 4. Determine action
    // 5. Execute action
    // 6. Emit event
    throw new Error("Not implemented");
  }

  private severityToAction(severity: number): ActionType {
    switch (severity) {
      case 0: return "log";
      case 1: return "mute";
      case 2: return "blur";
      case 3: return "block";
      case 4: return "kill";
      default: return "none";
    }
  }
}
