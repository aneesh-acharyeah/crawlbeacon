import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { parsePage } from '../../../src/utils/html-parser.js';
import { analyzeMeta } from '../../../src/core/analyzers/meta.js';
import { analyzeStructuredData } from '../../../src/core/analyzers/structured-data.js';
import { analyzeImages } from '../../../src/core/analyzers/images.js';
import { analyzeRobots } from '../../../src/core/analyzers/robots.js';

const emptyHTML = readFileSync('tests/fixtures/html/empty.html', 'utf-8');
const malformedHTML = readFileSync('tests/fixtures/html/malformed.html', 'utf-8');
const invalidJsonLdHTML = readFileSync('tests/fixtures/html/json-ld-invalid.html', 'utf-8');
const duplicateMetaHTML = readFileSync('tests/fixtures/html/duplicate-meta.html', 'utf-8');

describe('Edge cases: empty HTML', () => {
  const page = parsePage(emptyHTML, 'https://example.com/empty');

  it('parsePage does not throw', () => {
    expect(page).toBeDefined();
  });

  it('analyzeMeta returns issues for missing tags', () => {
    const result = analyzeMeta(page);
    expect(result.score).toBeLessThan(50);
    const codes = result.issues.map((i) => i.code);
    expect(codes).toContain('MISSING_TITLE');
    expect(codes).toContain('MISSING_DESCRIPTION');
  });

  it('analyzeStructuredData reports no structured data', () => {
    const result = analyzeStructuredData(page);
    const codes = result.issues.map((i) => i.code);
    expect(codes).toContain('NO_STRUCTURED_DATA');
  });

  it('analyzeImages reports no images', () => {
    const result = analyzeImages(page);
    expect(result.issues.some((i) => i.code === 'NO_IMAGES')).toBe(true);
  });
});

describe('Edge cases: malformed HTML', () => {
  const page = parsePage(malformedHTML, 'https://example.com/malformed');

  it('parsePage does not throw on malformed HTML', () => {
    expect(page).toBeDefined();
  });

  it('analyzeMeta does not throw', () => {
    const result = analyzeMeta(page);
    expect(result.analyzer).toBe('meta');
    expect(typeof result.score).toBe('number');
  });

  it('analyzeStructuredData does not throw', () => {
    const result = analyzeStructuredData(page);
    expect(result.analyzer).toBe('structured-data');
  });

  it('analyzeImages does not throw', () => {
    const result = analyzeImages(page);
    expect(result.analyzer).toBe('images');
  });

  it('handles H1 gracefully (cheerio may merge unclosed tags)', () => {
    // Cheerio nests unclosed h1 tags, so count may be 0
    expect(Array.isArray(page.h1)).toBe(true);
  });
});

describe('Edge cases: invalid JSON-LD', () => {
  const page = parsePage(invalidJsonLdHTML, 'https://example.com/invalid-jsonld');

  it('parsePage does not throw on invalid JSON-LD', () => {
    expect(page).toBeDefined();
  });

  it('parsePage recovers valid JSON-LD blocks (skips broken ones)', () => {
    // Should have the valid block, broken one is filtered
    expect(page.jsonLd.length).toBeGreaterThanOrEqual(1);
    const valid = page.jsonLd.find((j: any) => j['@type'] === 'WebPage');
    expect(valid).toBeDefined();
  });

  it('analyzeStructuredData does not throw', () => {
    const result = analyzeStructuredData(page);
    expect(result.analyzer).toBe('structured-data');
    expect(typeof result.score).toBe('number');
  });
});

describe('Edge cases: duplicate meta tags', () => {
  const page = parsePage(duplicateMetaHTML, 'https://example.com/duplicate');

  it('parsePage does not throw', () => {
    expect(page).toBeDefined();
  });

  it('extracts first title (cheerio behavior)', () => {
    expect(page.title).toBe('First Title');
  });

  it('analyzeMeta does not throw on duplicates', () => {
    const result = analyzeMeta(page);
    expect(result.analyzer).toBe('meta');
    expect(typeof result.score).toBe('number');
  });

  it('analyzeImages handles single image correctly', () => {
    const result = analyzeImages(page);
    expect(result.score).toBe(100);
  });
});

describe('Edge cases: robots.txt', () => {
  it('handles empty string', () => {
    const result = analyzeRobots('');
    expect(result.analyzer).toBe('robots');
    expect(result.issues.some((i) => i.code === 'EMPTY_ROBOTS')).toBe(true);
  });

  it('handles comments-only file', () => {
    const result = analyzeRobots('# This is a comment\n# Another comment\n');
    expect(result.analyzer).toBe('robots');
    expect(result.issues.some((i) => i.code === 'NO_DIRECTIVES')).toBe(true);
  });

  it('handles whitespace-only content', () => {
    const result = analyzeRobots('   \n  \n   ');
    expect(result.analyzer).toBe('robots');
    expect(result.issues.some((i) => i.code === 'EMPTY_ROBOTS')).toBe(true);
  });
});
