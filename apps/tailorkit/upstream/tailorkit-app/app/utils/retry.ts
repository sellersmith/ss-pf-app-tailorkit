import { sleep } from '~/utils/sleep'
import { TWO_SECONDS_IN_MILLISECONDS } from '~/constants'

export interface RetryConfig {
  /** Maximum number of retry attempts (default: 1) */
  maxRetries?: number
  /** Delay between retries in milliseconds (default: 2000) */
  retryDelayMs?: number
  /** Custom function to determine if an error is retryable (default: checks for timeout, network, rate limit, 5xx errors) */
  isRetryable?: (error: Error) => boolean
  /** Operation name for logging purposes */
  operationName?: string
}

const DEFAULT_RETRY_CONFIG: Required<Omit<RetryConfig, 'operationName'>> = {
  maxRetries: 1,
  retryDelayMs: TWO_SECONDS_IN_MILLISECONDS,
  isRetryable: (error: Error) => /timeout|network|rate.?limit|503|502|500/i.test(error.message),
}

/**
 * Wraps an async operation with retry logic for transient failures.
 * Useful for external API calls that may occasionally fail due to network issues,
 * rate limits, or temporary server errors.
 *
 * @param operation - The async function to execute
 * @param config - Optional retry configuration
 * @returns The result of the operation
 * @throws The last error encountered if all retries fail
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => api.generateImages({ prompt: 'hello' }),
 *   { operationName: 'generateImages', maxRetries: 2 }
 * )
 * ```
 */
export async function withRetry<T>(operation: () => Promise<T>, config?: RetryConfig): Promise<T> {
  const { maxRetries, retryDelayMs, isRetryable } = { ...DEFAULT_RETRY_CONFIG, ...config }
  const operationName = config?.operationName || 'operation'

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      const canRetry = isRetryable(lastError)

      if (attempt < maxRetries && canRetry) {
        console.warn(
          `${operationName}: Attempt ${attempt + 1} failed, retrying in ${retryDelayMs}ms:`,
          lastError.message
        )
        await sleep(retryDelayMs)
      } else {
        throw lastError
      }
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError || new Error(`${operationName} failed after retries`)
}
