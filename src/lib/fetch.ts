/**
 * Robust fetch utility with retry, timeout, and error classification.
 * Production-hardened to handle HTML responses from server errors.
 * 
 * KEY FIX: When a server error returns HTML instead of JSON (the 
 * "Unexpected token '<'" whitepage issue), this utility detects it
 * and throws a proper error instead of crashing on JSON.parse.
 */

export type FetchErrorType = 'timeout' | 'network' | 'server' | 'client' | 'parse' | 'html';

export class RobustFetchError extends Error {
  type: FetchErrorType;
  status?: number;
  constructor(message: string, type: FetchErrorType, status?: number) {
    super(message);
    this.name = 'RobustFetchError';
    this.type = type;
    this.status = status;
  }
}

interface FetchOptions extends RequestInit {
  /** Request timeout in milliseconds (default: 15000) */
  timeout?: number;
  /** Number of retry attempts (default: 2, so up to 3 total attempts) */
  retries?: number;
  /** Base delay between retries in ms (default: 500, uses exponential backoff) */
  retryDelay?: number;
  /** Don't retry on these HTTP status codes */
  noRetryStatuses?: number[];
}

const DEFAULT_TIMEOUT = 15_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY = 500;
const NO_RETRY_STATUSES = [401, 403, 404, 422];

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if a response is HTML instead of JSON.
 * This is the CRITICAL fix for the "Unexpected token '<'" error.
 */
function isHtmlResponse(response: Response): boolean {
  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('text/html') || contentType.includes('text/xml');
}

/**
 * Safely parse a response as JSON, handling HTML responses gracefully.
 * If the response is HTML (e.g., a server error page), throws a proper error
 * instead of crashing with "Unexpected token '<'".
 */
export async function safeJsonParse<T = unknown>(response: Response): Promise<T> {
  // Check if response is HTML - this is the whitepage protection
  if (isHtmlResponse(response)) {
    throw new RobustFetchError(
      response.ok 
        ? 'Server returned HTML instead of JSON. Please refresh the page.'
        : `Server error (${response.status}). Please try again in a moment.`,
      'html',
      response.status
    );
  }

  try {
    const text = await response.text();
    if (!text || text.trim().length === 0) {
      throw new RobustFetchError('Empty response from server', 'parse');
    }
    return JSON.parse(text) as T;
  } catch (error) {
    if (error instanceof RobustFetchError) throw error;
    // JSON parse error - likely HTML response that wasn't caught by content-type
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
      throw new RobustFetchError(
        'Received an invalid server response. Please refresh the page.',
        'html',
        response.status
      );
    }
    throw new RobustFetchError('Failed to parse server response', 'parse');
  }
}

/**
 * Robust fetch with retry, timeout, and proper error handling.
 */
export async function robustFetch(url: string, options: FetchOptions = {}): Promise<Response> {
  const {
    timeout = DEFAULT_TIMEOUT,
    retries = DEFAULT_RETRIES,
    retryDelay = DEFAULT_RETRY_DELAY,
    noRetryStatuses = NO_RETRY_STATUSES,
    signal: externalSignal,
    ...fetchOptions
  } = options;

  let lastError: Error | null = null;
  let attempt = 0;

  while (attempt <= retries) {
    attempt++;

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Combine with external signal if provided
    if (externalSignal) {
      externalSignal.addEventListener('abort', () => controller.abort());
    }

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // If we get an HTML error page (5xx), retry
      if (!response.ok && response.status >= 500 && attempt <= retries) {
        lastError = new RobustFetchError(
          `Server error ${response.status} (attempt ${attempt}/${retries + 1})`,
          'server',
          response.status
        );
        await sleep(retryDelay * Math.pow(2, attempt - 1));
        continue;
      }

      // Don't retry on client errors (4xx) that are in noRetryStatuses
      if (!response.ok && noRetryStatuses.includes(response.status)) {
        throw new RobustFetchError(
          `Request failed with status ${response.status}`,
          response.status >= 500 ? 'server' : 'client',
          response.status
        );
      }

      return response;
    } catch (error: unknown) {
      clearTimeout(timeoutId);

      // If aborted due to timeout
      if (error instanceof DOMException && error.name === 'AbortError') {
        if (externalSignal?.aborted) {
          throw new RobustFetchError('Request was cancelled', 'network');
        }
        lastError = new RobustFetchError(
          `Request timed out after ${timeout}ms (attempt ${attempt}/${retries + 1})`,
          'timeout'
        );
      } else if (error instanceof RobustFetchError) {
        if (attempt > retries) throw error;
        lastError = error;
      } else {
        lastError = new RobustFetchError(
          `Network error: ${error instanceof Error ? error.message : 'Connection failed'} (attempt ${attempt}/${retries + 1})`,
          'network'
        );
      }

      // Retry if we have attempts left
      if (attempt <= retries) {
        await sleep(retryDelay * Math.pow(2, attempt - 1));
      }
    }
  }

  throw lastError || new RobustFetchError('Request failed after all retries', 'network');
}

/**
 * Convenience: robustFetch + safe JSON parse in one call.
 * Returns the parsed JSON on success, throws RobustFetchError on failure.
 */
export async function robustFetchJSON<T = unknown>(url: string, options: FetchOptions = {}): Promise<T> {
  const response = await robustFetch(url, options);
  return safeJsonParse<T>(response);
}

/**
 * Get a user-friendly error message from a RobustFetchError.
 */
export function getFetchErrorMessage(error: unknown): string {
  if (error instanceof RobustFetchError) {
    switch (error.type) {
      case 'timeout':
        return 'Server is taking too long to respond. Please try again.';
      case 'network':
        return 'Unable to connect to server. Check your internet connection and try again.';
      case 'server':
        return 'Server error occurred. Please try again in a moment.';
      case 'parse':
        return 'Received an invalid response from server.';
      case 'html':
        return 'Server returned an error page. Please refresh and try again.';
      case 'client':
        if (error.status === 401) return 'Session expired. Please log in again.';
        if (error.status === 403) return 'Access denied. Your account may be deactivated.';
        if (error.status === 404) return 'The requested resource was not found.';
        if (error.status === 409) return 'Conflict - resource already exists.';
        if (error.status === 422) return 'Invalid data submitted. Please check your input.';
        if (error.status === 429) return 'Too many requests. Please wait a moment and try again.';
        return `Request failed (${error.status}).`;
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unknown error occurred. Please try again.';
}
