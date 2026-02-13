/**
 * Images analyzer — checks alt text, lazy loading, and dimensions.
 * Pure function: ParsedPage → AnalyzerResult.
 */

import type { ParsedPage } from '../../utils/html-parser.js';
import type { AnalyzerResult, Issue } from './types.js';
import { computeScore } from './types.js';

export function analyzeImages(page: ParsedPage): AnalyzerResult {
  const issues: Issue[] = [];

  if (page.images.length === 0) {
    issues.push({
      code: 'NO_IMAGES',
      severity: 'info',
      message: 'No images found on the page.',
    });
    return { analyzer: 'images', score: computeScore(issues), issues };
  }

  let missingAlt = 0;
  let emptyAlt = 0;
  let missingLazy = 0;
  let missingDimensions = 0;

  for (const img of page.images) {
    if (img.alt === null) {
      missingAlt++;
    } else if (img.alt.trim() === '') {
      emptyAlt++;
    }

    if (!img.loading) {
      missingLazy++;
    }

    if (!img.width || !img.height) {
      missingDimensions++;
    }
  }

  const total = page.images.length;

  if (missingAlt > 0) {
    issues.push({
      code: 'IMAGES_MISSING_ALT',
      severity: 'error',
      message: `${missingAlt} of ${total} image(s) missing alt attribute.`,
      context: page.images
        .filter((i) => i.alt === null)
        .map((i) => i.src)
        .slice(0, 5)
        .join(', '),
    });
  }

  if (emptyAlt > 0) {
    issues.push({
      code: 'IMAGES_EMPTY_ALT',
      severity: 'warning',
      message: `${emptyAlt} of ${total} image(s) have empty alt text. Use descriptive alt text unless the image is decorative.`,
      context: page.images
        .filter((i) => i.alt !== null && i.alt.trim() === '')
        .map((i) => i.src)
        .slice(0, 5)
        .join(', '),
    });
  }

  if (missingLazy > 0) {
    issues.push({
      code: 'IMAGES_NOT_LAZY',
      severity: 'info',
      message: `${missingLazy} of ${total} image(s) missing loading="lazy" attribute.`,
    });
  }

  if (missingDimensions > 0) {
    issues.push({
      code: 'IMAGES_MISSING_DIMENSIONS',
      severity: 'warning',
      message: `${missingDimensions} of ${total} image(s) missing explicit width/height (causes layout shift).`,
      context: page.images
        .filter((i) => !i.width || !i.height)
        .map((i) => i.src)
        .slice(0, 5)
        .join(', '),
    });
  }

  return {
    analyzer: 'images',
    score: computeScore(issues),
    issues,
  };
}
