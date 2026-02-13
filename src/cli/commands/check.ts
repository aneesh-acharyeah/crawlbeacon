/**
 * `crawlbeacon check <url>` command.
 * Fetches a page, runs all analyzers, outputs via selected reporter.
 */

import ora from 'ora';
import pc from 'picocolors';
import { fetchHTML } from '../../utils/fetcher.js';
import { parsePage } from '../../utils/html-parser.js';
import { analyzeMeta } from '../../core/analyzers/meta.js';
import { analyzeStructuredData } from '../../core/analyzers/structured-data.js';
import { analyzeImages } from '../../core/analyzers/images.js';
import { analyzeRobots } from '../../core/analyzers/robots.js';
import { computeScore } from '../../core/analyzers/types.js';
import type { AnalyzerResult, ScanResult, Severity } from '../../core/analyzers/types.js';
import { terminalReporter } from '../reporters/terminal.js';
import { jsonReporter } from '../reporters/json.js';
import type { Reporter } from '../reporters/types.js';

export interface CheckOptions {
  format: 'terminal' | 'json';
  failOn: 'error' | 'warning' | 'none';
}

/** Run a single analyzer safely — returns fallback result on error */
function safeAnalyze(
  name: string,
  fn: () => AnalyzerResult,
): AnalyzerResult {
  try {
    return fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      analyzer: name,
      score: 0,
      issues: [{
        code: 'ANALYZER_ERROR',
        severity: 'error' as Severity,
        message: `Analyzer "${name}" crashed: ${message}`,
      }],
    };
  }
}

export async function runCheck(url: string, options: CheckOptions): Promise<void> {
  // Normalize URL
  let normalizedUrl = url;
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = `https://${normalizedUrl}`;
  }

  const isJson = options.format === 'json';
  const spinner = isJson ? null : ora(`Fetching ${pc.cyan(normalizedUrl)}`).start();

  // 1. Fetch the page HTML
  const htmlResult = await fetchHTML(normalizedUrl);
  if (!htmlResult.success) {
    if (spinner) spinner.fail(`Failed to fetch: ${htmlResult.message}`);
    if (isJson) {
      console.log(JSON.stringify({ error: htmlResult.message, url: normalizedUrl }, null, 2));
    }
    process.exitCode = 1;
    return;
  }

  if (spinner) spinner.text = 'Parsing HTML...';

  // 2. Parse the page
  let page;
  try {
    page = parsePage(htmlResult.data, htmlResult.finalUrl || normalizedUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (spinner) spinner.fail(`Failed to parse HTML: ${message}`);
    if (isJson) {
      console.log(JSON.stringify({ error: `Parse error: ${message}`, url: normalizedUrl }, null, 2));
    }
    process.exitCode = 1;
    return;
  }

  if (spinner) spinner.text = 'Running analyzers...';

  // 3. Run analyzers (each wrapped in error boundary)
  const results: AnalyzerResult[] = [
    safeAnalyze('meta', () => analyzeMeta(page)),
    safeAnalyze('structured-data', () => analyzeStructuredData(page)),
    safeAnalyze('images', () => analyzeImages(page)),
  ];

  // 4. Fetch and analyze robots.txt
  if (spinner) spinner.text = 'Checking robots.txt...';
  try {
    const robotsUrl = new URL('/robots.txt', normalizedUrl).href;
    const robotsResult = await fetchHTML(robotsUrl);
    if (robotsResult.success) {
      results.push(safeAnalyze('robots', () => analyzeRobots(robotsResult.data)));
    } else {
      const issues = [{
        code: 'ROBOTS_NOT_FOUND',
        severity: 'warning' as Severity,
        message: `Could not fetch robots.txt: ${robotsResult.message}`,
      }];
      results.push({ analyzer: 'robots', score: computeScore(issues), issues });
    }
  } catch {
    const issues = [{
      code: 'ROBOTS_FETCH_ERROR',
      severity: 'warning' as Severity,
      message: 'Failed to fetch robots.txt.',
    }];
    results.push({ analyzer: 'robots', score: computeScore(issues), issues });
  }

  // 5. Build scan result
  const totalScore = results.length > 0
    ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
    : 0;

  const scanResult: ScanResult = {
    url: normalizedUrl,
    timestamp: new Date().toISOString(),
    score: totalScore,
    results,
  };

  if (spinner) spinner.stop();

  // 6. Output (with fallback if reporter crashes)
  const reporter: Reporter = options.format === 'json' ? jsonReporter : terminalReporter;
  try {
    console.log(reporter.format(scanResult));
  } catch {
    console.log(JSON.stringify(scanResult, null, 2));
  }

  // 7. Exit code based on --fail-on
  if (options.failOn !== 'none') {
    const allIssues = results.flatMap((r) => r.issues);
    const hasErrors = allIssues.some((i) => i.severity === 'error');
    const hasWarnings = allIssues.some((i) => i.severity === 'warning');

    if (options.failOn === 'error' && hasErrors) {
      process.exitCode = 1;
    } else if (options.failOn === 'warning' && (hasErrors || hasWarnings)) {
      process.exitCode = 1;
    }
  }
}
