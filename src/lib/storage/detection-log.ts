/**
 * Detection Log — SQLite storage for detection events
 *
 * Stores all detection events for post-stream review.
 * In Tauri, this uses the built-in SQLite plugin.
 * In browser-only mode (dev), falls back to IndexedDB or in-memory.
 *
 * Schema:
 * - detections: id, timestamp, frame_index, severity, action_taken,
 *               pattern_name, matched_text, ocr_confidence, screenshot_path
 * - sessions: id, started_at, ended_at, total_frames, total_detections
 */

import type { DetectionEvent } from "../detection/pipeline";

export interface DetectionRecord {
  id: string;
  sessionId: string;
  timestamp: number;
  frameIndex: number;
  severity: number;
  actionTaken: string;
  patternName: string;
  matchedText: string;
  ocrConfidence: number;
  screenshotPath?: string;
}

export interface SessionRecord {
  id: string;
  startedAt: number;
  endedAt?: number;
  totalFrames: number;
  totalDetections: number;
  highestSeverityHit: number;
}

/**
 * TODO (Franky/Ren): Implement detection storage
 *
 * Requirements:
 * 1. Initialize SQLite database (create tables if not exists)
 * 2. logDetection(event: DetectionEvent) — store a detection event
 * 3. startSession() -> sessionId — begin a new monitoring session
 * 4. endSession(sessionId: string) — mark session as ended, compute stats
 * 5. getSessionDetections(sessionId: string) -> DetectionRecord[]
 * 6. getRecentSessions(limit: number) -> SessionRecord[]
 * 7. Export session as JSON (for sharing/support)
 * 8. Cleanup: auto-delete sessions older than 30 days
 */
export class DetectionLog {
  private currentSessionId: string | null = null;

  async initialize(): Promise<void> {
    // TODO: Create SQLite database and tables
    throw new Error("Not implemented — Franky, this is yours");
  }

  async startSession(): Promise<string> {
    // TODO: Create new session record, return session ID
    throw new Error("Not implemented");
  }

  async logDetection(event: DetectionEvent): Promise<void> {
    // TODO: Store detection event linked to current session
    throw new Error("Not implemented");
  }

  async endSession(): Promise<void> {
    // TODO: Mark current session as ended
    throw new Error("Not implemented");
  }

  async getSessionDetections(sessionId: string): Promise<DetectionRecord[]> {
    // TODO: Query all detections for a session
    throw new Error("Not implemented");
  }

  async getRecentSessions(limit = 20): Promise<SessionRecord[]> {
    // TODO: Get recent sessions for review dashboard
    throw new Error("Not implemented");
  }
}
