/**
 * Production Web Fetching Engine
 * Drop-in replacement for axios/fetch with proper error handling.
 * Ported from backend/utils/robustFetch.js with TypeScript types.
 */

import axios from 'axios';

export enum ErrorCode {
  TIMEOUT = 'TIMEOUT',
  ACCESS_RESTRICTED = 'ACCESS_RESTRICTED',
  SOFT_PROTECTED = 'SOFT_PROTECTED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  RATE_LIMITED = 'RATE_LIMITED',
  SERVER_ERROR = 'SERVER_ERROR',
}

export interface FetchSuccess {
  success: true;
  statusCode: number;
  statusText: string;
  contentType: string;
  contentLength: number;
  data: string;
  headers: Record<string, string>;
  finalUrl: string;
  responseTime: number;
  redirected: boolean;
}

export interface FetchFailure {
  success: false;
  errorCode: ErrorCode;
  message: string;
  suggestion: string;
  statusCode?: number;
  contentType?: string;
  contentLength?: number;
  responseTime?: number;
  retryAfter?: string;
  errorDetails?: string;
  url?: string;
  details?: string;
}

export type FetchResult = FetchSuccess | FetchFailure;

export interface FetchOptions {
  timeout?: number;
  method?: string;
  headers?: Record<string, string>;
  followRedirects?: boolean;
}

export interface BatchOptions extends FetchOptions {
  concurrency?: number;
  delayBetweenBatches?: number;
  onProgress?: (progress: BatchProgress) => void;
}

export interface BatchProgress {
  completed: number;
  total: number;
  percentage: number;
}

const DEFAULT_CONFIG = {
  timeout: 15000,
  maxRedirects: 5,
  validateStatus: (status: number) => status < 500,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  },
};

export async function robustFetch(
  url: string,
  options: FetchOptions = {},
): Promise<FetchResult> {
  if (!url || typeof url !== 'string') {
    return {
      success: false,
      errorCode: ErrorCode.INVALID_RESPONSE,
      message: 'Invalid URL provided',
      suggestion: 'Ensure the URL is a valid string',
    };
  }

  try {
    new URL(url);
  } catch (e) {
    return {
      success: false,
      errorCode: ErrorCode.INVALID_RESPONSE,
      message: 'Malformed URL',
      suggestion: 'URL must be absolute (e.g., https://example.com)',
      details: (e as Error).message,
    };
  }

  const config: Record<string, unknown> = {
    ...DEFAULT_CONFIG,
    timeout: options.timeout || DEFAULT_CONFIG.timeout,
    maxRedirects:
      options.followRedirects === false ? 0 : DEFAULT_CONFIG.maxRedirects,
    method: options.method || 'GET',
    headers: {
      ...DEFAULT_CONFIG.headers,
      ...(options.headers || {}),
    },
  };

  const source = axios.CancelToken.source();
  config.cancelToken = source.token;

  const timeoutHandle = setTimeout(() => {
    source.cancel('Request timeout exceeded');
  }, config.timeout as number);

  const startTime = Date.now();

  try {
    const response = await axios({ url, ...config });
    clearTimeout(timeoutHandle);
    const responseTime = Date.now() - startTime;

    const contentLength =
      response.headers['content-length'] || response.data?.length || 0;
    const contentType = response.headers['content-type'] || '';

    // Detect soft protection (200 OK with minimal content)
    if (
      response.status === 200 &&
      contentLength < 100 &&
      (contentType.includes('text/html') ||
        contentType.includes('application/xml'))
    ) {
      return {
        success: false,
        errorCode: ErrorCode.SOFT_PROTECTED,
        message: 'Site returned minimal content (possible bot detection)',
        suggestion:
          'This website may use soft protection. Browser access likely works, automated access is limited.',
        statusCode: response.status,
        contentType,
        contentLength: parseInt(contentLength),
        responseTime,
      };
    }

    // Detect CAPTCHA/challenge pages
    const responseText =
      typeof response.data === 'string' ? response.data : '';
    const hasCaptchaIndicators =
      responseText.toLowerCase().includes('captcha') ||
      responseText.toLowerCase().includes('cloudflare') ||
      responseText.toLowerCase().includes('challenge');

    if (hasCaptchaIndicators && contentLength < 5000) {
      return {
        success: false,
        errorCode: ErrorCode.SOFT_PROTECTED,
        message: 'Site returned challenge/CAPTCHA page',
        suggestion:
          'This website uses bot protection. Manual browser access required.',
        statusCode: response.status,
        contentType,
        responseTime,
      };
    }

    return {
      success: true,
      statusCode: response.status,
      statusText: response.statusText,
      contentType,
      contentLength: parseInt(contentLength),
      data: response.data,
      headers: response.headers as Record<string, string>,
      finalUrl:
        (response.request as Record<string, unknown>)?.res &&
        typeof (response.request as Record<string, unknown>).res === 'object'
          ? ((response.request as Record<string, Record<string, string>>).res
              .responseUrl as string) || url
          : url,
      responseTime,
      redirected:
        ((
          response.request as Record<
            string,
            Record<string, number> | undefined
          >
        )?._redirectable?._redirectCount ?? 0) > 0,
    };
  } catch (error: unknown) {
    clearTimeout(timeoutHandle);
    const responseTime = Date.now() - startTime;
    const axiosError = error as Record<string, unknown>;

    // Timeout
    if (
      axios.isCancel(error) ||
      (axiosError as Record<string, string>).code === 'ECONNABORTED'
    ) {
      return {
        success: false,
        errorCode: ErrorCode.TIMEOUT,
        message: `Request timed out after ${config.timeout}ms`,
        suggestion: 'The server took too long to respond.',
        responseTime,
        url,
      };
    }

    // HTTP errors
    const axiosResponse = axiosError.response as
      | Record<string, unknown>
      | undefined;
    if (axiosResponse) {
      const status = axiosResponse.status as number;
      const headers = axiosResponse.headers as Record<string, string>;

      if (status === 401 || status === 403) {
        return {
          success: false,
          errorCode: ErrorCode.ACCESS_RESTRICTED,
          message: `Access denied (HTTP ${status})`,
          suggestion:
            status === 401 ? 'Authentication required' : 'Access forbidden',
          statusCode: status,
          responseTime,
          url,
        };
      }

      if (status === 429) {
        const retryAfter = headers['retry-after'];
        return {
          success: false,
          errorCode: ErrorCode.RATE_LIMITED,
          message: 'Rate limit exceeded',
          suggestion: retryAfter
            ? `Wait ${retryAfter} seconds`
            : 'Too many requests',
          statusCode: status,
          retryAfter,
          responseTime,
          url,
        };
      }

      if (status === 404) {
        return {
          success: false,
          errorCode: ErrorCode.INVALID_RESPONSE,
          message: 'URL not found (HTTP 404)',
          suggestion: 'This URL does not exist',
          statusCode: status,
          responseTime,
          url,
        };
      }

      if (status >= 500) {
        return {
          success: false,
          errorCode: ErrorCode.SERVER_ERROR,
          message: `Server error (HTTP ${status})`,
          suggestion: 'Server encountered an error',
          statusCode: status,
          responseTime,
          url,
        };
      }

      return {
        success: false,
        errorCode: ErrorCode.INVALID_RESPONSE,
        message: `HTTP ${status}: ${(axiosResponse.statusText as string) || 'Unknown error'}`,
        suggestion: 'Unexpected client error',
        statusCode: status,
        responseTime,
        url,
      };
    }

    // Network errors
    const errorCode = (axiosError as Record<string, string>).code;
    if (errorCode) {
      const networkErrorMessages: Record<string, string> = {
        ENOTFOUND: 'DNS lookup failed',
        ECONNREFUSED: 'Connection refused',
        ECONNRESET: 'Connection reset',
        ETIMEDOUT: 'Connection timeout',
        EHOSTUNREACH: 'Host unreachable',
        ENETUNREACH: 'Network unreachable',
        EPROTO: 'Protocol error',
        DEPTH_ZERO_SELF_SIGNED_CERT: 'Self-signed SSL certificate',
        CERT_HAS_EXPIRED: 'SSL certificate expired',
        UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'SSL certificate invalid',
      };

      const message =
        networkErrorMessages[errorCode] || `Network error: ${errorCode}`;

      return {
        success: false,
        errorCode: ErrorCode.NETWORK_ERROR,
        message,
        suggestion: 'Check domain and connectivity',
        errorDetails: errorCode,
        responseTime,
        url,
      };
    }

    return {
      success: false,
      errorCode: ErrorCode.NETWORK_ERROR,
      message: 'Unexpected error',
      suggestion: 'Unknown error prevented request',
      errorDetails: (error as Error).message,
      responseTime,
      url,
    };
  }
}

