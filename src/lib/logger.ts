/**
 * Production-grade structured logger.
 * Replaces console.log/console.error with structured, filterable logs.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 
  (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatLog(level: LogLevel, context: string, message: string, data?: unknown): string {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}] [${context}]`;
  
  if (data !== undefined) {
    if (data instanceof Error) {
      return `${prefix} ${message} | Error: ${data.message} | Stack: ${data.stack}`;
    }
    try {
      return `${prefix} ${message} | Data: ${JSON.stringify(data)}`;
    } catch {
      return `${prefix} ${message} | Data: [non-serializable]`;
    }
  }
  return `${prefix} ${message}`;
}

export const logger = {
  debug(context: string, message: string, data?: unknown) {
    if (shouldLog('debug')) console.log(formatLog('debug', context, message, data));
  },

  info(context: string, message: string, data?: unknown) {
    if (shouldLog('info')) console.log(formatLog('info', context, message, data));
  },

  warn(context: string, message: string, data?: unknown) {
    if (shouldLog('warn')) console.warn(formatLog('warn', context, message, data));
  },

  error(context: string, message: string, data?: unknown) {
    if (shouldLog('error')) console.error(formatLog('error', context, message, data));
  },

  fatal(context: string, message: string, data?: unknown) {
    console.error(formatLog('fatal', context, message, data));
  },

  /** Log API request with timing */
  apiRequest(method: string, path: string, status: number, durationMs: number, userId?: string) {
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    if (shouldLog(level)) {
      const msg = formatLog(level, 'API', `${method} ${path} → ${status} (${durationMs}ms)${userId ? ` user=${userId}` : ''}`);
      if (level === 'error') console.error(msg);
      else if (level === 'warn') console.warn(msg);
      else console.log(msg);
    }
  },
};

/**
 * Measure execution time of an async function.
 */
export async function measureTime<T>(
  label: string,
  fn: () => Promise<T>,
  context: string = 'Performance'
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;
    if (duration > 1000) {
      logger.warn(context, `${label} took ${duration}ms (SLOW)`);
    } else {
      logger.debug(context, `${label} took ${duration}ms`);
    }
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error(context, `${label} FAILED after ${duration}ms`, error);
    throw error;
  }
}
