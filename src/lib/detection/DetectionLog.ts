/**
 * DetectionLog - In-memory detection event logger
 * SS-05: StreamShield Streamer Safety System
 */

export interface DetectionEvent {
  id: string;
  timestamp: number;
  type: 'threat' | 'warning' | 'info';
  severity: 'mute' | 'blur' | 'block' | 'kill' | 'none';
  pattern: string;
  matchedText: string;
  action: string;
  resolved: boolean;
  resolvedAt?: number;
}

export interface LogStats {
  total: number;
  threats: number;
  warnings: number;
  resolved: number;
  unresolved: number;
}

export class DetectionLog {
  private events: DetectionEvent[] = [];
  private maxEvents: number;
  private listeners: Set<(event: DetectionEvent) => void> = new Set();

  constructor(maxEvents: number = 1000) {
    this.maxEvents = maxEvents;
  }

  /**
   * Add a new detection event
   */
  log(event: Omit<DetectionEvent, 'id' | 'timestamp' | 'resolved'>): DetectionEvent {
    const fullEvent: DetectionEvent = {
      ...event,
      id: this.generateId(),
      timestamp: Date.now(),
      resolved: false,
    };

    this.events.unshift(fullEvent); // Add to front

    // Trim if exceeding max
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(0, this.maxEvents);
    }

    // Notify listeners
    this.listeners.forEach(listener => listener(fullEvent));

    return fullEvent;
  }

  /**
   * Mark an event as resolved
   */
  resolve(eventId: string): boolean {
    const event = this.events.find(e => e.id === eventId);
    if (event) {
      event.resolved = true;
      event.resolvedAt = Date.now();
      return true;
    }
    return false;
  }

  /**
   * Get all events, optionally filtered
   */
  getEvents(options?: {
    type?: DetectionEvent['type'];
    severity?: DetectionEvent['severity'];
    resolved?: boolean;
    limit?: number;
  }): DetectionEvent[] {
    let filtered = [...this.events];

    if (options?.type) {
      filtered = filtered.filter(e => e.type === options.type);
    }
    if (options?.severity) {
      filtered = filtered.filter(e => e.severity === options.severity);
    }
    if (options?.resolved !== undefined) {
      filtered = filtered.filter(e => e.resolved === options.resolved);
    }
    if (options?.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  /**
   * Get log statistics
   */
  getStats(): LogStats {
    return {
      total: this.events.length,
      threats: this.events.filter(e => e.type === 'threat').length,
      warnings: this.events.filter(e => e.type === 'warning').length,
      resolved: this.events.filter(e => e.resolved).length,
      unresolved: this.events.filter(e => !e.resolved).length,
    };
  }

  /**
   * Clear all events
   */
  clear(): void {
    this.events = [];
  }

  /**
   * Subscribe to new events
   */
  subscribe(listener: (event: DetectionEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Export events to JSON
   */
  exportToJSON(): string {
    return JSON.stringify(this.events, null, 2);
  }

  /**
   * Import events from JSON
   */
  importFromJSON(json: string): number {
    try {
      const imported = JSON.parse(json) as DetectionEvent[];
      this.events = [...imported, ...this.events].slice(0, this.maxEvents);
      return imported.length;
    } catch {
      return 0;
    }
  }

  private generateId(): string {
    return `det_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
export const detectionLog = new DetectionLog();
