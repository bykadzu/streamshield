/**
 * Audio Detection Pipeline — Scans transcribed audio for sensitive content
 *
 * Integrates AudioTranscriber with PatternEngine to detect PII/secrets
 * spoken during streams. Works alongside the visual detection pipeline.
 *
 * Audio matches trigger different actions than visual:
 * - Lower severity issues (password hints): quick mute
 * - Higher severity (full passwords): longer mute + visual overlay
 */

import { AudioTranscriber, TranscriptionResult } from "./transcriber";
import { PatternEngine, PatternMatch } from "../detection/patterns";
import { DetectionLog, DetectionEvent, ActionType } from "../storage/detection-log";

export interface AudioDetectionEvent {
  id: string;
  timestamp: number;
  transcription: TranscriptionResult;
  matches: PatternMatch[];
  highestSeverity: number;
  actionTaken: ActionType;
  audioSnippet?: string; // For debugging
}

export interface AudioPipelineConfig {
  /** Enable audio detection */
  enabled: boolean;
  /** Scan transcription buffer every N ms */
  scanIntervalMs: number;
  /** Mute duration for detected speech (ms) */
  muteDurationMs: number;
  /** Auto-recover timeout after blocking (ms) */
  autoRecoverTimeoutMs: number;
  /** Minimum severity to trigger action */
  minActionSeverity: number;
  /** Log all transcriptions (for debugging) */
  logAllTranscriptions: boolean;
  /** Audio source name in OBS (for muting) */
  audioSourceName: string;
}

const DEFAULT_AUDIO_CONFIG: AudioPipelineConfig = {
  enabled: true,
  scanIntervalMs: 1500,
  muteDurationMs: 5000,
  autoRecoverTimeoutMs: 10000,
  minActionSeverity: 1,
  logAllTranscriptions: false,
  audioSourceName: "Mic/Aux",
};

export type AudioDetectionListener = (event: AudioDetectionEvent) => void;

export class AudioDetectionPipeline {
  private transcriber: AudioTranscriber;
  private patterns: PatternEngine;
  private storage: DetectionLog;
  private config: AudioPipelineConfig;
  private listeners: Set<AudioDetectionListener> = new Set();
  private scanIntervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private frameIndex = 0;

  constructor(
    transcriber: AudioTranscriber,
    patterns: PatternEngine,
    storage: DetectionLog,
    config: Partial<AudioPipelineConfig> = {},
  ) {
    this.transcriber = transcriber;
    this.patterns = patterns;
    this.storage = storage;
    this.config = { ...DEFAULT_AUDIO_CONFIG, ...config };
  }

  /**
   * Start audio detection pipeline
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn("[AudioPipeline] Already running");
      return;
    }

    if (!this.config.enabled) {
      console.log("[AudioPipeline] Audio detection disabled");
      return;
    }

    console.log("[AudioPipeline] Starting audio detection...");

    // Initialize transcriber
    await this.transcriber.initialize();
    await this.transcriber.start();

    this.isRunning = true;
    this.frameIndex = 0;

    // Start periodic scanning
    this.scanIntervalId = setInterval(() => {
      this.scanTranscriptionBuffer().catch((err) => {
        console.error("[AudioPipeline] Scan error:", err);
      });
    }, this.config.scanIntervalMs);

    console.log(`[AudioPipeline] Started with ${this.config.scanIntervalMs}ms scan interval`);
  }

  /**
   * Stop audio detection pipeline
   */
  stop(): void {
    if (!this.isRunning) return;

    console.log("[AudioPipeline] Stopping...");

    if (this.scanIntervalId) {
      clearInterval(this.scanIntervalId);
      this.scanIntervalId = null;
    }

    this.transcriber.stop();
    this.isRunning = false;

    console.log("[AudioPipeline] Stopped");
  }

  /**
   * Add listener for audio detection events
   */
  onDetection(listener: AudioDetectionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Check if pipeline is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Get current configuration
   */
  getConfig(): AudioPipelineConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AudioPipelineConfig>): void {
    this.config = { ...this.config, ...config };

    // Restart with new interval if needed
    if (config.scanIntervalMs && this.isRunning) {
      this.stop();
      this.start().catch(console.error);
    }
  }

  /**
   * Scan transcription buffer for patterns
   */
  private async scanTranscriptionBuffer(): Promise<void> {
    if (!this.isRunning) return;

    const now = Date.now();
    const text = this.transcriber.flushBuffer();

    if (!text.trim()) {
      return; // No new transcriptions
    }

    const frameIndex = this.frameIndex++;

    console.log(`[AudioPipeline] Scanning transcription (${text.length} chars)`);

    // Run pattern matching on transcribed text
    const matches = this.patterns.scanText(text);

    // Determine highest severity
    const highestSeverity = matches.length > 0
      ? Math.max(...matches.map((m) => m.severity))
      : -1;

    // Determine action (audio uses different thresholds)
    const actionTaken = this.audioSeverityToAction(highestSeverity);

    // Create detection event
    const event: AudioDetectionEvent = {
      id: `audio-${frameIndex}-${now}`,
      timestamp: now,
      transcription: {
        text,
        confidence: 1.0, // Already processed
        isFinal: true,
        timestamp: now,
      },
      matches,
      highestSeverity,
      actionTaken,
    };

    // Log detection if there were matches
    if (matches.length > 0) {
      await this.logAudioDetection(event);
    }

    // Emit to listeners
    for (const listener of this.listeners) {
      listener(event);
    }

    console.log(
      `[AudioPipeline] Frame ${frameIndex}: ${matches.length} matches, severity: ${highestSeverity}, action: ${actionTaken}`
    );
  }

  /**
   * Convert severity to action for audio detections
   * Audio uses slightly different thresholds - speech is less critical than screen text
   */
  private audioSeverityToAction(severity: number): ActionType {
    if (severity < this.config.minActionSeverity) return "none";
    if (severity === 0) return "log";
    if (severity === 1) return "mute"; // Quick mute for hints/partial
    if (severity === 2) return "mute"; // Longer mute for more sensitive
    if (severity === 3) return "block"; // Block for full secrets spoken
    return "kill"; // Critical - stream takeover
  }

  /**
   * Log audio detection to storage
   */
  private async logAudioDetection(event: AudioDetectionEvent): Promise<void> {
    const detectionEvent: DetectionEvent = {
      id: event.id,
      timestamp: event.timestamp,
      frameIndex: this.frameIndex,
      ocrResult: {
        text: `[AUDIO] ${event.transcription.text}`,
        confidence: event.transcription.confidence,
        processingTimeMs: 0,
      },
      matches: event.matches,
      highestSeverity: event.highestSeverity,
      actionTaken: event.actionTaken,
      // Store transcription in metadata
      screenshotBase64: undefined,
    };

    await this.storage.logDetection(detectionEvent);
  }
}

// Export default instance factory
export function createAudioPipeline(
  transcriber: AudioTranscriber,
  patterns: PatternEngine,
  storage: DetectionLog,
  config?: Partial<AudioPipelineConfig>,
): AudioDetectionPipeline {
  return new AudioDetectionPipeline(transcriber, patterns, storage, config);
}
