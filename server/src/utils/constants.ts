/**
 * Centralized constants for the Anything Minutes API
 */

// Amount validation
export const MAX_AMOUNT = 999999.99

// Invite settings
export const MAX_PENDING_INVITES = 5
export const INVITE_EXPIRY_DAYS = 7

// Pagination defaults
export const DEFAULT_FEED_LIMIT = 50
export const DEFAULT_NOTIFICATION_LIMIT = 20
export const DEFAULT_SEARCH_LIMIT = 20

// Rate limiting windows (in milliseconds)
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000 // 15 minutes
export const RATE_LIMIT_SEARCH_WINDOW_MS = 60 * 1000 // 1 minute

// Rate limiting max requests
export const RATE_LIMIT_GENERAL_MAX = 100
export const RATE_LIMIT_AUTH_MAX = 10
export const RATE_LIMIT_SEARCH_MAX = 30
export const RATE_LIMIT_INVITE_MAX = 20

// Supabase error codes
export const SUPABASE_NO_ROWS_ERROR = 'PGRST116'

// Username validation
export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 20
export const FIRST_NAME_MIN_LENGTH = 1
export const FIRST_NAME_MAX_LENGTH = 20

// Username change cooldown (in days)
export const USERNAME_CHANGE_COOLDOWN_DAYS = 30

// Valid currencies
export const VALID_CURRENCIES = ['$', '🍺', '☕', '🍌', '🥤'] as const

// Valid date formats
export const VALID_DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'] as const

// Valid time formats
export const VALID_TIME_FORMATS = ['12h', '24h'] as const

// Amount validation helper (centralized since it's used in multiple files)
export function validateAmount(amount: unknown): { valid: boolean; error?: string } {
  if (amount === undefined || amount === null || amount === '') {
    return { valid: true } // Optional field
  }
  const num = Number(amount)
  if (!Number.isFinite(num)) {
    return { valid: false, error: 'Amount must be a valid number' }
  }
  if (num < 0) {
    return { valid: false, error: 'Amount cannot be negative' }
  }
  if (num > MAX_AMOUNT) {
    return { valid: false, error: `Amount cannot exceed ${MAX_AMOUNT}` }
  }
  return { valid: true }
}
