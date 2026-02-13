# CLAUDE.md — CrawlBeacon CLI

## Project Overview

**CrawlBeacon** is an SEO linter for deployment pipelines. It checks any URL for SEO issues and produces a scored report — designed for CI/CD integration via `npx crawlbeacon check <url>`.

**Repo:** https://github.com/aneesh-acharyeah/crawlbeacon
**Web app (separate repo):** `C:\sitemap` — marketing site + free online tools at crawlbeacon.com

## Tech Stack

- **Language:** TypeScript 5.5, strict mode, ES2022 target
- **Build:** tsup 8 (dual CJS + ESM output, CLI binary with shebang)
- **Testing:** vitest 2, v8 coverage provider
- **CLI:** commander 12, ora (spinner), picocolors (colors), cli-table3 (tables)
- **Parsing:** cheerio 1 (HTML), xmlbuilder2 (XML generation)
- **HTTP:** axios 1.7 with robust error handling
- **Validation:** zod 3.23
- **Node:** >= 18.0.0 (see `engines` in package.json)
- **Module system:** ESM (`"type": "module"`)

## Project Structure

```
crawlbeacon/
├── src/
│   ├── index.ts                    # Public API barrel exports
│   ├── cli/
│   │   ├── index.ts                # Commander setup (entry point for dist/cli.js)
│   │   ├── commands/
│   │   │   └── check.ts            # `crawlbeacon check <url>` — full pipeline
│   │   └── reporters/
│   │       ├── types.ts            # Reporter interface
│   │       ├── terminal.ts         # Colored table + score bar + severity groups
│   │       └── json.ts             # JSON.stringify for CI piping
│   ├── core/
│   │   └── analyzers/
│   │       ├── types.ts            # Severity, Issue, AnalyzerResult, ScanResult, computeScore()
│   │       ├── index.ts            # Barrel exports
│   │       ├── meta.ts             # Title, description, canonical, OG, Twitter, H1, viewport, lang
│   │       ├── structured-data.ts  # JSON-LD validation, type-specific field checks
│   │       ├── images.ts           # Alt text, lazy loading, dimensions
│   │       └── robots.ts           # Full robots.txt parser + SEO/AI bot analysis
│   └── utils/
│       ├── fetcher.ts              # robustFetch, fetchHTML, fetchXML, checkURL, fetchBatch
│       ├── html-parser.ts          # parsePage() → ParsedPage (26+ fields via cheerio)
│       ├── xml-builder.ts          # buildSitemapXML() with SitemapEntry interface
│       ├── url.ts                  # normalizeUrl, isValidUrl, isSameOrigin, resolveUrl
│       └── logger.ts              # Debug logger (CRAWLBEACON_DEBUG=1)
├── tests/
│   ├── cli/
│   │   ├── commands/
│   │   │   └── check.test.ts       # 19 tests (mocked fetcher, error recovery)
│   │   └── reporters/
│   │       ├── json.test.ts        # 5 tests
│   │       └── terminal.test.ts    # 11 tests
│   ├── core/analyzers/
│   │   ├── meta.test.ts            # 18 tests
│   │   ├── structured-data.test.ts # 8 tests
│   │   ├── images.test.ts          # 9 tests
│   │   ├── robots.test.ts          # 17 tests
│   │   ├── html-parser.test.ts     # 15 tests
│   │   └── edge-cases.test.ts      # 19 tests (empty, malformed, invalid JSON-LD, duplicates)
│   └── fixtures/
│       ├── html/
│       │   ├── perfect-seo.html    # Full SEO page (all tags, images, JSON-LD)
│       │   ├── missing-meta.html   # Bare page with no SEO tags
│       │   ├── empty.html          # Just <html></html>
│       │   ├── malformed.html      # Unclosed tags, broken structure
│       │   ├── json-ld-invalid.html # Broken + valid JSON-LD blocks
│       │   └── duplicate-meta.html # Multiple title/description/canonical tags
│       └── robots/
│           ├── standard.txt        # Typical with AI bot blocks + sitemap
│           ├── blocking-all.txt    # Disallow: /
│           └── minimal.txt         # Just User-agent and Allow
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
└── README.md
```

## Running Locally

```bash
npm install
npm run build          # tsup → dist/ (CJS + ESM + DTS + CLI)
npm run dev            # tsup --watch
npm test               # vitest (watch mode)
npm run test:run       # vitest run (single run, 121 tests)
npm run test:coverage  # vitest run --coverage
npm run lint           # tsc --noEmit (type check)
```

## CLI Usage

```bash
# Run from built dist
node dist/cli.js check <url>
node dist/cli.js check <url> --format json
node dist/cli.js check <url> --fail-on warning

# Or via npm link / npx
npx crawlbeacon check <url>
```

### CLI Options

| Flag | Values | Default | Description |
|------|--------|---------|-------------|
| `-f, --format` | `terminal`, `json` | `terminal` | Output format |
| `--fail-on` | `error`, `warning`, `none` | `error` | When to exit with code 1 |

### Exit Codes

