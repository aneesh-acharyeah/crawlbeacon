import { describe, it, expect } from 'vitest';
import { jsonReporter } from '../../../src/cli/reporters/json.js';
import type { ScanResult } from '../../../src/core/analyzers/types.js';

function makeScanResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    url: 'https://example.com',
    timestamp: '2025-01-01T00:00:00.000Z',
    score: 85,
    results: [
      {
        analyzer: 'meta',
        score: 80,
        issues: [
          { code: 'MISSING_CANONICAL', severity: 'warning', message: 'Page is missing a canonical URL.' },
          { code: 'MISSING_OG_IMAGE', severity: 'warning', message: 'Missing og:image meta tag.' },
        ],
      },
      {
        analyzer: 'images',
        score: 100,
        issues: [],
      },
    ],
    ...overrides,
  };
}

describe('jsonReporter', () => {
  it('outputs valid JSON', () => {
    const output = jsonReporter.format(makeScanResult());
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it('preserves all ScanResult fields', () => {
    const result = makeScanResult();
    const parsed = JSON.parse(jsonReporter.format(result));
    expect(parsed.url).toBe('https://example.com');
    expect(parsed.timestamp).toBe('2025-01-01T00:00:00.000Z');
    expect(parsed.score).toBe(85);
    expect(parsed.results).toHaveLength(2);
  });

  it('preserves issue details', () => {
    const parsed = JSON.parse(jsonReporter.format(makeScanResult()));
    const metaResult = parsed.results.find((r: any) => r.analyzer === 'meta');
    expect(metaResult.issues).toHaveLength(2);
    expect(metaResult.issues[0].code).toBe('MISSING_CANONICAL');
    expect(metaResult.issues[0].severity).toBe('warning');
    expect(metaResult.issues[0].message).toContain('canonical');
  });

  it('preserves issue context when present', () => {
    const result = makeScanResult({
      results: [{
        analyzer: 'meta',
        score: 85,
        issues: [{ code: 'TITLE_TOO_LONG', severity: 'warning', message: 'Title too long', context: 'My very long title' }],
      }],
    });
    const parsed = JSON.parse(jsonReporter.format(result));
    expect(parsed.results[0].issues[0].context).toBe('My very long title');
  });

  it('handles empty results array', () => {
    const result = makeScanResult({ results: [], score: 100 });
    const parsed = JSON.parse(jsonReporter.format(result));
    expect(parsed.results).toEqual([]);
    expect(parsed.score).toBe(100);
  });
});
