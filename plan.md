# CrawlBeacon CLI — plan.md

> Complete roadmap for the CLI product. Every task, every phase, every spec.
> This file is the source of truth for what to build and in what order.

---

## Vision

"ESLint for SEO." `npx crawlbeacon check` becomes as natural as `npm test` before every deploy.

**Positioning:** For developers who ship daily, CrawlBeacon is the SEO linter that catches broken meta tags, missing sitemaps, and SEO regressions in every PR — before they hit production.

---

## Architecture

```
┌─────────────────────────────────────────────┐
│              CONSUMERS (thin)                │
│  CLI (commander)  │  GitHub Action  │  API   │
└────────┬──────────┴────────┬────────┴───┬────┘
         │                   │            │
         ▼                   ▼            ▼
┌─────────────────────────────────────────────┐
│              CORE ENGINE (thick)             │
│  Analyzers → Reporters → Differ → Config    │
└────────┬────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│              UTILITIES (shared)              │
│  Fetcher → HTML Parser → XML Builder        │
└─────────────────────────────────────────────┘
```

**Rules:**
1. Every analyzer is a pure function: input URL/HTML → output structured result
2. No side effects in core (no console.log, no file writes)
3. Reporters are separate from analyzers
4. Configuration is declarative (`.crawlbeacon.yml`)

---

## CLI Commands (current + planned)

```bash
# SHIPPED (v0.1.0)
npx crawlbeacon check <url>                          # Single page audit
npx crawlbeacon check <url> --format json             # JSON output for CI
npx crawlbeacon check <url> --fail-on warning         # Strict mode

# PHASE 2 (building next)
npx crawlbeacon analyze --dir ./app                   # Next.js framework analysis
npx crawlbeacon analyze --dir ./app --framework nextjs # Explicit framework
npx crawlbeacon check <url> --strict                  # Warnings = errors (exit 1)

# PHASE 3
npx crawlbeacon check <url> --crawl --max-pages 50   # Multi-page crawl
npx crawlbeacon diff --url <url>                      # Compare vs last run
npx crawlbeacon init                                  # Generate .crawlbeacon.yml

# PHASE 4
npx crawlbeacon submit <sitemap-url> --indexnow-key KEY  # IndexNow submission
```

---

## Phase 1: Foundation + Core CLI ✅ COMPLETE

**Shipped:** v0.1.0 on npm. 121 tests. 4 analyzers. Terminal + JSON reporters.

Everything in this phase is done. See CLAUDE.md progress log for details.

---

## Phase 2: Next.js Analyzer + AI Readiness + Config (Week 3-4)

**Goal:** `npx crawlbeacon analyze --dir ./app` works. AI readiness checking. Config file support.

### Task 2.1: Next.js Analyze Command ⬜ `~3-4 days`

The #1 differentiator. No other SEO tool reads your project filesystem.

**Create `src/core/frameworks/types.ts`:**
```typescript
export interface FrameworkAnalyzer {
  name: string;
  detect(projectDir: string): Promise<boolean>;
  analyze(projectDir: string): Promise<FrameworkAnalysis>;
}

export interface FrameworkAnalysis {
  framework: string;
  router: 'app' | 'pages' | 'both';
  routes: RouteInfo[];
  issues: Issue[];
  score: number;
}

export interface RouteInfo {
  path: string;           // e.g., /app/blog/[slug]/page.tsx
  route: string;          // e.g., /blog/[slug]
  hasMetadata: boolean;
  hasUseClient: boolean;
  hasGenerateStaticParams: boolean;
}
```

**Create `src/core/frameworks/nextjs.ts`:**
1. Walk `app/` directory recursively (check both `app/` and `src/app/`)
2. Find `page.tsx`/`page.js` files
3. Read each file as string, check with regex (NOT AST — keep it simple):
   - `export const metadata` or `export function generateMetadata` or `export async function generateMetadata`
   - `"use client"` or `'use client'` at top of file
   - `generateStaticParams`
4. Check for `sitemap.ts`/`sitemap.xml`/`sitemap.js` at app root
5. Check for `robots.ts`/`robots.txt`/`robots.js` at app root
6. Check root `layout.tsx` for metadata export
7. Detect mixed router usage (`app/` + `pages/` both exist)