- `0` — All checks passed (or `--fail-on none`)
- `1` — Issues found matching `--fail-on` threshold, or fetch/parse failure

## Architecture

### Data Flow

```
URL → fetchHTML() → parsePage() → [analyzeMeta, analyzeStructuredData, analyzeImages] → ScanResult
                                   fetchHTML(robots.txt) → analyzeRobots() ──────────────────┘
                                                                        ↓
                                                              reporter.format() → stdout
```

### Core Types (`src/core/analyzers/types.ts`)

```typescript
type Severity = 'error' | 'warning' | 'info';

interface Issue {
  code: string;        // e.g. 'MISSING_TITLE', 'IMAGES_NO_ALT'
  severity: Severity;
  message: string;
  context?: string;    // Value that triggered the issue
}

interface AnalyzerResult {
  analyzer: string;    // e.g. 'meta', 'images'
  score: number;       // 0-100
  issues: Issue[];
}

interface ScanResult {
  url: string;
  timestamp: string;   // ISO 8601
  score: number;       // Average of all analyzer scores
  results: AnalyzerResult[];
}
```

### Scoring

```
score = 100 - (errors × 15) - (warnings × 5)
```

Clamped to [0, 100]. Info-level issues don't affect score. Overall score is the average of all analyzer scores.

### Analyzer Signatures

All analyzers are **pure functions** — no side effects, no network calls.

```typescript
analyzeMeta(page: ParsedPage): AnalyzerResult
analyzeStructuredData(page: ParsedPage): AnalyzerResult
analyzeImages(page: ParsedPage): AnalyzerResult
analyzeRobots(content: string): AnalyzerResult          // takes raw robots.txt string
parseRobotsTxt(content: string): ParsedRobots            // parser only, no scoring
```

### ParsedPage Interface (`src/utils/html-parser.ts`)

The `parsePage(html, pageUrl)` function extracts:

| Group | Fields |
|-------|--------|
| Meta | `title`, `metaDescription`, `canonical`, `robots` |
| Open Graph | `ogTitle`, `ogDescription`, `ogImage`, `ogType`, `ogUrl` |
| Twitter | `twitterCard`, `twitterTitle`, `twitterDescription`, `twitterImage` |
| Structured Data | `jsonLd: object[]` |
| Images | `images: ImageData[]` (src, alt, loading, width, height) |
| Links | `internalLinks: string[]`, `externalLinks: string[]` |
| Headings | `h1: string[]`, `h2: string[]` |
| Technical | `lang`, `charset`, `viewport` |

### Fetcher (`src/utils/fetcher.ts`)

Drop-in replacement for raw axios with structured error handling.

**Error codes:** `TIMEOUT`, `ACCESS_RESTRICTED`, `SOFT_PROTECTED`, `NETWORK_ERROR`, `INVALID_RESPONSE`, `RATE_LIMITED`, `SERVER_ERROR`

**Functions:**
- `robustFetch(url, options?)` — general purpose, returns `FetchResult`
- `fetchHTML(url, options?)` — HTML-specific
- `fetchXML(url, options?)` — XML-specific, validates content type
- `checkURL(url, options?)` — HEAD request, 8s timeout
- `fetchBatch(urls, options?)` — concurrent fetching with progress callback

**Defaults:** 15s timeout, 5 max redirects, Chrome User-Agent, detects CAPTCHA/Cloudflare challenges.

### Reporter Interface (`src/cli/reporters/types.ts`)

```typescript
interface Reporter {
  format(result: ScanResult): string;
}
```

Two implementations: `terminalReporter` (colored table) and `jsonReporter` (JSON.stringify).

## Issue Codes Reference

### Meta Analyzer
| Code | Severity | Trigger |
|------|----------|---------|
| `MISSING_TITLE` | error | No `<title>` tag |
| `TITLE_TOO_SHORT` | warning | Title < 30 chars |
| `TITLE_TOO_LONG` | warning | Title > 60 chars |
| `MISSING_DESCRIPTION` | error | No meta description |
| `DESCRIPTION_TOO_SHORT` | warning | Description < 70 chars |
| `DESCRIPTION_TOO_LONG` | warning | Description > 160 chars |
| `MISSING_CANONICAL` | warning | No canonical URL |
| `MISSING_OG_TITLE` | warning | No og:title |
| `MISSING_OG_DESCRIPTION` | warning | No og:description |
| `MISSING_OG_IMAGE` | warning | No og:image |
| `MISSING_TWITTER_CARD` | info | No twitter:card |
| `MISSING_H1` | error | No H1 tag |
| `MULTIPLE_H1` | warning | More than one H1 |
| `MISSING_VIEWPORT` | error | No viewport meta |
| `MISSING_LANG` | warning | No lang attribute on `<html>` |

### Images Analyzer
| Code | Severity | Trigger |
|------|----------|---------|
| `NO_IMAGES` | info | Page has no images |
| `IMAGES_MISSING_ALT` | error | Images without alt attribute |
| `IMAGES_EMPTY_ALT` | warning | Images with empty alt text |
| `IMAGES_NOT_LAZY` | info | Images missing `loading="lazy"` |
| `IMAGES_MISSING_DIMENSIONS` | warning | Images missing width/height |

