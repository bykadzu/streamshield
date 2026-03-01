/**
 * Pattern Engine — Regex-based detection for PII, secrets, and custom triggers
 *
 * Loads patterns from patterns/default.json + user custom patterns.
 * Runs all enabled patterns against OCR-extracted text from frames.
 *
 * This is the product's core IP — the pattern library is what makes
 * StreamShield useful out of the box.
 */

export interface Pattern {
  name: string;
  regex: string;
  compiled?: RegExp;
}

export interface PatternCategory {
  label: string;
  severity: number; // 0=log, 1=mute, 2=blur, 3=block, 4=kill
  enabled: boolean;
  patterns: Pattern[];
}

export interface PatternMatch {
  categoryLabel: string;
  patternName: string;
  severity: number;
  matchedText: string;
  position: { start: number; end: number };
  timestamp: number;
}

export interface PatternConfig {
  version: string;
  categories: Record<string, PatternCategory>;
  custom: PatternCategory;
}

/**
 * TODO (Franky): Implement the pattern engine
 *
 * Requirements:
 * 1. Load patterns from JSON config (default.json + user overrides)
 * 2. Compile regex patterns once on load (cache compiled RegExp objects)
 * 3. scanText(text: string) -> PatternMatch[] — run all enabled patterns
 * 4. Support severity levels (determines which action tier fires)
 * 5. Support custom user patterns (add/remove/toggle)
 * 6. Performance: must process OCR text in <50ms (typically 100-500 chars per frame)
 * 7. Deduplication: same match within 5s window should not re-trigger
 */
export class PatternEngine {
  private categories: Map<string, PatternCategory> = new Map();
  private recentMatches: Map<string, number> = new Map(); // key -> timestamp
  private dedupeWindowMs = 5000;

  async loadPatterns(configPath: string): Promise<void> {
    // TODO: Load and compile patterns from JSON file
    throw new Error("Not implemented — Franky, this is yours");
  }

  scanText(text: string): PatternMatch[] {
    // TODO: Run all enabled patterns against text, return matches
    throw new Error("Not implemented");
  }

  addCustomPattern(
    name: string,
    regex: string,
    severity: number,
  ): void {
    // TODO: Add user-defined pattern
    throw new Error("Not implemented");
  }

  removeCustomPattern(name: string): void {
    // TODO: Remove user-defined pattern
    throw new Error("Not implemented");
  }

  toggleCategory(categoryKey: string, enabled: boolean): void {
    // TODO: Enable/disable entire category
    throw new Error("Not implemented");
  }

  getCategories(): PatternCategory[] {
    return Array.from(this.categories.values());
  }
}