**Issue codes to emit:**
| Code | Severity | Trigger |
|------|----------|---------|
| `ROUTE_NO_METADATA` | warning | Route has no metadata export |
| `CLIENT_COMPONENT_NO_META` | info | Client component — ensure parent layout provides metadata |
| `NO_SITEMAP_FILE` | warning | No sitemap.ts/xml in app directory |
| `NO_ROBOTS_FILE` | warning | No robots.ts/txt in app directory |
| `ROOT_LAYOUT_NO_METADATA` | warning | Root layout has no default metadata |
| `MIXED_ROUTERS` | warning | Both App Router and Pages Router detected |
| `DUPLICATE_TITLES` | warning | Multiple routes share identical titles |

**Create `src/core/frameworks/detector.ts`:**
- Check for `next.config.js`/`next.config.mjs`/`next.config.ts` → Next.js
- Later: `astro.config.mjs` → Astro, `nuxt.config.ts` → Nuxt

**Create `src/cli/commands/analyze.ts`:**
```bash
program.command('analyze')
  .option('--dir <path>', 'Project directory', '.')
  .option('--framework <fw>', 'Framework (auto|nextjs)', 'auto')
  .option('-f, --format <fmt>', 'Output format', 'terminal')
```

**Tests:** Create `tests/fixtures/nextjs/` with mock app directory structure (page.tsx files with/without metadata exports). Test analyzer against fixtures. No filesystem mocking — use real temp directories.

---

### Task 2.2: AI Readiness Analyzer ⬜ `~2-3 days`

**Create `src/core/analyzers/ai-readiness.ts`:**

This analyzer takes data you ALREADY collect and scores it through an AI-readiness lens:

```typescript
export interface AIReadinessAnalysis extends AnalyzerResult {
  aiBotAccess: { bot: string; status: 'allowed' | 'blocked' | 'no-directive' }[];
  hasLlmsTxt: boolean;
  structuredDataQuality: 'good' | 'basic' | 'none';
  contentComprehensiveness: 'high' | 'medium' | 'low';
}
```

**What it checks (NO new dependencies needed):**

1. **AI bot directives** — parse robots.txt (already fetched) for:
   `GPTBot`, `ClaudeBot`, `Claude-Web`, `PerplexityBot`, `Amazonbot`, `Applebot-Extended`, `Bytespider`, `CCBot`, `Google-Extended`, `anthropic-ai`, `cohere-ai`

2. **llms.txt** — HEAD request to `{origin}/llms.txt`. Exists (200) or doesn't (404).

3. **Structured data quality** — count JSON-LD schemas (already parsed):
   - 2+ schemas → 'good'
   - 1 schema → 'basic'
   - 0 → 'none'

4. **Content comprehensiveness** — count h2 headings (already parsed):
   - 3+ h2 → 'high'
   - 1-2 → 'medium'
   - 0 → 'low'

5. **Score:** `(botAccess * 0.3) + (structuredData * 0.3) + (content * 0.2) + (llmsTxt * 0.2)`

**Issue codes:**
| Code | Severity | Trigger |
|------|----------|---------|
| `AI_BOTS_BLOCKED` | info | One or more AI bots blocked in robots.txt |
| `NO_LLMS_TXT` | info | No llms.txt file found |
| `LOW_STRUCTURED_DATA` | warning | No or minimal structured data |
| `LOW_CONTENT_STRUCTURE` | info | Poor heading structure |

**Wire into check.ts:** Add as 5th analyzer in the check pipeline. Needs robots analysis result + parsed page + llms.txt fetch.

---

### Task 2.3: Exit Codes Fix ⬜ `~2 hours`

**Problem:** CLI always exits 0. Broken for CI/CD.

**In `src/cli/commands/check.ts`**, after computing results:
```typescript
const hasErrors = result.results.some(r =>
  r.issues.some(i => i.severity === 'error'));
const hasWarnings = result.results.some(r =>
  r.issues.some(i => i.severity === 'warning'));

if (hasErrors) process.exit(1);
if (hasWarnings && options.strict) process.exit(1);
process.exit(0);
```

Add `--strict` flag to commander options.

Update the existing `--fail-on` flag behavior to actually work if it doesn't already.

---

### Task 2.4: Configuration File Support ⬜ `~1-2 days`

