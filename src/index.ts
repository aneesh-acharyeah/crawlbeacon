// Public API exports for programmatic usage
export { robustFetch, fetchXML, fetchHTML, checkURL, fetchBatch, ErrorCode } from './utils/fetcher.js';
export type { FetchSuccess, FetchFailure, FetchResult, FetchOptions } from './utils/fetcher.js';

export { buildSitemapXML } from './utils/xml-builder.js';
export type { SitemapEntry } from './utils/xml-builder.js';

export { parsePage } from './utils/html-parser.js';
export type { ParsedPage, ImageData } from './utils/html-parser.js';

export { normalizeUrl, isValidUrl, isSameOrigin, resolveUrl } from './utils/url.js';
