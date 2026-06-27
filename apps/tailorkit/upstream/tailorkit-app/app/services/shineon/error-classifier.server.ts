export interface ShineOnErrorClassification {
  retryable: boolean
  category:
    | 'auth'
    | 'not_found'
    | 'validation'
    | 'duplicate'
    | 'rate_limit'
    | 'server_error'
    | 'network'
    | 'timeout'
    | 'unknown'
  message: string
  httpStatus?: number
}

export const RETRY_DELAYS = [30_000, 120_000, 600_000] as const
export const MAX_RETRY_ATTEMPTS = 3

const STATUS_MAP: Record<number, Pick<ShineOnErrorClassification, 'category' | 'retryable'>> = {
  401: { category: 'auth', retryable: false },
  404: { category: 'not_found', retryable: false },
  406: { category: 'duplicate', retryable: false },
  422: { category: 'validation', retryable: false },
  429: { category: 'rate_limit', retryable: true },
  500: { category: 'server_error', retryable: true },
  502: { category: 'server_error', retryable: true },
  503: { category: 'server_error', retryable: true },
  504: { category: 'server_error', retryable: true },
}

/** Extract HTTP status from error messages like "ShineOn - Error: 401 Unauthorized - ..." */
function extractHttpStatus(message: string): number | undefined {
  const match = message.match(/\b([45]\d{2})\b/)
  return match ? parseInt(match[1], 10) : undefined
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) return true
  const msg = error instanceof Error ? error.message : ''
  return /ECONNRESET|ECONNREFUSED|ENOTFOUND|EPIPE|fetch failed/i.test(msg)
}

function isTimeoutError(error: unknown): boolean {
  if (error instanceof Error && error.name === 'AbortError') return true
  const msg = error instanceof Error ? error.message : ''
  return /timeout|aborted/i.test(msg)
}

/**
 * Classifies a ShineOn API error as transient (retryable) vs permanent.
 * Handles HTTP status codes embedded in error messages, network errors, and timeouts.
 */
export function classifyShineOnError(error: unknown): ShineOnErrorClassification {
  const message = error instanceof Error ? error.message : String(error)

  if (isTimeoutError(error)) {
    return { retryable: true, category: 'timeout', message, httpStatus: undefined }
  }

  if (isNetworkError(error)) {
    return { retryable: true, category: 'network', message, httpStatus: undefined }
  }

  const httpStatus = extractHttpStatus(message)
  if (httpStatus && STATUS_MAP[httpStatus]) {
    const { category, retryable } = STATUS_MAP[httpStatus]
    return { retryable, category, message, httpStatus }
  }

  if (httpStatus && httpStatus >= 500) {
    return { retryable: true, category: 'server_error', message, httpStatus }
  }

  return { retryable: false, category: 'unknown', message, httpStatus }
}

/** Shorthand: returns true if the error is transient and safe to retry */
export function isTransientError(error: unknown): boolean {
  return classifyShineOnError(error).retryable
}