**Create `src/core/config/schema.ts`:**
```typescript
import { z } from 'zod';

export const configSchema = z.object({
  url: z.string().url().optional(),
  failOn: z.enum(['error', 'warning', 'none']).default('error'),
  checks: z.object({
    meta: z.boolean().default(true),
    structuredData: z.boolean().default(true),
    images: z.boolean().default(true),
    robots: z.boolean().default(true),
    sitemap: z.boolean().default(true),
    aiReadiness: z.boolean().default(true),
  }).default({}),
  crawl: z.object({
    maxPages: z.number().default(50),
    respectRobotsTxt: z.boolean().default(true),
    timeout: z.number().default(10000),
  }).default({}),
  rules: z.record(z.enum(['error', 'warning', 'info', 'off'])).default({}),
  ignore: z.array(z.string()).default([]),
  framework: z.enum(['auto', 'nextjs', 'astro', 'nuxt', 'none']).default('auto'),
}).strict();

export type CrawlBeaconConfig = z.infer<typeof configSchema>;
```

**Create `src/core/config/loader.ts`:**
- Search for `.crawlbeacon.yml` or `.crawlbeacon.yaml` in CWD, then parent dirs
- Parse with `yaml` package
- Validate with zod schema
- Return typed config or defaults

**Create `src/core/config/defaults.ts`:**
- Export default config values

**Merge logic:** CLI flags > config file > defaults.

---

### Task 2.5: Markdown Reporter ⬜ `~half day`

**Create `src/cli/reporters/markdown.ts`:**

```typescript
export function markdownReporter(result: ScanResult): string {
  const lines: string[] = [];
  const emoji = result.score >= 80 ? '🟢' : result.score >= 50 ? '🟡' : '🔴';

  lines.push(`${emoji} **SEO Score: ${result.score}/100** | ${result.url}`);
  lines.push('');
  lines.push('| Analyzer | Score | Issues |');
  lines.push('|----------|-------|--------|');

  for (const r of result.results) {
    const icon = r.score >= 80 ? '✅' : r.score >= 50 ? '⚠️' : '❌';
    lines.push(`| ${r.analyzer} | ${icon} ${r.score} | ${r.issues.length} |`);
  }

  // List top issues
  const allIssues = result.results.flatMap(r => r.issues)
    .filter(i => i.severity !== 'info');
  if (allIssues.length > 0) {
    lines.push('');
    lines.push('**Issues:**');
    for (const issue of allIssues.slice(0, 10)) {
      const icon = issue.severity === 'error' ? '❌' : '⚠️';
      lines.push(`- ${icon} \`${issue.code}\` ${issue.message}`);
    }
  }

  return lines.join('\n');
}
```

Add `--format markdown` option to check command.

---

### Task 2.6: README Rewrite ⬜ `~3-4 hours`

Current README is functional but doesn't sell. Rewrite with:

1. One-liner: "SEO checks in every PR. Like ESLint, but for SEO."
2. Terminal GIF (use `vhs` or `asciinema` to record a real check)
3. Quick start: `npx crawlbeacon check https://yoursite.com`
4. "What it checks" table (meta, images, robots, structured data, AI readiness)
5. CI/CD example — GitHub Actions YAML snippet
6. `.crawlbeacon.yml` config example
7. Comparison table vs Lighthouse, Ahrefs, Screaming Frog
8. Under 200 lines. Every line drives installs.

---

### Task 2.7: Polish GitHub Repo ⬜ `~2-3 hours`

- Description: "SEO linter for your deployment pipeline"
- Topics: `seo`, `cli`, `nextjs`, `seo-tools`, `sitemap`, `developer-tools`, `ci-cd`
- Social preview image (1280x640)
- `.github/ISSUE_TEMPLATE/bug_report.md` + `feature_request.md`
- `CONTRIBUTING.md` (how to add analyzers, run tests, submit PRs)
- Create 3-5 GitHub Issues as public roadmap

---

## Phase 3: GitHub Action + SEO Diff + Crawl Mode (Week 5-8)

### Task 3.1: GitHub Action MVP ⬜ `~1 week`

Create new repo: `crawlbeacon/seo-check-action`

**`action.yml`:**
- Inputs: `url` (required), `strict` (default false), `config-path`
- Runs: composite
- Step 1: `npx crawlbeacon@latest check $URL --format markdown > results.md`
- Step 2: `actions/github-script` reads results.md and posts as PR comment

**PR comment format:** Uses the markdown reporter output.

