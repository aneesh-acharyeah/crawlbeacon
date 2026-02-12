import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { parsePage } from '../../../src/utils/html-parser.js';

const perfectHTML = readFileSync('tests/fixtures/html/perfect-seo.html', 'utf-8');
const missingHTML = readFileSync('tests/fixtures/html/missing-meta.html', 'utf-8');

describe('HTML Parser', () => {
  describe('perfect SEO page', () => {
    const page = parsePage(perfectHTML, 'https://example.com/perfect-page');

    it('should extract title', () => {
      expect(page.title).toBe('Perfect SEO Page - Example Site');
    });

    it('should extract meta description', () => {
      expect(page.metaDescription).toContain('perfectly optimized page');
    });

    it('should extract canonical', () => {
      expect(page.canonical).toBe('https://example.com/perfect-page');
    });

    it('should extract robots directive', () => {
      expect(page.robots).toBe('index, follow');
    });

    it('should extract Open Graph tags', () => {
      expect(page.ogTitle).toBe('Perfect SEO Page');
      expect(page.ogDescription).toBe('Perfectly optimized page for testing');
      expect(page.ogImage).toBe('https://example.com/og-image.png');
      expect(page.ogUrl).toBe('https://example.com/perfect-page');
      expect(page.ogType).toBe('website');
    });

    it('should extract Twitter Card tags', () => {
      expect(page.twitterCard).toBe('summary_large_image');
      expect(page.twitterTitle).toBe('Perfect SEO Page');
      expect(page.twitterImage).toBe('https://example.com/twitter-image.png');
    });

    it('should extract JSON-LD structured data', () => {
      expect(page.jsonLd).toHaveLength(1);
      expect((page.jsonLd[0] as Record<string, string>)['@type']).toBe('WebPage');
    });

    it('should extract headings', () => {
      expect(page.h1).toEqual(['Perfect SEO Page']);
      expect(page.h2).toEqual(['Section One', 'Section Two']);
    });

    it('should extract images with attributes', () => {
      expect(page.images).toHaveLength(2);
      expect(page.images[0].alt).toBe('Descriptive alt text');
      expect(page.images[0].loading).toBe('lazy');
      expect(page.images[0].width).toBe('800');
      expect(page.images[0].height).toBe('600');
    });

    it('should separate internal and external links', () => {
      expect(page.internalLinks).toContain('https://example.com/about');
      expect(page.externalLinks).toContain('https://external.com/');
    });

    it('should extract technical attributes', () => {
      expect(page.lang).toBe('en');
      expect(page.charset).toBe('UTF-8');
      expect(page.viewport).toContain('width=device-width');
    });
  });

  describe('missing meta page', () => {
    const page = parsePage(missingHTML, 'https://example.com');

    it('should return null for missing tags', () => {
      expect(page.title).toBeNull();
      expect(page.metaDescription).toBeNull();
      expect(page.canonical).toBeNull();
      expect(page.robots).toBeNull();
      expect(page.ogTitle).toBeNull();
      expect(page.twitterCard).toBeNull();
      expect(page.viewport).toBeNull();
      expect(page.lang).toBeNull();
    });

    it('should have no headings', () => {
      expect(page.h1).toEqual([]);
      expect(page.h2).toEqual([]);
    });

    it('should have no structured data', () => {
      expect(page.jsonLd).toEqual([]);
    });

    it('should detect images with missing alt', () => {
      expect(page.images).toHaveLength(2);
      expect(page.images[0].alt).toBeNull();
      expect(page.images[1].alt).toBe('');
    });
  });
});
