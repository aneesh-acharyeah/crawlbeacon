import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { analyzeRobots, parseRobotsTxt } from '../../../src/core/analyzers/robots.js';

const fixturesDir = join(__dirname, '../../fixtures/robots');

function loadFixture(file: string) {
  return readFileSync(join(fixturesDir, file), 'utf-8');
}

describe('parseRobotsTxt', () => {
  it('parses user-agent directives', () => {
    const parsed = parseRobotsTxt(loadFixture('standard.txt'));
    expect(parsed.directives.length).toBeGreaterThanOrEqual(1);
    const wildcard = parsed.directives.find((d) => d.userAgent === '*');
    expect(wildcard).toBeDefined();
    expect(wildcard!.disallow).toContain('/admin/');
    expect(wildcard!.disallow).toContain('/api/');
  });

  it('extracts sitemap references', () => {
    const parsed = parseRobotsTxt(loadFixture('standard.txt'));
    expect(parsed.sitemaps).toContain('https://example.com/sitemap.xml');
  });

  it('parses AI bot blocks', () => {
    const parsed = parseRobotsTxt(loadFixture('standard.txt'));
    const gptBot = parsed.directives.find((d) => d.userAgent === 'GPTBot');
    expect(gptBot).toBeDefined();
    expect(gptBot!.disallow).toContain('/');
  });

  it('handles empty content', () => {
    const parsed = parseRobotsTxt('');
    expect(parsed.directives).toHaveLength(0);
    expect(parsed.sitemaps).toHaveLength(0);
  });

  it('ignores comments', () => {
    const parsed = parseRobotsTxt('# This is a comment\nUser-agent: *\n# Another comment\nDisallow: /private/');
    expect(parsed.directives).toHaveLength(1);
    expect(parsed.directives[0].disallow).toContain('/private/');
  });
});

describe('analyzeRobots', () => {
  describe('standard robots.txt', () => {
    const result = analyzeRobots(loadFixture('standard.txt'));

    it('returns analyzer name "robots"', () => {
      expect(result.analyzer).toBe('robots');
    });

    it('does not flag blocking all crawlers', () => {
      expect(result.issues.find((i) => i.code === 'BLOCKS_ALL_CRAWLERS')).toBeUndefined();
    });

    it('reports AI bots blocked', () => {
      expect(result.issues.find((i) => i.code === 'AI_BOTS_BLOCKED')).toBeDefined();
    });

    it('does not flag missing sitemap', () => {
      expect(result.issues.find((i) => i.code === 'NO_SITEMAP_REFERENCE')).toBeUndefined();
    });
  });

  describe('blocking-all robots.txt', () => {
    const result = analyzeRobots(loadFixture('blocking-all.txt'));

    it('flags blocking all crawlers as error', () => {
      const issue = result.issues.find((i) => i.code === 'BLOCKS_ALL_CRAWLERS');
      expect(issue).toBeDefined();
      expect(issue!.severity).toBe('error');
    });

    it('flags missing sitemap reference', () => {
      expect(result.issues.find((i) => i.code === 'NO_SITEMAP_REFERENCE')).toBeDefined();
    });

    it('has reduced score', () => {
      expect(result.score).toBeLessThan(100);
    });
  });

  describe('minimal robots.txt', () => {
    const result = analyzeRobots(loadFixture('minimal.txt'));

    it('flags missing sitemap', () => {
      expect(result.issues.find((i) => i.code === 'NO_SITEMAP_REFERENCE')).toBeDefined();
    });

    it('flags no AI bot directives', () => {
      expect(result.issues.find((i) => i.code === 'NO_AI_BOT_DIRECTIVES')).toBeDefined();
    });
  });

  describe('empty robots.txt', () => {
    const result = analyzeRobots('');

    it('flags empty file', () => {
      expect(result.issues.find((i) => i.code === 'EMPTY_ROBOTS')).toBeDefined();
    });
  });

  describe('crawl-delay check', () => {
    it('warns on high crawl-delay', () => {
      const content = 'User-agent: *\nCrawl-delay: 30\nAllow: /';
      const result = analyzeRobots(content);
      expect(result.issues.find((i) => i.code === 'HIGH_CRAWL_DELAY')).toBeDefined();
    });

    it('does not warn on reasonable crawl-delay', () => {
      const content = 'User-agent: *\nCrawl-delay: 2\nAllow: /';
      const result = analyzeRobots(content);
      expect(result.issues.find((i) => i.code === 'HIGH_CRAWL_DELAY')).toBeUndefined();
    });
  });
});
