import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parsePage } from '../../../src/utils/html-parser.js';
import { analyzeImages } from '../../../src/core/analyzers/images.js';

const fixturesDir = join(__dirname, '../../fixtures/html');

function loadAndParse(file: string) {
  const html = readFileSync(join(fixturesDir, file), 'utf-8');
  return parsePage(html, 'https://example.com/test');
}

describe('analyzeImages', () => {
  describe('perfect page', () => {
    const page = loadAndParse('perfect-seo.html');
    const result = analyzeImages(page);

    it('returns analyzer name "images"', () => {
      expect(result.analyzer).toBe('images');
    });

    it('has perfect score for well-optimized images', () => {
      expect(result.score).toBe(100);
    });

    it('has no errors or warnings', () => {
      const problems = result.issues.filter((i) => i.severity === 'error' || i.severity === 'warning');
      expect(problems).toHaveLength(0);
    });
  });

  describe('missing-meta page (images without alt/dimensions)', () => {
    const page = loadAndParse('missing-meta.html');
    const result = analyzeImages(page);

    it('flags missing alt attributes', () => {
      expect(result.issues.find((i) => i.code === 'IMAGES_MISSING_ALT')).toBeDefined();
    });

    it('flags empty alt attributes', () => {
      expect(result.issues.find((i) => i.code === 'IMAGES_EMPTY_ALT')).toBeDefined();
    });

    it('flags missing dimensions', () => {
      expect(result.issues.find((i) => i.code === 'IMAGES_MISSING_DIMENSIONS')).toBeDefined();
    });

    it('flags missing lazy loading', () => {
      expect(result.issues.find((i) => i.code === 'IMAGES_NOT_LAZY')).toBeDefined();
    });
  });

  describe('page with no images', () => {
    it('returns info about no images', () => {
      const page = parsePage('<html><body><p>No images here</p></body></html>', 'https://example.com');
      const result = analyzeImages(page);
      expect(result.issues.find((i) => i.code === 'NO_IMAGES')).toBeDefined();
      expect(result.score).toBe(100);
    });
  });

  describe('issue context includes image URLs', () => {
    it('lists affected image sources in context', () => {
      const page = loadAndParse('missing-meta.html');
      const result = analyzeImages(page);
      const missingAlt = result.issues.find((i) => i.code === 'IMAGES_MISSING_ALT');
      expect(missingAlt?.context).toContain('no-alt.jpg');
    });
  });
});
