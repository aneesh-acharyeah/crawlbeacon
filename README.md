# CrawlBeacon

SEO linter for your deployment pipeline. Catch SEO issues before they reach production.

[![npm version](https://img.shields.io/npm/v/crawlbeacon.svg)](https://www.npmjs.com/package/crawlbeacon)
[![license](https://img.shields.io/npm/l/crawlbeacon.svg)](https://github.com/aneesh-acharyeah/crawlbeacon/blob/main/LICENSE)

## Quick Start

```bash
npx crawlbeacon check https://example.com
```

## Installation

```bash
# Run without installing
npx crawlbeacon check <url>

# Or install globally
npm install -g crawlbeacon
crawlbeacon check <url>
```

## CLI Usage

### `crawlbeacon check <url>`

Run SEO checks on a URL and get a scored report.

```bash
# Terminal output (default)
crawlbeacon check https://example.com

# JSON output (for CI pipelines)
crawlbeacon check https://example.com --format json

# Fail on warnings too (default: fail on errors only)
crawlbeacon check https://example.com --fail-on warning

# Never fail (exit 0 regardless of issues)
crawlbeacon check https://example.com --fail-on none
```

### Options

| Flag | Values | Default | Description |
|------|--------|---------|-------------|
| `-f, --format` | `terminal`, `json` | `terminal` | Output format |
| `--fail-on` | `error`, `warning`, `none` | `error` | When to exit with code 1 |

## Analyzers

CrawlBeacon runs 4 analyzers on every URL:

### Meta

Checks title, meta description, canonical URL, Open Graph tags, Twitter Cards, H1 tags, viewport, and lang attribute.

### Structured Data

Validates JSON-LD blocks: `@context`, `@type`, and type-specific required fields for Organization, Article, Product, and 10+ other schema types.

### Images

Checks alt text (missing or empty), `loading="lazy"` attribute, and explicit width/height (layout shift prevention).

### Robots

Fetches and analyzes `robots.txt`: wildcard blocks, search engine bot blocks (Googlebot, Bingbot, etc.), AI bot directives (GPTBot, ClaudeBot, etc.), sitemap references, and crawl-delay.

## Scoring

Each analyzer produces a score from 0 to 100:

```
score = 100 - (errors x 15) - (warnings x 5)
```

The overall score is the average of all analyzer scores. Info-level issues don't affect the score.

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | All checks passed (or `--fail-on none`) |
| `1` | Issues found matching `--fail-on` threshold |

## CI/CD Integration

### GitHub Actions

```yaml
- name: SEO Check
  run: npx crawlbeacon check ${{ env.DEPLOY_URL }} --fail-on error
```

### JSON Output for Parsing

```bash
crawlbeacon check https://example.com --format json | jq '.score'
```

## Programmatic API

```typescript
import { parsePage, analyzeMeta, analyzeImages } from 'crawlbeacon';

const page = parsePage(html, 'https://example.com');
const metaResult = analyzeMeta(page);
console.log(metaResult.score, metaResult.issues);
```

All analyzers are pure functions that accept a `ParsedPage` and return an `AnalyzerResult`.

## Requirements

- Node.js >= 18.0.0

## License

MIT