### Structured Data Analyzer
| Code | Severity | Trigger |
|------|----------|---------|
| `NO_STRUCTURED_DATA` | warning | No JSON-LD found |
| `MISSING_CONTEXT` | error | JSON-LD missing `@context` |
| `INVALID_CONTEXT` | warning | `@context` not schema.org |
| `MISSING_TYPE` | error | JSON-LD missing `@type` |
| `MISSING_REQUIRED_FIELD` | warning | Type-specific required field missing |

### Robots Analyzer
| Code | Severity | Trigger |
|------|----------|---------|
| `EMPTY_ROBOTS` | warning | Empty robots.txt |
| `NO_DIRECTIVES` | warning | No User-agent directives |
| `BLOCKS_ALL_CRAWLERS` | error | `Disallow: /` for `User-agent: *` |
| `BLOCKS_SEARCH_BOT` | error | Specific search bot blocked |
| `AI_BOTS_BLOCKED` | info | AI bots blocked (GPTBot, ClaudeBot, etc.) |
| `NO_AI_BOT_DIRECTIVES` | info | No explicit AI bot rules |
| `NO_SITEMAP_REFERENCE` | warning | No `Sitemap:` directive |
| `HIGH_CRAWL_DELAY` | warning | Crawl-delay > 10s |

### CLI-level Codes
| Code | Severity | Trigger |
|------|----------|---------|
| `ROBOTS_NOT_FOUND` | warning | Failed to fetch robots.txt |
| `ROBOTS_FETCH_ERROR` | warning | Exception fetching robots.txt |
| `ANALYZER_ERROR` | error | Analyzer crashed (caught by safeAnalyze) |

## Error Handling

The `check` command has three layers of error handling:

1. **Fetch failure** — exits with code 1, outputs error message (JSON or terminal)
2. **Parse failure** — `parsePage()` wrapped in try-catch, exits with code 1
3. **Analyzer failure** — each analyzer wrapped in `safeAnalyze()`, returns fallback `AnalyzerResult` with score 0 and `ANALYZER_ERROR` issue (other analyzers still run)
4. **Reporter failure** — `reporter.format()` wrapped in try-catch, falls back to `JSON.stringify`

## Build Output

tsup produces two entry points:

| Output | Format | Purpose |
|--------|--------|---------|
| `dist/index.js` | ESM | Programmatic API import |
| `dist/index.cjs` | CJS | Programmatic API require |
| `dist/index.d.ts` | DTS | TypeScript declarations |
| `dist/cli.js` | ESM + shebang | CLI binary (`#!/usr/bin/env node`) |

The shebang is added by tsup's `banner` config — do NOT add `#!/usr/bin/env node` to `src/cli/index.ts` (causes duplicate shebang).

## Testing Patterns

- **Analyzer tests:** Read HTML fixtures with `readFileSync`, call `parsePage()`, then test analyzer output
- **CLI tests:** Mock `ora` (spinner) and `fetchHTML` via `vi.mock()`, spy on `console.log`, assert JSON output
- **Error recovery tests:** Mock analyzers to throw, verify `safeAnalyze()` catches and returns fallback
- **Edge case tests:** Test against empty, malformed, invalid JSON-LD, duplicate meta fixtures
- **No live HTTP calls in tests** — all network calls are mocked

## Environment Variables

- `CRAWLBEACON_DEBUG=1` — enables debug logging to stderr
- `REACT_APP_API_URL` — not used (web app only)

## npm Publishing

```bash
npm run prepublishOnly   # builds + runs tests
npm pack --dry-run       # verify package contents (should be ~63KB, 10 files)
npm publish              # publish to npm registry
```

**Package includes:** `dist/`, `README.md`, `LICENSE`

## Key Conventions

- **Pure analyzers** — no side effects, no network calls, deterministic output
- **No emojis in output** — use text symbols (x, !, i) for severity icons
- **All imports use `.js` extension** — required for ESM resolution
- **Severity order** — errors displayed first, then warnings, then info
- **Score clamped to [0, 100]** — never negative, never above 100
- **Context truncated at 80 chars** in terminal reporter
- **Git branching:** `develop` for development, `main` for production

## Common Pitfalls

- **Duplicate shebang:** tsup banner adds `#!/usr/bin/env node` — never add it to source `src/cli/index.ts`
- **ESM imports:** All relative imports must end with `.js` (e.g., `'./types.js'`), even though source is `.ts`
- **Cheerio behavior:** Malformed HTML may produce unexpected results (unclosed H1 tags get nested, not counted as separate elements)
- **JSON-LD parsing:** `parsePage` silently filters broken JSON-LD blocks (returns `null`, filtered out) — valid blocks still extracted
- **robots.txt fetch:** Uses `fetchHTML` not `robustFetch` — robots.txt is treated as text content
- **Test mocking:** When mocking `fetchHTML`, remember it's called twice in check command (once for page, once for robots.txt) — use `mockResolvedValueOnce` for each
