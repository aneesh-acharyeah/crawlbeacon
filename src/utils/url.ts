/**
 * URL normalization and validation utilities.
 */

export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove hash fragments
    parsed.hash = '';
    // Remove trailing slash (except for root)
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.href;
  } catch {
    return url;
  }
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function isSameOrigin(url: string, baseUrl: string): boolean {
  try {
    const a = new URL(url);
    const b = new URL(baseUrl);
    return a.hostname.replace(/^www\./, '') === b.hostname.replace(/^www\./, '');
  } catch {
    return false;
  }
}

export function resolveUrl(href: string, baseUrl: string): string | null {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return null;
  }
}
