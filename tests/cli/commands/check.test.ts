import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';

// Mock ora (spinner) to avoid terminal output in tests
vi.mock('ora', () => ({
  default: () => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn(),
    fail: vi.fn(),
    set text(_: string) {},
  }),
}));

// Mock fetcher
vi.mock('../../../src/utils/fetcher.js', () => ({
  fetchHTML: vi.fn(),
}));

// Keep original analyzers so we can spy/mock per-test
vi.mock('../../../src/core/analyzers/meta.js', { spy: true });
vi.mock('../../../src/utils/html-parser.js', { spy: true });

import { runCheck } from '../../../src/cli/commands/check.js';
import { fetchHTML } from '../../../src/utils/fetcher.js';
import { analyzeMeta } from '../../../src/core/analyzers/meta.js';
import { parsePage } from '../../../src/utils/html-parser.js';
import type { FetchSuccess, FetchFailure } from '../../../src/utils/fetcher.js';

const perfectHTML = readFileSync('tests/fixtures/html/perfect-seo.html', 'utf-8');
const missingHTML = readFileSync('tests/fixtures/html/missing-meta.html', 'utf-8');

const mockFetchHTML = vi.mocked(fetchHTML);

function makeSuccess(data: string, url = 'https://example.com'): FetchSuccess {
  return {
    success: true,
    statusCode: 200,
    statusText: 'OK',
    contentType: 'text/html',
    contentLength: data.length,
    data,
    headers: {},
    finalUrl: url,
    responseTime: 100,
    redirected: false,
  };
}

function makeFailure(message = 'Connection refused'): FetchFailure {
  return {
    success: false,
    errorCode: 'NETWORK_ERROR' as any,
    message,
    suggestion: 'Check the URL',
  };
}

const robotsTxt = `User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml`;

let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  process.exitCode = undefined;
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  mockFetchHTML.mockReset();
});

afterEach(() => {
  logSpy.mockRestore();
  process.exitCode = undefined;
});

