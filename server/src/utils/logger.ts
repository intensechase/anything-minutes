/**
 * Simple logger wrapper - can be replaced with Winston/Pino later
 * Provides structured logging with timestamps and levels
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

// Set minimum log level from environment (default: info in production, debug in dev)
const MIN_LEVEL = process.env.LOG_LEVEL as LogLevel ||
  (process.env.NODE_ENV === 'production' ? 'info' : 'debug')

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL]
}

function formatMessage(level: LogLevel, message: string, meta?: unknown): string {
  const timestamp = new Date().toISOString()
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : ''
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`
}

export const logger = {
  debug(message: string, meta?: unknown) {
    if (shouldLog('debug')) {
      console.log(formatMessage('debug', message, meta))
    }
  },

  info(message: string, meta?: unknown) {
    if (shouldLog('info')) {
      console.log(formatMessage('info', message, meta))
    }
  },

  warn(message: string, meta?: unknown) {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', message, meta))
    }
  },

  error(message: string, error?: unknown) {
    if (shouldLog('error')) {
      const errorMeta = error instanceof Error
        ? { message: error.message, stack: error.stack }
        : error
      console.error(formatMessage('error', message, errorMeta))
    }
  },
}

export default logger
