/**
 * Detection Pipeline — Orchestrates the full frame → detect → action loop
 *
 * This is the main loop:
 * 1. Capture frame from OBS (every 500ms = 2 FPS)
 * 2. Run OCR on frame → extract text
 * 3. Run pattern engine on text → find matches
 * 4. Determine highest severity match
 * 5. Execute appropriate action (log, mute, blur, block, kill)
 * 6. Log detection to storage
 */

import { OBSClient } from "../obs/client";
import { OCRPipeline } from "./ocr";
import { PatternEngine } from "./patterns";
import { DetectionLog, DetectionEvent, ActionType } from "../storage/detection-log";

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
  /** Mute duration in ms (default: 3000) */
  muteDurationMs: number;
  /** Auto-recover timeout in ms (default: 5000) */
  autoRecoverTimeoutMs: number;
}

export type { DetectionListener } from "../storage/detection-log";

const DEFAULT_CONFIG: PipelineConfig = {
  fps: 2,
  obsSourceName: "Screen Capture",
  shieldSceneName: "StreamShield Blocked",
  ocrMinConfidence: 0.5,
  storeScreenshots: true,
  muteDurationMs: 3000,
  autoRecoverTimeoutMs: 5000,
};

export class DetectionPipeline {
  private obs: OBSClient;
  private ocr: OCRPipeline;
  private patterns: PatternEngine;
  private storage: DetectionLog;
  private config: PipelineConfig;
  private listeners: Set<(event: DetectionEvent) => void> = new Set();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private frameIndex = 0;
  private isRunning = false;
  private isProcessingFrame = false;
  private currentShield: { type: "blur" | "block"; appliedAt: number } | null = null;
  private recoverTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    obs: OBSClient,
    ocr: OCRPipeline,
    patterns: PatternEngine,
    storage: DetectionLog,
    config: Partial<PipelineConfig> = {},
  ) {
    this.obs = obs;
    this.ocr = ocr;
    this.patterns = patterns;
    this.storage = storage;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn("[Pipeline] Already running");
      return;
    }

    console.log("[Pipeline] Starting detection pipeline...");
    
    // Initialize OCR if not already
    if (!this.ocr.isReady()) {
      await this.ocr.initialize();
    }

    // Start a new session
    await this.storage.startSession();

    this.isRunning = true;
    this.frameIndex = 0;

    const intervalMs = 1000 / this.config.fps;
    this.intervalId = setInterval(() => {
      this.processFrame().catch((err) => {
        console.error("[Pipeline] Frame processing error:", err);
      });
    }, intervalMs);

    console.log(`[Pipeline] Started at ${this.config.fps} FPS`);
  }

  stop(): void {
    if (!this.isRunning) return;

    console.log("[Pipeline] Stopping detection pipeline...");

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Clear any active shields
    this.clearShield();

    // End session
    this.storage.endSession();

    this.isRunning = false;
    console.log("[Pipeline] Stopped");
  }

  onDetection(listener: (event: DetectionEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  isActive(): boolean {
    return this.isRunning;
  }

  getConfig(): PipelineConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<PipelineConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** Manual override: dismiss current shield */
  async dismissShield(): Promise<void> {
    console.log("[Pipeline] Dismissing shield manually");
    this.clearShield();
  }

  private async processFrame(): Promise<void> {
    // Skip if already processing (non-blocking)
    if (this.isProcessingFrame || !this.isRunning) {
      return;
    }

    this.isProcessingFrame = true;
    const frameIndex = this.frameIndex++;

    try {
      // 1. Capture screenshot from OBS
      const screenshot = await this.obs.getFrameScreenshot(
        this.config.obsSourceName,
        1280, // width - 720p is enough for text
        720,  // height
      );

      // 2. Run OCR
      const ocrResult = await this.ocr.processFrame(screenshot);

      if (!ocrResult) {
        // Frame was skipped (OCR busy)
        return;
      }

      // Skip if confidence too low
      if (ocrResult.confidence < this.config.ocrMinConfidence) {
        return;
      }

      // 3. Run pattern matching
      const matches = this.patterns.scanText(ocrResult.text);

      // 4. Determine highest severity
      const highestSeverity = matches.length > 0
        ? Math.max(...matches.map((m) => m.severity))
        : -1;

      // 5. Determine action
      const actionTaken = this.severityToAction(highestSeverity);

      // 6. Execute action if needed
      if (actionTaken !== "none" && actionTaken !== "log") {
        await this.executeAction(actionTaken);
      }

      // 7. Log detection (only if match found)
      const event: DetectionEvent = {
        id: `frame-${frameIndex}-${Date.now()}`,
        timestamp: Date.now(),
        frameIndex,
        ocrResult,
        matches,
        highestSeverity,
        actionTaken,
        screenshotBase64: this.config.storeScreenshots && matches.length > 0 ? screenshot : undefined,
      };

      if (matches.length > 0) {
        await this.storage.logDetection(event);
      }

      // 8. Emit event for UI
      for (const listener of this.listeners) {
        listener(event);
      }

      console.log(
        `[Pipeline] Frame ${frameIndex}: ${matches.length} matches, action: ${actionTaken}`,
      );
    } catch (error) {
      console.error(`[Pipeline] Frame ${frameIndex} error:`, error);
    } finally {
      this.isProcessingFrame = false;
    }
  }

  private async executeAction(action: ActionType): Promise<void> {
    console.log(`[Pipeline] Executing action: ${action}`);

    switch (action) {
      case "mute": {
        // Get main audio source - usually "Audio Input Capture" or "Desktop Audio"
        // For now, try to mute common audio sources
        try {
          const sources = await this.obs.getSourceList();
          const audioSource = sources.find((s) =>
            s.toLowerCase().includes("audio") || s.toLowerCase().includes("desktop")
          );
          if (audioSource) {
            await this.obs.muteSource(audioSource, true);
            // Auto-unmute after duration
            setTimeout(async () => {
              await this.obs.muteSource(audioSource, false);
              console.log("[Pipeline] Auto-unmuted audio");
            }, this.config.muteDurationMs);
          }
        } catch (err) {
          console.error("[Pipeline] Mute failed:", err);
        }
        break;
      }

      case "blur":
        try {
          await this.obs.applyBlurFilter(this.config.obsSourceName);
          this.currentShield = { type: "blur", appliedAt: Date.now() };
          this.scheduleAutoRecover();
        } catch (err) {
          console.error("[Pipeline] Blur failed:", err);
        }
        break;

      case "block":
        try {
          await this.obs.switchScene(this.config.shieldSceneName);
          this.currentShield = { type: "block", appliedAt: Date.now() };
          this.scheduleAutoRecover();
        } catch (err) {
          console.error("[Pipeline] Block failed:", err);
        }
        break;

      case "kill":
        try {
          await this.obs.endStream();
          console.log("[Pipeline] Stream ended due to critical detection");
        } catch (err) {
          console.error("[Pipeline] Kill failed:", err);
        }
        break;
    }
  }

  private scheduleAutoRecover(): void {
    // Clear any existing timer
    if (this.recoverTimer) {
      clearTimeout(this.recoverTimer);
    }

    this.recoverTimer = setTimeout(() => {
      this.clearShield();
    }, this.config.autoRecoverTimeoutMs);
  }

  private async clearShield(): Promise<void> {
    if (!this.currentShield) return;

    console.log(`[Pipeline] Clearing ${this.currentShield.type} shield`);

    try {
      if (this.currentShield.type === "blur") {
        await this.obs.removeBlurFilter(this.config.obsSourceName);
      } else if (this.currentShield.type === "block") {
        await this.obs.switchToOriginalScene();
      }
    } catch (err) {
      console.error("[Pipeline] Clear shield error:", err);
    }

    this.currentShield = null;
  }

  private severityToAction(severity: number): ActionType {
    if (severity < 0) return "none";
    if (severity === 0) return "log";
    if (severity === 1) return "mute";
    if (severity === 2) return "blur";
    if (severity === 3) return "block";
    return "kill"; // 4+
  }
}
