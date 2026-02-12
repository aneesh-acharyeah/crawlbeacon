/**
 * Sitemap XML Builder
 * Ported from backend/utils/generateXML.js with TypeScript types.
 */

import { create } from 'xmlbuilder2';

export interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?:
    | 'always'
    | 'hourly'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'yearly'
    | 'never';
  priority?: number;
}

export function buildSitemapXML(entries: SitemapEntry[]): string {
  const root = create({ version: '1.0', encoding: 'UTF-8' }).ele('urlset', {
    xmlns: 'http://www.sitemaps.org/schemas/sitemap/0.9',
  });

  for (const entry of entries) {
    const urlEl = root.ele('url');
    urlEl.ele('loc').txt(entry.loc).up();
    if (entry.lastmod) urlEl.ele('lastmod').txt(entry.lastmod).up();
    if (entry.changefreq) urlEl.ele('changefreq').txt(entry.changefreq).up();
    if (entry.priority !== undefined)
      urlEl.ele('priority').txt(String(entry.priority)).up();
    urlEl.up();
  }

  return root.end({ prettyPrint: true });
}