export async function fetchXML(
  url: string,
  options: FetchOptions = {},
): Promise<FetchResult> {
  const result = await robustFetch(url, {
    ...options,
    headers: {
      Accept: 'application/xml,text/xml,*/*;q=0.8',
      ...(options.headers || {}),
    },
  });

  if (result.success) {
    const contentType = result.contentType.toLowerCase();
    const isXML =
      contentType.includes('xml') ||
      (typeof result.data === 'string' &&
        result.data.trim().startsWith('<?xml'));

    if (!isXML) {
      return {
        success: false,
        errorCode: ErrorCode.INVALID_RESPONSE,
        message: 'Response is not valid XML',
        suggestion: 'The URL did not return XML content',
        contentType: result.contentType,
        url,
      };
    }
  }

  return result;
}

export async function fetchHTML(
  url: string,
  options: FetchOptions = {},
): Promise<FetchResult> {
  return robustFetch(url, {
    ...options,
    headers: {
      Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
      ...(options.headers || {}),
    },
  });
}

export async function checkURL(
  url: string,
  options: FetchOptions = {},
): Promise<FetchResult> {
  return robustFetch(url, {
    ...options,
    method: 'HEAD',
    timeout: options.timeout || 8000,
  });
}

export async function fetchBatch(
  urls: string[],
  options: BatchOptions = {},
): Promise<FetchResult[]> {
  const { concurrency = 5, delayBetweenBatches = 1000, onProgress } = options;
  const results: FetchResult[] = [];

  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((url) => robustFetch(url, options)),
    );
    results.push(...batchResults);

    if (onProgress) {
      onProgress({
        completed: results.length,
        total: urls.length,
        percentage: Math.round((results.length / urls.length) * 100),
      });
    }

    if (i + concurrency < urls.length) {
      await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
    }
  }

  return results;
}
