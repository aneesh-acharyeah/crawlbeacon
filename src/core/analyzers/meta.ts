/**
 * Meta analyzer — checks title, description, canonical, OG, Twitter, headings, technical.
 * Pure function: ParsedPage → AnalyzerResult.
 */

import type { ParsedPage } from '../../utils/html-parser.js';
import type { AnalyzerResult, Issue } from './types.js';
import { computeScore } from './types.js';

const TITLE_MIN = 30;
const TITLE_MAX = 60;
const DESC_MIN = 70;
const DESC_MAX = 160;

export function analyzeMeta(page: ParsedPage): AnalyzerResult {
  const issues: Issue[] = [];

  // --- Title ---
  if (!page.title) {
    issues.push({
      code: 'MISSING_TITLE',
      severity: 'error',
      message: 'Page is missing a <title> tag.',
    });
  } else {
    if (page.title.length < TITLE_MIN) {
      issues.push({
        code: 'TITLE_TOO_SHORT',
        severity: 'warning',
        message: `Title is ${page.title.length} characters (recommended: ${TITLE_MIN}-${TITLE_MAX}).`,
        context: page.title,
      });
    } else if (page.title.length > TITLE_MAX) {
      issues.push({
        code: 'TITLE_TOO_LONG',
        severity: 'warning',
        message: `Title is ${page.title.length} characters (recommended: ${TITLE_MIN}-${TITLE_MAX}).`,
        context: page.title,
      });
    }
  }

  // --- Meta Description ---
  if (!page.metaDescription) {
    issues.push({
      code: 'MISSING_DESCRIPTION',
      severity: 'error',
      message: 'Page is missing a meta description.',
    });
  } else {
    if (page.metaDescription.length < DESC_MIN) {
      issues.push({
        code: 'DESCRIPTION_TOO_SHORT',
        severity: 'warning',
        message: `Meta description is ${page.metaDescription.length} characters (recommended: ${DESC_MIN}-${DESC_MAX}).`,
        context: page.metaDescription,
      });
    } else if (page.metaDescription.length > DESC_MAX) {
      issues.push({
        code: 'DESCRIPTION_TOO_LONG',
        severity: 'warning',
        message: `Meta description is ${page.metaDescription.length} characters (recommended: ${DESC_MIN}-${DESC_MAX}).`,
        context: page.metaDescription,
      });
    }
  }

  // --- Canonical ---
  if (!page.canonical) {
    issues.push({
      code: 'MISSING_CANONICAL',
      severity: 'warning',
      message: 'Page is missing a canonical URL.',
    });
  }

  // --- Open Graph ---
  if (!page.ogTitle) {
    issues.push({
      code: 'MISSING_OG_TITLE',
      severity: 'warning',
      message: 'Missing og:title meta tag.',
    });
  }
  if (!page.ogDescription) {
    issues.push({
      code: 'MISSING_OG_DESCRIPTION',
      severity: 'warning',
      message: 'Missing og:description meta tag.',
    });
  }
  if (!page.ogImage) {
    issues.push({
      code: 'MISSING_OG_IMAGE',
      severity: 'warning',
      message: 'Missing og:image meta tag.',
    });
  }

  // --- Twitter Cards ---
  if (!page.twitterCard) {
    issues.push({
      code: 'MISSING_TWITTER_CARD',
      severity: 'info',
      message: 'Missing twitter:card meta tag.',
    });
  }

  // --- H1 ---
  if (page.h1.length === 0) {
    issues.push({
      code: 'MISSING_H1',
      severity: 'error',
      message: 'Page has no H1 heading.',
    });
  } else if (page.h1.length > 1) {
    issues.push({
      code: 'MULTIPLE_H1',
      severity: 'warning',
      message: `Page has ${page.h1.length} H1 headings (recommended: exactly 1).`,
      context: page.h1.join(', '),
    });
  }

  // --- Lang ---
  if (!page.lang) {
    issues.push({
      code: 'MISSING_LANG',
      severity: 'warning',
      message: 'The <html> element is missing a lang attribute.',
    });
  }

  // --- Viewport ---
  if (!page.viewport) {
    issues.push({
      code: 'MISSING_VIEWPORT',
      severity: 'error',
      message: 'Page is missing a viewport meta tag (needed for mobile).',
    });
  }

  return {
    analyzer: 'meta',
    score: computeScore(issues),
    issues,
  };
}
