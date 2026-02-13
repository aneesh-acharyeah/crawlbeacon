/**
 * Robots.txt analyzer — full parser with directive extraction and SEO checks.
 * Pure function: robots.txt string → AnalyzerResult.
 */

import type { AnalyzerResult, Issue } from './types.js';
import { computeScore } from './types.js';

export interface RobotsDirective {
  userAgent: string;
  allow: string[];
  disallow: string[];
  crawlDelay: number | null;
}

export interface ParsedRobots {
  directives: RobotsDirective[];
  sitemaps: string[];
  raw: string;
}

const AI_BOTS = [
  'GPTBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-Web',
  'PerplexityBot',
  'Bytespider',
  'CCBot',
  'Google-Extended',
  'FacebookBot',
  'Applebot-Extended',
];

const SEARCH_BOTS = ['Googlebot', 'Bingbot', 'Slurp', 'DuckDuckBot', 'Baiduspider', 'YandexBot'];

export function parseRobotsTxt(content: string): ParsedRobots {
  const lines = content.split('\n').map((l) => l.trim());
  const directives: RobotsDirective[] = [];
  const sitemaps: string[] = [];
  let current: RobotsDirective | null = null;

  for (const line of lines) {
    // Skip empty lines and comments
    if (!line || line.startsWith('#')) continue;

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim().toLowerCase();
    const value = line.slice(colonIndex + 1).trim();

    // Strip inline comments
    const cleanValue = value.replace(/#.*$/, '').trim();

    if (key === 'user-agent') {
      current = { userAgent: cleanValue, allow: [], disallow: [], crawlDelay: null };
      directives.push(current);
    } else if (current) {
      if (key === 'disallow' && cleanValue) {
        current.disallow.push(cleanValue);
      } else if (key === 'allow' && cleanValue) {
        current.allow.push(cleanValue);
      } else if (key === 'crawl-delay') {
        const parsed = parseFloat(cleanValue);
        if (!isNaN(parsed)) current.crawlDelay = parsed;
      }
    }

    if (key === 'sitemap') {
      sitemaps.push(cleanValue);
    }
  }

  return { directives, sitemaps, raw: content };
}

export function analyzeRobots(content: string): AnalyzerResult {
  const issues: Issue[] = [];

  if (!content.trim()) {
    issues.push({
      code: 'EMPTY_ROBOTS',
      severity: 'warning',
      message: 'robots.txt is empty.',
    });
    return { analyzer: 'robots', score: computeScore(issues), issues };
  }

  const parsed = parseRobotsTxt(content);

  if (parsed.directives.length === 0) {
    issues.push({
      code: 'NO_DIRECTIVES',
      severity: 'warning',
      message: 'robots.txt has no User-agent directives.',
    });
  }

  // Check for wildcard disallow-all
  const wildcardAgent = parsed.directives.find((d) => d.userAgent === '*');
  if (wildcardAgent?.disallow.includes('/')) {
    issues.push({
      code: 'BLOCKS_ALL_CRAWLERS',
      severity: 'error',
      message: 'robots.txt blocks all crawlers with "Disallow: /" for User-agent: *.',
    });
  }

  // Check search engine bot blocks
  for (const bot of SEARCH_BOTS) {
    const directive = parsed.directives.find(
      (d) => d.userAgent.toLowerCase() === bot.toLowerCase(),
    );
    if (directive?.disallow.includes('/')) {
      issues.push({
        code: 'BLOCKS_SEARCH_BOT',
        severity: 'error',
        message: `robots.txt blocks ${bot} with "Disallow: /".`,
        context: bot,
      });
    }
  }

  // Check AI bot directives
  const blockedAiBots: string[] = [];
  const allowedAiBots: string[] = [];
  for (const bot of AI_BOTS) {
    const directive = parsed.directives.find(
      (d) => d.userAgent.toLowerCase() === bot.toLowerCase(),
    );
    if (directive) {
      if (directive.disallow.includes('/')) {
        blockedAiBots.push(bot);
      } else if (directive.allow.length > 0 || directive.disallow.length === 0) {
        allowedAiBots.push(bot);
      }
    }
  }

  if (blockedAiBots.length > 0) {
    issues.push({
      code: 'AI_BOTS_BLOCKED',
      severity: 'info',
      message: `${blockedAiBots.length} AI bot(s) blocked: ${blockedAiBots.join(', ')}.`,
      context: blockedAiBots.join(', '),
    });
  }

  // No AI bot directives at all
  const hasAnyAiDirective = AI_BOTS.some((bot) =>
    parsed.directives.some((d) => d.userAgent.toLowerCase() === bot.toLowerCase()),
  );
  if (!hasAnyAiDirective) {
    issues.push({
      code: 'NO_AI_BOT_DIRECTIVES',
      severity: 'info',
      message: 'No explicit AI bot directives found. Consider adding GPTBot, ClaudeBot, etc.',
    });
  }

  // Sitemap references
  if (parsed.sitemaps.length === 0) {
    issues.push({
      code: 'NO_SITEMAP_REFERENCE',
      severity: 'warning',
      message: 'robots.txt does not reference a sitemap. Add a "Sitemap:" directive.',
    });
  }

  // Crawl-delay check
  const delayDirectives = parsed.directives.filter((d) => d.crawlDelay !== null);
  for (const d of delayDirectives) {
    if (d.crawlDelay! > 10) {
      issues.push({
        code: 'HIGH_CRAWL_DELAY',
        severity: 'warning',
        message: `Crawl-delay of ${d.crawlDelay}s for ${d.userAgent} may slow indexing.`,
        context: `${d.userAgent}: ${d.crawlDelay}`,
      });
    }
  }

  return {
    analyzer: 'robots',
    score: computeScore(issues),
    issues,
  };
}
