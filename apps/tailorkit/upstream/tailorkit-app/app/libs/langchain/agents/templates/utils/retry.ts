/**
 * Retry utility for LLM calls with exponential backoff.
 * Enhanced with structured error handling and configurable retry strategies.
 */

import { ErrorUtils, ErrorReporter, BaseTemplateError, ErrorCategory, ErrorSeverity } from './error-handling'

/** Configuration options for retry behavior */
export interface RetryOptions {
  maxRetries?: number
  baseDelayMs?: number
  maxDelayMs?: number
  backoffMultiplier?: number
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
}

/**
 * Exponential backoff delay calculation.
 * @param attempt - Current attempt number
 * @param options - Retry configuration options
 * @returns Delay in milliseconds
 */
function calculateDelay(attempt: number, options: Required<RetryOptions>): number {
  const delay = options.baseDelayMs * Math.pow(options.backoffMultiplier, attempt)
  return Math.min(delay, options.maxDelayMs)
}

/**
 * Sleep utility for async delay.
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Determines if an error is retryable using enhanced error utils.
 * @param error - Error to check for retry eligibility
 * @returns True if error should be retried
 */
function isRetryableError(error: unknown): boolean {
  return ErrorUtils.isRetryable(error instanceof Error ? error : new Error(String(error)))
}

/**
 * Retry wrapper for async functions with exponential backoff and structured error reporting.
 * @param operation - Async function to retry
 * @param context - Context description for error reporting
 * @param options - Retry configuration options
 * @returns Promise resolving to operation result
 * @throws Enhanced error after all retries exhausted
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  context: string,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options }
  let lastError: unknown
  const errorContext = ErrorUtils.createContext('retry_operation', context, { maxRetries: config.maxRetries })

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error

      // Create structured error for reporting
      const structuredError
        = error instanceof BaseTemplateError
          ? error
          : new BaseTemplateError(
              error instanceof Error ? error.message : String(error),
              'OPERATION_FAILED',
              ErrorCategory.LLM_API,
              ErrorSeverity.MEDIUM,
              { ...errorContext, metadata: { ...errorContext.metadata, attempt: attempt + 1 } },
              { originalError: error instanceof Error ? error : undefined }
            )

      // Report error on final attempt
      if (attempt === config.maxRetries || !isRetryableError(error)) {
        ErrorReporter.getInstance().reportError(structuredError)
        break
      }

      const delay = calculateDelay(attempt, config)
      console.warn(`${context}: Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, structuredError.message)

      await sleep(delay)
    }
  }

  // All retries exhausted
  const finalError = new BaseTemplateError(
    `${context} failed after ${config.maxRetries + 1} attempts`,
    'RETRY_EXHAUSTED',
    ErrorCategory.LLM_API,
    ErrorSeverity.HIGH,
    errorContext,
    { originalError: lastError instanceof Error ? lastError : undefined }
  )

  ErrorReporter.getInstance().reportError(finalError)
  throw finalError
}

/**
 * Enhanced error with context information for better debugging.
 */
export class TemplateAgentError extends Error {
  constructor(
    public readonly context: string,
    public readonly originalError: unknown,
    message?: string
  ) {
    super(message || `${context} failed: ${originalError}`)
    this.name = 'TemplateAgentError'
  }
}

/**
 * Safe wrapper that catches and enhances errors with context.
 * @param operation - Async function to execute safely
 * @param context - Context description for error enhancement
 * @param fallback - Optional fallback value on error
 * @returns Operation result or fallback value
 * @throws Enhanced TemplateAgentError if no fallback provided
 */
export async function withErrorContext<T>(operation: () => Promise<T>, context: string, fallback?: T): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    console.error(`Error in ${context}:`, error)

    if (fallback !== undefined) {
      console.warn(`${context}: Using fallback value due to error`)
      return fallback
    }

    throw new TemplateAgentError(context, error)
  }
}
