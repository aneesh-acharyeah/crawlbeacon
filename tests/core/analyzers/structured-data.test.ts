import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parsePage } from '../../../src/utils/html-parser.js';
import { analyzeStructuredData } from '../../../src/core/analyzers/structured-data.js';

const fixturesDir = join(__dirname, '../../fixtures/html');

function loadAndParse(file: string) {
  const html = readFileSync(join(fixturesDir, file), 'utf-8');
  return parsePage(html, 'https://example.com/test');
}

describe('analyzeStructuredData', () => {
  describe('perfect page with JSON-LD', () => {
    const page = loadAndParse('perfect-seo.html');
    const result = analyzeStructuredData(page);

    it('returns analyzer name "structured-data"', () => {
      expect(result.analyzer).toBe('structured-data');
    });

    it('has high score for valid JSON-LD', () => {
      expect(result.score).toBeGreaterThanOrEqual(80);
    });

    it('does not flag missing structured data', () => {
      expect(result.issues.find((i) => i.code === 'NO_STRUCTURED_DATA')).toBeUndefined();
    });
  });

  describe('page with no JSON-LD', () => {
    const page = loadAndParse('missing-meta.html');
    const result = analyzeStructuredData(page);

    it('flags no structured data', () => {
      expect(result.issues.find((i) => i.code === 'NO_STRUCTURED_DATA')).toBeDefined();
    });
  });

  describe('JSON-LD validation', () => {
    it('flags missing @context', () => {
      const page = parsePage(
        '<html><head><script type="application/ld+json">{"@type":"WebPage","name":"Test"}</script></head><body></body></html>',
        'https://example.com',
      );
      const result = analyzeStructuredData(page);
      expect(result.issues.find((i) => i.code === 'MISSING_CONTEXT')).toBeDefined();
    });

    it('flags missing @type', () => {
      const page = parsePage(
        '<html><head><script type="application/ld+json">{"@context":"https://schema.org","name":"Test"}</script></head><body></body></html>',
        'https://example.com',
      );
      const result = analyzeStructuredData(page);
      expect(result.issues.find((i) => i.code === 'MISSING_TYPE')).toBeDefined();
    });

    it('flags missing required fields for Article', () => {
      const page = parsePage(
        '<html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"Article"}</script></head><body></body></html>',
        'https://example.com',
      );
      const result = analyzeStructuredData(page);
      const missingFields = result.issues.filter((i) => i.code === 'MISSING_FIELD');
      expect(missingFields.length).toBeGreaterThanOrEqual(1);
      expect(missingFields.some((i) => i.message.includes('headline'))).toBe(true);
    });

    it('passes for complete Article', () => {
      const page = parsePage(
        `<html><head><script type="application/ld+json">${JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: 'Test',
          author: { '@type': 'Person', name: 'Author' },
          datePublished: '2025-01-01',
        })}</script></head><body></body></html>`,
        'https://example.com',
      );
      const result = analyzeStructuredData(page);
      const missingFields = result.issues.filter((i) => i.code === 'MISSING_FIELD');
      expect(missingFields).toHaveLength(0);
    });
  });
});
