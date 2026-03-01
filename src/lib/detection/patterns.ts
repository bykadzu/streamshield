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

export class PatternEngine {
  private categories: Map<string, PatternCategory> = new Map();
  private recentMatches: Map<string, number> = new Map(); // key -> timestamp
  private dedupeWindowMs = 5000;

  /**
   * Load patterns from JSON config file
   */
  async loadPatterns(config: PatternConfig): Promise<void> {
    // Load built-in categories
    for (const [key, category] of Object.entries(config.categories)) {
      const compiled: PatternCategory = {
        ...category,
        patterns: category.patterns.map(p => ({
          ...p,
          compiled: new RegExp(p.regex, 'gi'), // Compile regex once, case-insensitive
        })),
      };
      this.categories.set(key, compiled);
    }

    // Load custom patterns
    if (config.custom) {
      const customCompiled: PatternCategory = {
        ...config.custom,
        patterns: (config.custom.patterns || []).map(p => ({
          ...p,
          compiled: new RegExp(p.regex, 'gi'),
        })),
      };
      this.categories.set('custom', customCompiled);
    }
  }

  /**
   * Scan text against all enabled patterns
   * Returns array of matches (excluding deduplicated ones)
   */
  scanText(text: string): PatternMatch[] {
    const matches: PatternMatch[] = [];
    const now = Date.now();

    for (const [categoryKey, category] of this.categories) {
      if (!category.enabled) continue;

      for (const pattern of category.patterns) {
        if (!pattern.compiled) continue;

        // Reset regex state for each scan
        pattern.compiled.lastIndex = 0;

        let match: RegExpExecArray | null;
        while ((match = pattern.compiled.exec(text)) !== null) {
          const matchKey = `${categoryKey}:${pattern.name}:${match[0]}`;

          // Deduplication: check if we've seen this match within the window
          const lastSeen = this.recentMatches.get(matchKey);
          if (lastSeen && (now - lastSeen) < this.dedupeWindowMs) {
            continue; // Skip duplicate
          }

          // Record this match
          this.recentMatches.set(matchKey, now);

          matches.push({
            categoryLabel: category.label,
            patternName: pattern.name,
            severity: category.severity,
            matchedText: match[0],
            position: {
              start: match.index,
              end: match.index + match[0].length,
            },
            timestamp: now,
          });

          // Prevent infinite loop on zero-width matches
          if (match.index === pattern.compiled.lastIndex) {
            pattern.compiled.lastIndex++;
          }
        }
      }
    }

    // Cleanup old entries from deduplication map
    this.cleanupDedupeMap(now);

    return matches;
  }

  /**
   * Add a custom user-defined pattern
   */
  addCustomPattern(
    name: string,
    regex: string,
    severity: number = 3,
  ): void {
    let custom = this.categories.get('custom');
    if (!custom) {
      custom = {
        label: 'Custom Patterns',
        severity,
        enabled: true,
        patterns: [],
      };
      this.categories.set('custom', custom);
    }

    custom.patterns.push({
      name,
      regex,
      compiled: new RegExp(regex, 'gi'),
    });
  }

  /**
   * Remove a custom pattern by name
   */
  removeCustomPattern(name: string): void {
    const custom = this.categories.get('custom');
    if (custom) {
      custom.patterns = custom.patterns.filter(p => p.name !== name);
    }
  }

  /**
   * Enable/disable an entire category
   */
  toggleCategory(categoryKey: string, enabled: boolean): void {
    const category = this.categories.get(categoryKey);
    if (category) {
      category.enabled = enabled;
    }
  }

  /**
   * Get all categories (for settings UI)
   */
  getCategories(): PatternCategory[] {
    return Array.from(this.categories.values());
  }

  /**
   * Get category by key
   */
  getCategory(key: string): PatternCategory | undefined {
    return this.categories.get(key);
  }

  /**
   * Set category enabled state
   */
  setCategoryEnabled(key: string, enabled: boolean): void {
    const category = this.categories.get(key);
    if (category) {
      category.enabled = enabled;
    }
  }

  /**
   * Cleanup old entries from deduplication map
   */
  private cleanupDedupeMap(now: number): void {
    const toDelete: string[] = [];
    for (const [key, timestamp] of this.recentMatches) {
      if (now - timestamp > this.dedupeWindowMs * 2) {
        toDelete.push(key);
      }
    }
    for (const key of toDelete) {
      this.recentMatches.delete(key);
    }
  }

  /**
   * Clear deduplication map (useful for new session)
   */
  clearDedupeMap(): void {
    this.recentMatches.clear();
  }
}

// Export a default instance for easy importing
export const patternEngine = new PatternEngine();
