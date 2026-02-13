/**
 * Structured data analyzer — validates JSON-LD presence and structure.
 * Pure function: ParsedPage → AnalyzerResult.
 */

import type { ParsedPage } from '../../utils/html-parser.js';
import type { AnalyzerResult, Issue } from './types.js';
import { computeScore } from './types.js';

/** Required fields per common schema.org type */
const TYPE_REQUIREMENTS: Record<string, string[]> = {
  Organization: ['name', 'url'],
  WebSite: ['name', 'url'],
  Article: ['headline', 'author', 'datePublished'],
  NewsArticle: ['headline', 'author', 'datePublished'],
  BlogPosting: ['headline', 'author', 'datePublished'],
  Product: ['name'],
  FAQPage: ['mainEntity'],
  BreadcrumbList: ['itemListElement'],
  LocalBusiness: ['name', 'address'],
  Person: ['name'],
  WebPage: ['name'],
  Event: ['name', 'startDate', 'location'],
};

export function analyzeStructuredData(page: ParsedPage): AnalyzerResult {
  const issues: Issue[] = [];

  if (page.jsonLd.length === 0) {
    issues.push({
      code: 'NO_STRUCTURED_DATA',
      severity: 'warning',
      message: 'No JSON-LD structured data found on the page.',
    });
    return { analyzer: 'structured-data', score: computeScore(issues), issues };
  }

  for (let i = 0; i < page.jsonLd.length; i++) {
    const item = page.jsonLd[i] as Record<string, unknown>;
    const label = page.jsonLd.length > 1 ? ` (block ${i + 1})` : '';

    // @context check
    if (!item['@context']) {
      issues.push({
        code: 'MISSING_CONTEXT',
        severity: 'error',
        message: `JSON-LD${label} is missing @context.`,
      });
    } else {
      const ctx = String(item['@context']);
      if (!ctx.includes('schema.org')) {
        issues.push({
          code: 'INVALID_CONTEXT',
          severity: 'warning',
          message: `JSON-LD${label} @context is "${ctx}" — expected schema.org.`,
          context: ctx,
        });
      }
    }

    // @type check
    if (!item['@type']) {
      issues.push({
        code: 'MISSING_TYPE',
        severity: 'error',
        message: `JSON-LD${label} is missing @type.`,
      });
      continue;
    }

    // Type-specific field checks
    const typeName = String(item['@type']);
    const required = TYPE_REQUIREMENTS[typeName];
    if (required) {
      for (const field of required) {
        if (!item[field] && item[field] !== 0 && item[field] !== false) {
          issues.push({
            code: 'MISSING_FIELD',
            severity: 'warning',
            message: `JSON-LD ${typeName}${label} is missing recommended field "${field}".`,
            context: typeName,
          });
        }
      }
    }

    // Check for @graph pattern
    if (item['@graph'] && Array.isArray(item['@graph'])) {
      for (let j = 0; j < (item['@graph'] as unknown[]).length; j++) {
        const graphItem = (item['@graph'] as Record<string, unknown>[])[j];
        if (!graphItem['@type']) {
          issues.push({
            code: 'GRAPH_MISSING_TYPE',
            severity: 'warning',
            message: `JSON-LD @graph item ${j + 1} is missing @type.`,
          });
        }
      }
    }
  }

  return {
    analyzer: 'structured-data',
    score: computeScore(issues),
    issues,
  };
}
