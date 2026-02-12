/**
 * Comprehensive HTML page parser using cheerio.
 * Single parse call extracts all SEO-relevant data from a page.
 */

import * as cheerio from 'cheerio';

export interface ImageData {
  src: string;
  alt: string | null;
  loading: string | null;
  width: string | null;
  height: string | null;
}

export interface ParsedPage {
  // Meta tags
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  robots: string | null;

  // Open Graph
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  ogType: string | null;
  ogUrl: string | null;

  // Twitter Cards
  twitterCard: string | null;
  twitterTitle: string | null;
  twitterDescription: string | null;
  twitterImage: string | null;

  // Structured Data
  jsonLd: object[];

  // Images
  images: ImageData[];

  // Links
  internalLinks: string[];
  externalLinks: string[];

  // Headings
  h1: string[];
  h2: string[];

  // Technical
  lang: string | null;
  charset: string | null;
  viewport: string | null;
}

export function parsePage(html: string, pageUrl: string): ParsedPage {
  const $ = cheerio.load(html);

  return {
    // Meta tags
    title: $('title').first().text().trim() || null,
    metaDescription:
      $('meta[name="description"]').attr('content')?.trim() || null,
    canonical: $('link[rel="canonical"]').attr('href')?.trim() || null,
    robots: $('meta[name="robots"]').attr('content')?.trim() || null,

    // Open Graph
    ogTitle: $('meta[property="og:title"]').attr('content')?.trim() || null,
    ogDescription:
      $('meta[property="og:description"]').attr('content')?.trim() || null,
    ogImage: $('meta[property="og:image"]').attr('content')?.trim() || null,
    ogType: $('meta[property="og:type"]').attr('content')?.trim() || null,
    ogUrl: $('meta[property="og:url"]').attr('content')?.trim() || null,

    // Twitter Cards
    twitterCard:
      $('meta[name="twitter:card"]').attr('content')?.trim() || null,
    twitterTitle:
      $('meta[name="twitter:title"]').attr('content')?.trim() || null,
    twitterDescription:
      $('meta[name="twitter:description"]').attr('content')?.trim() || null,
    twitterImage:
      $('meta[name="twitter:image"]').attr('content')?.trim() || null,

    // JSON-LD
    jsonLd: $('script[type="application/ld+json"]')
      .map((_, el) => {
        try {
          return JSON.parse($(el).html() || '');
        } catch {
          return null;
        }
      })
      .get()
      .filter(Boolean),

    // Images
    images: $('img')
      .map((_, el) => {
        const src = $(el).attr('src');
        if (!src) return null;
        let absoluteSrc: string;
        try {
          absoluteSrc = new URL(src, pageUrl).href;
        } catch {
          absoluteSrc = src;
        }
        return {
          src: absoluteSrc,
          alt: $(el).attr('alt') ?? null,
          loading: $(el).attr('loading') || null,
          width: $(el).attr('width') || null,
          height: $(el).attr('height') || null,
        };
      })
      .get()
      .filter(Boolean) as ImageData[],

    // Links
    internalLinks: extractLinks($, pageUrl, 'internal'),
    externalLinks: extractLinks($, pageUrl, 'external'),

    // Headings
    h1: $('h1')
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean),
    h2: $('h2')
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean),

    // Technical
    lang: $('html').attr('lang')?.trim() || null,
    charset:
      $('meta[charset]').attr('charset')?.trim() ||
      $('meta[http-equiv="Content-Type"]')
        .attr('content')
        ?.match(/charset=([^\s;]+)/)?.[1] ||
      null,
    viewport: $('meta[name="viewport"]').attr('content')?.trim() || null,
  };
}

function extractLinks(
  $: cheerio.CheerioAPI,
  pageUrl: string,
  type: 'internal' | 'external',
): string[] {
  const baseHost = new URL(pageUrl).hostname.replace(/^www\./, '');
  return $('a[href]')
    .map((_, el) => {
      try {
        const href = $(el).attr('href')!;
        // Skip anchors, mailto, tel, javascript
        if (
          href.startsWith('#') ||
          href.startsWith('mailto:') ||
          href.startsWith('tel:') ||
          href.startsWith('javascript:')
        ) {
          return null;
        }
        const absolute = new URL(href, pageUrl).href;
        const linkHost = new URL(absolute).hostname.replace(/^www\./, '');
        if (type === 'internal' && linkHost === baseHost) return absolute;
        if (type === 'external' && linkHost !== baseHost) return absolute;
        return null;
      } catch {
        return null;
      }
    })
    .get()
    .filter(Boolean) as string[];
}
