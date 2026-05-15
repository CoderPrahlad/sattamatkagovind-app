/**
 * Robust fetch utility with retry, timeout, and error classification.
 * Designed to survive dev server hot-reloads, network hiccups, and slow compilations.
 */

export type FetchErrorType = 'timeout' | 'network' | 'server' | 'client' | 'parse';

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
 * Robust fetch with retry, timeout, and proper error handling.
 *
 * @example
 * ```ts
 * const res = await robustFetch('/api/auth/login', {
 *   method: 'POST',
 *   body: JSON.stringify({ mobile, password }),
 *   retries: 2,
 *   timeout: 10000,
 * });
 * const data = await res.json();
 * ```
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

      // Don't retry on client errors (4xx) that are in noRetryStatuses
      if (!response.ok && noRetryStatuses.includes(response.status)) {
        throw new RobustFetchError(
          `Request failed with status ${response.status}`,
          response.status >= 500 ? 'server' : 'client',
          response.status
        );
      }

      // If we get a server error (5xx), retry
      if (!response.ok && response.status >= 500 && attempt <= retries) {
        lastError = new RobustFetchError(
          `Server error ${response.status} (attempt ${attempt}/${retries + 1})`,
          'server',
          response.status
        );
        await sleep(retryDelay * Math.pow(2, attempt - 1));
        continue;
      }

      return response;
    } catch (error: unknown) {
      clearTimeout(timeoutId);

      // If aborted due to timeout
      if (error instanceof DOMException && error.name === 'AbortError') {
        // Check if it was from external signal or timeout
        if (externalSignal?.aborted) {
          throw new RobustFetchError('Request was cancelled', 'network');
        }
        lastError = new RobustFetchError(
          `Request timed out after ${timeout}ms (attempt ${attempt}/${retries + 1})`,
          'timeout'
        );
      } else if (error instanceof RobustFetchError) {
        // Our own error - rethrow if no more retries
        if (attempt > retries) throw error;
        lastError = error;
      } else {
        // Network error (connection refused, DNS failure, etc.)
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

  // All retries exhausted
  throw lastError || new RobustFetchError('Request failed after all retries', 'network');
}

/**
 * Convenience: robustFetch + JSON parse in one call.
 * Returns the parsed JSON on success, throws RobustFetchError on failure.
 */
export async function robustFetchJSON<T = unknown>(url: string, options: FetchOptions = {}): Promise<T> {
  const response = await robustFetch(url, options);
  try {
    return await response.json() as T;
  } catch {
    throw new RobustFetchError('Failed to parse server response', 'parse');
  }
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
      case 'client':
        if (error.status === 401) return 'Invalid credentials. Please check and try again.';
        if (error.status === 403) return 'Access denied. Your account may be deactivated.';
        if (error.status === 404) return 'The requested resource was not found.';
        if (error.status === 422) return 'Invalid data submitted. Please check your input.';
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
