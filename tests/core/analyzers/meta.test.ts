import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parsePage } from '../../../src/utils/html-parser.js';
import { analyzeMeta } from '../../../src/core/analyzers/meta.js';

const fixturesDir = join(__dirname, '../../fixtures/html');

function loadAndParse(file: string) {
  const html = readFileSync(join(fixturesDir, file), 'utf-8');
  return parsePage(html, 'https://example.com/test');
}

describe('analyzeMeta', () => {
  describe('perfect page', () => {
    const page = loadAndParse('perfect-seo.html');
    const result = analyzeMeta(page);

    it('returns analyzer name "meta"', () => {
      expect(result.analyzer).toBe('meta');
    });

    it('has high score for well-optimized page', () => {
      expect(result.score).toBeGreaterThanOrEqual(80);
    });

    it('has no errors', () => {
      const errors = result.issues.filter((i) => i.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    it('does not flag missing title', () => {
      expect(result.issues.find((i) => i.code === 'MISSING_TITLE')).toBeUndefined();
    });

    it('does not flag missing description', () => {
      expect(result.issues.find((i) => i.code === 'MISSING_DESCRIPTION')).toBeUndefined();
    });

    it('does not flag missing H1', () => {
      expect(result.issues.find((i) => i.code === 'MISSING_H1')).toBeUndefined();
    });

    it('does not flag missing viewport', () => {
      expect(result.issues.find((i) => i.code === 'MISSING_VIEWPORT')).toBeUndefined();
    });
  });

  describe('missing meta page', () => {
    const page = loadAndParse('missing-meta.html');
    const result = analyzeMeta(page);

    it('has low score for page with no SEO', () => {
      expect(result.score).toBeLessThanOrEqual(40);
    });

    it('flags missing title', () => {
      expect(result.issues.find((i) => i.code === 'MISSING_TITLE')).toBeDefined();
    });

    it('flags missing description', () => {
      expect(result.issues.find((i) => i.code === 'MISSING_DESCRIPTION')).toBeDefined();
    });

    it('flags missing H1', () => {
      expect(result.issues.find((i) => i.code === 'MISSING_H1')).toBeDefined();
    });

    it('flags missing viewport', () => {
      expect(result.issues.find((i) => i.code === 'MISSING_VIEWPORT')).toBeDefined();
    });

    it('flags missing canonical', () => {
      expect(result.issues.find((i) => i.code === 'MISSING_CANONICAL')).toBeDefined();
    });

    it('flags missing OG tags', () => {
      expect(result.issues.find((i) => i.code === 'MISSING_OG_TITLE')).toBeDefined();
      expect(result.issues.find((i) => i.code === 'MISSING_OG_DESCRIPTION')).toBeDefined();
      expect(result.issues.find((i) => i.code === 'MISSING_OG_IMAGE')).toBeDefined();
    });

    it('flags missing lang', () => {
      expect(result.issues.find((i) => i.code === 'MISSING_LANG')).toBeDefined();
    });
  });

  describe('title length checks', () => {
    it('warns on short title', () => {
      const page = parsePage('<html><head><title>Short</title><meta name="viewport" content="width=device-width"></head><body><h1>Hi</h1></body></html>', 'https://example.com');
      const result = analyzeMeta(page);
      expect(result.issues.find((i) => i.code === 'TITLE_TOO_SHORT')).toBeDefined();
    });

    it('warns on long title', () => {
      const longTitle = 'A'.repeat(65);
      const page = parsePage(`<html><head><title>${longTitle}</title><meta name="viewport" content="width=device-width"></head><body><h1>Hi</h1></body></html>`, 'https://example.com');
      const result = analyzeMeta(page);
      expect(result.issues.find((i) => i.code === 'TITLE_TOO_LONG')).toBeDefined();
    });
  });

  describe('H1 checks', () => {
    it('warns on multiple H1s', () => {
      const page = parsePage('<html><head><title>Test Page Title for Length</title></head><body><h1>First</h1><h1>Second</h1></body></html>', 'https://example.com');
      const result = analyzeMeta(page);
      expect(result.issues.find((i) => i.code === 'MULTIPLE_H1')).toBeDefined();
    });
  });
});
