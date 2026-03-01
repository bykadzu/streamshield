/**
 * Detection Log — Storage for detection events
 *
 * In browser-only mode (dev), uses in-memory Map + localStorage for persistence.
 * In Tauri, this would use SQLite plugin.
 *
 * Schema:
 * - detections: id, timestamp, frame_index, severity, action_taken,
 *               pattern_name, matched_text, ocr_confidence, screenshot_path
 * - sessions: id, started_at, ended_at, total_frames, total_detections
 */

export interface DetectionEvent {
  id: string;
  timestamp: number;
  frameIndex: number;
  ocrResult: { text: string; confidence: number; processingTimeMs: number } | null;
  matches: PatternMatch[];
  highestSeverity: number;
  actionTaken: ActionType;
  screenshotBase64?: string;
}

export interface PatternMatch {
  categoryLabel: string;
  patternName: string;
  severity: number;
  matchedText: string;
  position: { start: number; end: number };
  timestamp: number;
}

export type ActionType = "none" | "log" | "mute" | "blur" | "block" | "kill";

export type DetectionListener = (event: DetectionEvent) => void;

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
  screenshotBase64?: string;
}

export interface SessionRecord {
  id: string;
  startedAt: number;
  endedAt?: number;
  totalFrames: number;
  totalDetections: number;
  highestSeverityHit: number;
}

const STORAGE_KEY_SESSIONS = "streamshield_sessions";
const STORAGE_KEY_DETECTIONS = "streamshield_detections";
const MAX_SESSIONS_STORED = 100;
const SESSION_RETENTION_DAYS = 30;

export class DetectionLog {
  private sessions: Map<string, SessionRecord> = new Map();
  private detections: Map<string, DetectionRecord[]> = new Map();
  private currentSessionId: string | null = null;
  private frameCount = 0;

  constructor() {
    this.loadFromStorage();
  }

  async initialize(): Promise<void> {
    console.log("[Storage] Initialized");
    // Cleanup old sessions on init
    this.cleanupOldSessions();
  }

  async startSession(): Promise<string> {
    // End any existing session
    if (this.currentSessionId) {
      await this.endSession();
    }

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const session: SessionRecord = {
      id: sessionId,
      startedAt: Date.now(),
      totalFrames: 0,
      totalDetections: 0,
      highestSeverityHit: -1,
    };

    this.sessions.set(sessionId, session);
    this.detections.set(sessionId, []);
    this.currentSessionId = sessionId;
    this.frameCount = 0;

    this.saveToStorage();
    console.log(`[Storage] Session started: ${sessionId}`);
    return sessionId;
  }

  async logDetection(event: DetectionEvent): Promise<void> {
    if (!this.currentSessionId) {
      console.warn("[Storage] No active session, ignoring detection");
      return;
    }

    const session = this.sessions.get(this.currentSessionId);
    if (!session) return;

    // Update session stats
    session.totalFrames = this.frameCount;
    session.totalDetections++;

    if (event.highestSeverity > session.highestSeverityHit) {
      session.highestSeverityHit = event.highestSeverity;
    }

    // Create detection records
    for (const match of event.matches) {
      const record: DetectionRecord = {
        id: `det_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        sessionId: this.currentSessionId,
        timestamp: event.timestamp,
        frameIndex: event.frameIndex,
        severity: match.severity,
        actionTaken: event.actionTaken,
        patternName: match.patternName,
        matchedText: match.matchedText,
        ocrConfidence: event.ocrResult?.confidence || 0,
        screenshotBase64: event.screenshotBase64,
      };

      const sessionDetections = this.detections.get(this.currentSessionId) || [];
      sessionDetections.push(record);
      this.detections.set(this.currentSessionId, sessionDetections);
    }

    this.saveToStorage();
  }

  async endSession(): Promise<void> {
    if (!this.currentSessionId) return;

    const session = this.sessions.get(this.currentSessionId);
    if (session) {
      session.endedAt = Date.now();
      session.totalFrames = this.frameCount;
    }

    console.log(`[Storage] Session ended: ${this.currentSessionId}`);
    this.currentSessionId = null;
    this.frameCount = 0;
    this.saveToStorage();
  }

  incrementFrameCount(): void {
    this.frameCount++;
  }

  async getSessionDetections(sessionId: string): Promise<DetectionRecord[]> {
    return this.detections.get(sessionId) || [];
  }

  async getRecentSessions(limit = 20): Promise<SessionRecord[]> {
    const allSessions = Array.from(this.sessions.values());
    return allSessions
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, limit);
  }

  async getSession(sessionId: string): Promise<SessionRecord | null> {
    return this.sessions.get(sessionId) || null;
  }

  async exportSessionAsJSON(sessionId: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    const detections = this.detections.get(sessionId) || [];

    return JSON.stringify(
      {
        session,
        detections,
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    );
  }

  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  private loadFromStorage(): void {
    try {
      const sessionsJson = localStorage.getItem(STORAGE_KEY_SESSIONS);
      const detectionsJson = localStorage.getItem(STORAGE_KEY_DETECTIONS);

      if (sessionsJson) {
        const sessionsArray: SessionRecord[] = JSON.parse(sessionsJson);
        sessionsArray.forEach((s) => this.sessions.set(s.id, s));
      }

      if (detectionsJson) {
        const detectionsObj: Record<string, DetectionRecord[]> = JSON.parse(detectionsJson);
        Object.entries(detectionsObj).forEach(([key, value]) => {
          this.detections.set(key, value);
        });
      }

      console.log(`[Storage] Loaded ${this.sessions.size} sessions from storage`);
    } catch (error) {
      console.error("[Storage] Failed to load from storage:", error);
    }
  }

  private saveToStorage(): void {
    try {
      // Limit storage size - only keep recent sessions
      const sessionsArray = Array.from(this.sessions.values())
        .sort((a, b) => b.startedAt - a.startedAt)
        .slice(0, MAX_SESSIONS_STORED);

      const sessionIds = new Set(sessionsArray.map((s) => s.id));
      
      // Keep only detections for recent sessions
      const detectionsObj: Record<string, DetectionRecord[]> = {};
      for (const [sessionId, detections] of this.detections) {
        if (sessionIds.has(sessionId)) {
          // Limit detections per session to 1000
          detectionsObj[sessionId] = detections.slice(-1000);
        }
      }

      localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessionsArray));
      localStorage.setItem(STORAGE_KEY_DETECTIONS, JSON.stringify(detectionsObj));
    } catch (error) {
      console.error("[Storage] Failed to save to storage:", error);
    }
  }

  private cleanupOldSessions(): void {
    const cutoffMs = SESSION_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - cutoffMs;

    let cleaned = 0;
    for (const [sessionId, session] of this.sessions) {
      if (session.startedAt < cutoff) {
        this.sessions.delete(sessionId);
        this.detections.delete(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[Storage] Cleaned up ${cleaned} old sessions`);
      this.saveToStorage();
    }
  }
}

// Export default instance
export const detectionLog = new DetectionLog();
