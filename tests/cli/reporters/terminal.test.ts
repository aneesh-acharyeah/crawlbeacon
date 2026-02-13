import { describe, it, expect } from 'vitest';
import { terminalReporter } from '../../../src/cli/reporters/terminal.js';
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
          { code: 'MISSING_TITLE', severity: 'error', message: 'Page is missing a <title> tag.' },
        ],
      },
      {
        analyzer: 'images',
        score: 100,
        issues: [],
      },
      {
        analyzer: 'structured-data',
        score: 95,
        issues: [
          { code: 'NO_AI_BOT_DIRECTIVES', severity: 'info', message: 'No AI bot directives found.' },
        ],
      },
    ],
    ...overrides,
  };
}

// Strip ANSI color codes for easier assertion
function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

describe('terminalReporter', () => {
  it('includes report header', () => {
    const output = stripAnsi(terminalReporter.format(makeScanResult()));
    expect(output).toContain('CrawlBeacon SEO Report');
  });

  it('includes the URL', () => {
    const output = stripAnsi(terminalReporter.format(makeScanResult()));
    expect(output).toContain('https://example.com');
  });

  it('includes the timestamp', () => {
    const output = stripAnsi(terminalReporter.format(makeScanResult()));
    expect(output).toContain('2025-01-01T00:00:00.000Z');
  });

  it('includes overall score', () => {
    const output = stripAnsi(terminalReporter.format(makeScanResult()));
    expect(output).toContain('85/100');
  });

  it('includes analyzer names in table', () => {
    const output = stripAnsi(terminalReporter.format(makeScanResult()));
    expect(output).toContain('meta');
    expect(output).toContain('images');
    expect(output).toContain('structured-data');
  });

  it('shows issue counts per analyzer', () => {
    const output = stripAnsi(terminalReporter.format(makeScanResult()));
    expect(output).toContain('1 error');
    expect(output).toContain('1 warn');
    expect(output).toContain('none'); // images has no issues
  });

  it('shows "No issues found" for perfect results', () => {
    const perfect = makeScanResult({
      score: 100,
      results: [
        { analyzer: 'meta', score: 100, issues: [] },
        { analyzer: 'images', score: 100, issues: [] },
      ],
    });
    const output = stripAnsi(terminalReporter.format(perfect));
    expect(output).toContain('No issues found');
  });

  it('shows issues grouped by severity (errors first)', () => {
    const output = stripAnsi(terminalReporter.format(makeScanResult()));
    const errorPos = output.indexOf('ERROR');
    const warnPos = output.indexOf('WARN');
    const infoPos = output.indexOf('INFO');
    // Errors should appear before warnings, warnings before info
    expect(errorPos).toBeLessThan(warnPos);
    expect(warnPos).toBeLessThan(infoPos);
  });

  it('shows issue messages', () => {
    const output = stripAnsi(terminalReporter.format(makeScanResult()));
    expect(output).toContain('Page is missing a <title> tag.');
    expect(output).toContain('Page is missing a canonical URL.');
  });

  it('shows context when present, truncated at 80 chars', () => {
    const result = makeScanResult({
      results: [{
        analyzer: 'meta',
        score: 85,
        issues: [{
          code: 'TITLE_TOO_LONG',
          severity: 'warning',
          message: 'Title too long',
          context: 'A'.repeat(100), // 100 chars, should be truncated
        }],
      }],
    });
    const output = stripAnsi(terminalReporter.format(result));
    expect(output).toContain('A'.repeat(80) + '...');
    expect(output).not.toContain('A'.repeat(100));
  });

  it('shows short context without truncation', () => {
    const result = makeScanResult({
      results: [{
        analyzer: 'meta',
        score: 85,
        issues: [{
          code: 'TITLE_TOO_SHORT',
          severity: 'warning',
          message: 'Title too short',
          context: 'Short title',
        }],
      }],
    });
    const output = stripAnsi(terminalReporter.format(result));
    expect(output).toContain('Short title');
  });
});
