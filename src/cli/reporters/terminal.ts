import pc from 'picocolors';
import Table from 'cli-table3';
import type { ScanResult } from '../../core/analyzers/types.js';
import type { Reporter } from './types.js';

function severityIcon(severity: string): string {
  switch (severity) {
    case 'error':
      return pc.red('x');
    case 'warning':
      return pc.yellow('!');
    case 'info':
      return pc.blue('i');
    default:
      return ' ';
  }
}

function severityLabel(severity: string): string {
  switch (severity) {
    case 'error':
      return pc.red('ERROR');
    case 'warning':
      return pc.yellow('WARN');
    case 'info':
      return pc.blue('INFO');
    default:
      return severity;
  }
}

function scoreColor(score: number): string {
  if (score >= 90) return pc.green(String(score));
  if (score >= 70) return pc.yellow(String(score));
  return pc.red(String(score));
}

function scoreBar(score: number): string {
  const filled = Math.round(score / 5);
  const empty = 20 - filled;
  const bar = pc.green('\u2588'.repeat(filled)) + pc.gray('\u2591'.repeat(empty));
  return bar;
}

export const terminalReporter: Reporter = {
  format(result: ScanResult): string {
    const lines: string[] = [];

    // Header
    lines.push('');
    lines.push(pc.bold(`  CrawlBeacon SEO Report`));
    lines.push(pc.gray(`  ${result.url}`));
    lines.push(pc.gray(`  ${result.timestamp}`));
    lines.push('');

    // Overall score
    lines.push(`  Overall Score: ${scoreColor(result.score)}/100  ${scoreBar(result.score)}`);
    lines.push('');

    // Analyzer scores table
    const scoreTable = new Table({
      head: [pc.bold('Analyzer'), pc.bold('Score'), pc.bold('Issues')],
      style: { head: [], border: [] },
      chars: {
        top: '\u2500', 'top-mid': '\u252c', 'top-left': '\u250c', 'top-right': '\u2510',
        bottom: '\u2500', 'bottom-mid': '\u2534', 'bottom-left': '\u2514', 'bottom-right': '\u2518',
        left: '\u2502', 'left-mid': '\u251c', mid: '\u2500', 'mid-mid': '\u253c',
        right: '\u2502', 'right-mid': '\u2524', middle: '\u2502',
      },
    });

    for (const r of result.results) {
      const errors = r.issues.filter((i) => i.severity === 'error').length;
      const warnings = r.issues.filter((i) => i.severity === 'warning').length;
      const infos = r.issues.filter((i) => i.severity === 'info').length;

      const parts: string[] = [];
      if (errors > 0) parts.push(pc.red(`${errors} error${errors > 1 ? 's' : ''}`));
      if (warnings > 0) parts.push(pc.yellow(`${warnings} warn${warnings > 1 ? 's' : ''}`));
      if (infos > 0) parts.push(pc.blue(`${infos} info`));
      if (parts.length === 0) parts.push(pc.green('none'));

      scoreTable.push([r.analyzer, scoreColor(r.score), parts.join(', ')]);
    }

    lines.push(scoreTable.toString());
    lines.push('');

    // Issues detail
    const allIssues = result.results.flatMap((r) =>
      r.issues.map((issue) => ({ ...issue, analyzer: r.analyzer })),
    );

    if (allIssues.length === 0) {
      lines.push(pc.green('  No issues found. Great job!'));
    } else {
      lines.push(pc.bold('  Issues'));
      lines.push('');

      // Group by severity
      const errors = allIssues.filter((i) => i.severity === 'error');
      const warnings = allIssues.filter((i) => i.severity === 'warning');
      const infos = allIssues.filter((i) => i.severity === 'info');

      for (const group of [errors, warnings, infos]) {
        for (const issue of group) {
          lines.push(`  ${severityIcon(issue.severity)} ${severityLabel(issue.severity)}  ${issue.message}`);
          if (issue.context) {
            lines.push(pc.gray(`           ${issue.context.length > 80 ? issue.context.slice(0, 80) + '...' : issue.context}`));
          }
        }
      }
    }

    lines.push('');
    return lines.join('\n');
  },
};