describe('runCheck', () => {
  describe('URL normalization', () => {
    it('prepends https:// to bare domains', async () => {
      mockFetchHTML.mockResolvedValue(makeSuccess(perfectHTML, 'https://example.com'));

      await runCheck('example.com', { format: 'json', failOn: 'none' });

      expect(mockFetchHTML).toHaveBeenCalledWith('https://example.com');
    });

    it('does not modify URLs that already have http://', async () => {
      mockFetchHTML.mockResolvedValue(makeSuccess(perfectHTML, 'http://example.com'));

      await runCheck('http://example.com', { format: 'json', failOn: 'none' });

      expect(mockFetchHTML).toHaveBeenCalledWith('http://example.com');
    });

    it('does not modify URLs that already have https://', async () => {
      mockFetchHTML.mockResolvedValue(makeSuccess(perfectHTML));

      await runCheck('https://example.com', { format: 'json', failOn: 'none' });

      expect(mockFetchHTML).toHaveBeenCalledWith('https://example.com');
    });
  });

  describe('successful check (JSON format)', () => {
    beforeEach(async () => {
      // First call: page HTML, second call: robots.txt
      mockFetchHTML
        .mockResolvedValueOnce(makeSuccess(perfectHTML))
        .mockResolvedValueOnce(makeSuccess(robotsTxt, 'https://example.com/robots.txt'));

      await runCheck('https://example.com', { format: 'json', failOn: 'none' });
    });

    it('outputs valid JSON', () => {
      expect(logSpy).toHaveBeenCalledTimes(1);
      const output = logSpy.mock.calls[0][0] as string;
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it('includes all four analyzers', () => {
      const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);
      const names = parsed.results.map((r: any) => r.analyzer);
      expect(names).toContain('meta');
      expect(names).toContain('structured-data');
      expect(names).toContain('images');
      expect(names).toContain('robots');
    });

    it('includes URL in result', () => {
      const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);
      expect(parsed.url).toBe('https://example.com');
    });

    it('computes overall score as average of analyzer scores', () => {
      const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);
      const expectedAvg = Math.round(
        parsed.results.reduce((s: number, r: any) => s + r.score, 0) / parsed.results.length,
      );
      expect(parsed.score).toBe(expectedAvg);
    });
  });

  describe('successful check (terminal format)', () => {
    it('outputs terminal report', async () => {
      mockFetchHTML
        .mockResolvedValueOnce(makeSuccess(perfectHTML))
        .mockResolvedValueOnce(makeSuccess(robotsTxt));

      await runCheck('https://example.com', { format: 'terminal', failOn: 'none' });

      const output = logSpy.mock.calls[0][0] as string;
      // Strip ANSI for assertion
      const clean = output.replace(/\x1b\[[0-9;]*m/g, '');
      expect(clean).toContain('CrawlBeacon SEO Report');
      expect(clean).toContain('https://example.com');
    });
  });

  describe('fetch failure', () => {
    it('sets exit code 1 on fetch failure', async () => {
      mockFetchHTML.mockResolvedValue(makeFailure('Connection refused'));

      await runCheck('https://example.com', { format: 'json', failOn: 'none' });

      expect(process.exitCode).toBe(1);
    });

    it('outputs error JSON on fetch failure', async () => {
      mockFetchHTML.mockResolvedValue(makeFailure('Connection refused'));

      await runCheck('https://example.com', { format: 'json', failOn: 'none' });

      const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);
      expect(parsed.error).toBe('Connection refused');
      expect(parsed.url).toBe('https://example.com');
    });
  });

  describe('robots.txt fallback', () => {
    it('creates ROBOTS_NOT_FOUND issue when robots.txt fetch fails', async () => {
      mockFetchHTML
        .mockResolvedValueOnce(makeSuccess(perfectHTML))
        .mockResolvedValueOnce(makeFailure('Not found'));

      await runCheck('https://example.com', { format: 'json', failOn: 'none' });

      const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);
      const robots = parsed.results.find((r: any) => r.analyzer === 'robots');
      expect(robots).toBeDefined();
      expect(robots.issues).toHaveLength(1);
      expect(robots.issues[0].code).toBe('ROBOTS_NOT_FOUND');
      expect(robots.issues[0].severity).toBe('warning');
    });

    it('computes robots fallback score via computeScore (95 for one warning)', async () => {
      mockFetchHTML
        .mockResolvedValueOnce(makeSuccess(perfectHTML))
        .mockResolvedValueOnce(makeFailure('Not found'));

      await runCheck('https://example.com', { format: 'json', failOn: 'none' });

      const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);
      const robots = parsed.results.find((r: any) => r.analyzer === 'robots');
      expect(robots.score).toBe(95); // 100 - 5 for one warning
    });
  });

  describe('--fail-on error', () => {
    it('sets exit code 1 when errors exist', async () => {
      // missing-meta.html will trigger MISSING_TITLE, MISSING_DESCRIPTION, etc. (errors)
      mockFetchHTML
        .mockResolvedValueOnce(makeSuccess(missingHTML))
        .mockResolvedValueOnce(makeSuccess(robotsTxt));

      await runCheck('https://example.com', { format: 'json', failOn: 'error' });

      expect(process.exitCode).toBe(1);
    });

    it('does not set exit code when only warnings exist', async () => {
      // perfect page has only info/warning level issues (no errors)
      mockFetchHTML
        .mockResolvedValueOnce(makeSuccess(perfectHTML))
        .mockResolvedValueOnce(makeSuccess(robotsTxt));

      await runCheck('https://example.com', { format: 'json', failOn: 'error' });

      expect(process.exitCode).toBeUndefined();
    });
  });

  describe('--fail-on warning', () => {
    it('sets exit code 1 when warnings exist', async () => {
      mockFetchHTML
        .mockResolvedValueOnce(makeSuccess(perfectHTML))
        .mockResolvedValueOnce(makeFailure('Not found')); // robots 404 = warning

      await runCheck('https://example.com', { format: 'json', failOn: 'warning' });

      expect(process.exitCode).toBe(1);
    });
  });

  describe('--fail-on none', () => {
    it('never sets exit code regardless of issues', async () => {
      mockFetchHTML
        .mockResolvedValueOnce(makeSuccess(missingHTML))
        .mockResolvedValueOnce(makeSuccess(robotsTxt));

      await runCheck('https://example.com', { format: 'json', failOn: 'none' });

      expect(process.exitCode).toBeUndefined();
    });
  });

  describe('error recovery', () => {
    it('recovers when an analyzer throws', async () => {
      mockFetchHTML
        .mockResolvedValueOnce(makeSuccess(perfectHTML))
        .mockResolvedValueOnce(makeSuccess(robotsTxt));

      // Make analyzeMeta throw
      vi.mocked(analyzeMeta).mockImplementationOnce(() => {
        throw new Error('Analyzer exploded');
      });

      await runCheck('https://example.com', { format: 'json', failOn: 'none' });

      const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);
      const meta = parsed.results.find((r: any) => r.analyzer === 'meta');
      expect(meta.score).toBe(0);
      expect(meta.issues[0].code).toBe('ANALYZER_ERROR');
      expect(meta.issues[0].message).toContain('Analyzer exploded');
    });

    it('recovers when parsePage throws', async () => {
      mockFetchHTML
        .mockResolvedValueOnce(makeSuccess(perfectHTML));

      vi.mocked(parsePage).mockImplementationOnce(() => {
        throw new Error('Parse failed');
      });

      await runCheck('https://example.com', { format: 'json', failOn: 'none' });

      expect(process.exitCode).toBe(1);
      const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);
      expect(parsed.error).toContain('Parse error');
    });

    it('other analyzers still run when one crashes', async () => {
      mockFetchHTML
        .mockResolvedValueOnce(makeSuccess(perfectHTML))
        .mockResolvedValueOnce(makeSuccess(robotsTxt));

      vi.mocked(analyzeMeta).mockImplementationOnce(() => {
        throw new Error('boom');
      });

      await runCheck('https://example.com', { format: 'json', failOn: 'none' });

      const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);
      const names = parsed.results.map((r: any) => r.analyzer);
      expect(names).toContain('meta'); // fallback result
      expect(names).toContain('structured-data');
      expect(names).toContain('images');
      expect(names).toContain('robots');
    });
  });
});