---

### Task 3.2: SEO Diff System ⬜ `~1 week`

**Create `src/core/differ/snapshot.ts`:**
- Save `ScanResult` to `.crawlbeacon/last-run.json`
- Load previous snapshot

**Create `src/core/differ/diff.ts`:**
- Compare two snapshots
- Detect: new/removed pages, title changes, description changes, structured data changes, score changes, new broken images
- Return structured diff result

**Create `src/cli/commands/diff.ts`:**
- `crawlbeacon diff --url <url>`
- Run check, load previous snapshot, compute diff, display
- Save current as new snapshot

**Output format:**
```
~ Changed: /blog title: "Old" → "New"
+ Added: /new-page (missing description) ⚠️
- Removed: /old-page ℹ️
  Score: 72 → 68 (-4)
```

---

### Task 3.3: Multi-page Crawl Mode ⬜ `~2-3 days`

**Create `src/core/crawler/crawler.ts`:**
- Port BFS logic from web app's `backend/routes/sitemap.js`
- URL normalization, same-domain filtering, file extension exclusion
- Configurable max pages (default from config)
- Run all analyzers on each crawled page
- Aggregate results

**Create `src/core/crawler/types.ts`:**
```typescript
export interface CrawlResult {
  pages: ScanResult[];
  totalPages: number;
  duration: number;
  aggregateScore: number;
}
```

**CLI:** `npx crawlbeacon check <url> --crawl --max-pages 50`

---

### Task 3.4: Rule Configuration System ⬜ `~half day`

In `.crawlbeacon.yml`, allow overriding severity per rule:
```yaml
rules:
  MISSING_DESCRIPTION: error
  IMAGES_NOT_LAZY: info
  NO_LLMS_TXT: off
```

Create `src/core/rules/types.ts` and `src/core/rules/engine.ts` — apply overrides before scoring.

---

### Task 3.5: Sitemap Analyzer ⬜ `~2 days`

**Create `src/core/analyzers/sitemap.ts`:**
1. Discover sitemap from robots.txt `Sitemap:` directive or `/sitemap.xml`
2. Fetch and parse XML
3. Check: valid structure, `<loc>` URLs return 200, `lastmod` not in future, size < 50MB, count < 50,000, no duplicates
4. Support sitemap index files (nested sitemaps)

**Issue codes:**
| Code | Severity | Trigger |
|------|----------|---------|
| `NO_SITEMAP` | warning | No sitemap found |
| `SITEMAP_INVALID_XML` | error | XML parse failure |
| `SITEMAP_BROKEN_URLS` | error | URLs returning 4xx/5xx |
| `SITEMAP_FUTURE_LASTMOD` | warning | lastmod date in the future |
| `SITEMAP_TOO_LARGE` | warning | Over 50,000 URLs or 50MB |
| `SITEMAP_DUPLICATE_URLS` | warning | Duplicate `<loc>` entries |

---

### Task 3.6: Publish v0.3.0 ⬜

Bundle Phase 2 + 3 work. Update changelog, bump version.

---

## Phase 4: IndexNow + Launch (Week 9-12)

### Task 4.1: IndexNow Auto-Submission ⬜ `~2 days`

**Create `src/core/integrations/indexnow.ts`:**
```typescript
export async function submitToIndexNow(urls: string[], apiKey: string): Promise<IndexNowResult> {
  const host = new URL(urls[0]).hostname;
  const response = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host, key: apiKey, urlList: urls }),
  });
  return { submitted: urls.length, status: response.status };
}
```

**Create `src/cli/commands/submit.ts`:**
- `crawlbeacon submit <sitemap-url> --indexnow-key KEY`
- Parse sitemap, extract URLs, submit to IndexNow

---

### Task 4.2: Bulk OG Image Validator ⬜ `~2-3 days`

Add to crawl mode — when `--crawl` is used, also validate OG images across all pages:
- OG image exists and returns 200
- Correct dimensions (1200x630 recommended)
- Not duplicated across pages
- File size reasonable

---

### Task 4.3: Interface Boundaries (migration-proofing) ⬜ `~half day`

Create TypeScript interfaces so components can be swapped later:

```typescript
// src/core/interfaces.ts
export interface Fetcher {
  fetchHTML(url: string, options?: FetchOptions): Promise<FetchResult>;
  fetchXML(url: string, options?: FetchOptions): Promise<FetchResult>;
  checkURL(url: string, options?: FetchOptions): Promise<FetchResult>;
}

export interface HTMLParser {
  parse(html: string, baseUrl: string): ParsedPage;
}

export interface Reporter {
  format(result: ScanResult): string;
}
```

Use dependency injection in analyzers for testability.

---

### Task 4.4: Product Hunt Launch ⬜ `~1-2 days`

- Product Hunt listing with tagline, screenshots, terminal GIF
- Demo video (30-60 seconds)
- Maker comment
- Schedule for Tuesday
- Share on Twitter/X, Reddit, HN, dev.to

---

### Task 4.5: Write 5 Blog Posts (spread over weeks) ⬜

1. "The 5 SEO mistakes every Next.js app makes"
2. "How to add SEO checks to your GitHub Actions pipeline"
3. "Your Next.js app is invisible to AI — here's how to fix it"
4. "I audited 100 Next.js sites for SEO — here's what I found"
5. "SEO diffing: catch regressions before they hit production"

Cross-post to dev.to + hashnode. Each ends with CLI CTA.

---

### Task 4.6: Publish v1.0.0 ⬜

Major release. All Phase 1-4 features.

**Target: 500 npm installs, 50 GitHub stars, 10 paying users**

---

## Phase 5: Growth (Month 4-6)

- [ ] Astro framework support (`src/core/frameworks/astro.ts`)
- [ ] Nuxt framework support (`src/core/frameworks/nuxt.ts`)
- [ ] Vercel build plugin (`@crawlbeacon/vercel-plugin`)
- [ ] Historical SEO diffing dashboard (paid feature)
- [ ] Team features, multi-site management
- [ ] llms.txt generator

**Target: 2,000 npm installs, 200 GitHub stars, $2K MRR**

---

## Phase 6: Category Ownership (Month 7-12)

- [ ] Netlify, Cloudflare Pages, GitLab CI integrations
- [ ] SvelteKit + Remix framework support
- [ ] Full GEO readiness scoring module
- [ ] Agency tier with white-label + bulk operations
- [ ] Community: contributor guides, plugin marketplace, Discord

**Target: 10K npm installs, 1K GitHub stars, $10K+ MRR**

---

## Pricing Strategy

| Tier | Price | Includes |
|------|-------|----------|
| **Free (Open Source CLI)** | $0 | Local checks, single site, all analyzers |
| **Pro** | $19/mo | GitHub Action, Vercel plugin, SEO diff, IndexNow, 5 sites, email alerts |
| **Team** | $49/mo | Pro + 20 sites, team access, priority support |
| **Agency** | $99/mo | Unlimited sites, API access, bulk operations, white-label |

---

## Distribution Channels

1. **npm registry** — `npx crawlbeacon check` for instant trial
2. **GitHub Actions Marketplace** — `uses: crawlbeacon/seo-check@v1`
3. **Vercel Integration Marketplace** — Next.js ecosystem
4. **Hacker News / Dev.to / Hashnode** — launch posts
5. **Product Hunt** — one-time launch boost
6. **Reddit** — r/nextjs, r/webdev, r/SEO
7. **SEO Twitter/X** — #TechSEO community

---

## What NOT to Build

- ❌ Keyword research (Ahrefs/Semrush won, $100M+ data infrastructure)
- ❌ Backlink analysis (not feasible at indie scale)
- ❌ Rank tracking (commodity)
- ❌ AI content writing (saturated — Jasper, Copy.ai)
- ❌ Enterprise-scale crawling (Lumar/Botify handle millions of pages)
- ❌ WordPress plugin (RankMath/Yoast dominate)
- ❌ Puppeteer/Playwright for MVP (100MB+ binary — cheerio handles 90%)

---

## Key Milestones

| Milestone | Target | Status |
|-----------|--------|--------|
| v0.1.0 — CLI works | Week 2 | ✅ DONE (published 2026-02-13) |
| v0.2.0 — Next.js + AI readiness | Week 4 | ⬜ NEXT |
| v0.3.0 — GitHub Action + diff | Week 8 | ⬜ |
| v1.0.0 — Product Hunt launch | Week 12 | ⬜ |
| $2K MRR | Month 6 | ⬜ |
| $10K MRR | Month 12 | ⬜ |
