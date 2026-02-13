/**
 * Shared types for all analyzers.
 * Every analyzer is a pure function: input → AnalyzerResult.
 */

export type Severity = 'error' | 'warning' | 'info';

export interface Issue {
  /** Unique rule ID, e.g. MISSING_TITLE, IMAGES_NO_ALT */
  code: string;
  severity: Severity;
  message: string;
  /** Optional context — the value that triggered the issue */
  context?: string;
}

export interface AnalyzerResult {
  /** Analyzer name, e.g. "meta", "images", "structured-data" */
  analyzer: string;
  /** Score 0-100, computed as 100 - (errors * 15) - (warnings * 5) */
  score: number;
  issues: Issue[];
}

/** Aggregated result from all analyzers for a single URL */
export interface ScanResult {
  url: string;
  timestamp: string;
  /** Overall score (average of analyzer scores) */
  score: number;
  results: AnalyzerResult[];
}

/** Helper to compute score from issues */
export function computeScore(issues: Issue[]): number {
  let score = 100;
  for (const issue of issues) {
    if (issue.severity === 'error') score -= 15;
    else if (issue.severity === 'warning') score -= 5;
  }
  return Math.max(0, Math.min(100, score));
}
