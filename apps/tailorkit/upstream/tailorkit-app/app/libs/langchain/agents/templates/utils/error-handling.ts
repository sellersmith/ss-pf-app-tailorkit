/**
 * Comprehensive error handling system for template agents.
 * Provides structured error types, reporting, and recovery strategies for LLM operations.
 */
import { sanitizeErrorMessage } from './sanitization'

/** Error severity levels for prioritizing error handling */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/** Error categories for classification and routing */
export enum ErrorCategory {
  VALIDATION = 'validation',
  SCHEMA = 'schema',
  LLM_API = 'llm_api',
  CACHE = 'cache',
  FONT_RESOLUTION = 'font_resolution',
  PARSING = 'parsing',
  NETWORK = 'network',
  TIMEOUT = 'timeout',
  AUTHENTICATION = 'authentication',
  RATE_LIMIT = 'rate_limit',
}

/** Context information for error tracking and debugging */
export interface ErrorContext {
  operation: string
  component: string
  timestamp: number
  requestId?: string
  userId?: string
  metadata?: Record<string, any>
}

/** Extended error interface with template-specific metadata */
export interface TemplateError extends Error {
  code: string
  category: ErrorCategory
  severity: ErrorSeverity
  context: ErrorContext
  recoverable: boolean
  retryable: boolean
  originalError?: Error
}

/**
 * Base class for all template-related errors with structured metadata.
 * Provides consistent error handling across template agents.
 */
export class BaseTemplateError extends Error implements TemplateError {
  code: string
  category: ErrorCategory
  severity: ErrorSeverity
  context: ErrorContext
  recoverable: boolean
  retryable: boolean
  originalError?: Error

  constructor(
    message: string,
    code: string,
    category: ErrorCategory,
    severity: ErrorSeverity,
    context: ErrorContext,
    options: {
      recoverable?: boolean
      retryable?: boolean
      originalError?: Error
    } = {}
  ) {
    super(message)
    this.name = this.constructor.name
    this.code = code
    this.category = category
    this.severity = severity
    this.context = context
    this.recoverable = options.recoverable ?? true
    this.retryable = options.retryable ?? false
    this.originalError = options.originalError

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      category: this.category,
      severity: this.severity,
      context: this.context,
      recoverable: this.recoverable,
      retryable: this.retryable,
      stack: this.stack,
      originalError: this.originalError?.message,
    }
  }
}

/**
 * Specific error types for different scenarios
 */
export class SchemaValidationError extends BaseTemplateError {
  constructor(message: string, context: ErrorContext, originalError?: Error) {
    super(message, 'SCHEMA_VALIDATION_FAILED', ErrorCategory.SCHEMA, ErrorSeverity.HIGH, context, {
      recoverable: false,
      retryable: false,
      originalError,
    })
  }
}

export class LLMTimeoutError extends BaseTemplateError {
  constructor(message: string, context: ErrorContext, originalError?: Error) {
    super(message, 'LLM_TIMEOUT', ErrorCategory.TIMEOUT, ErrorSeverity.MEDIUM, context, {
      recoverable: true,
      retryable: true,
      originalError,
    })
  }
}

export class FontResolutionError extends BaseTemplateError {
  constructor(message: string, context: ErrorContext, originalError?: Error) {
    super(message, 'FONT_RESOLUTION_FAILED', ErrorCategory.FONT_RESOLUTION, ErrorSeverity.LOW, context, {
      recoverable: true,
      retryable: false,
      originalError,
    })
  }
}

export class CacheError extends BaseTemplateError {
  constructor(message: string, context: ErrorContext, originalError?: Error) {
    super(message, 'CACHE_OPERATION_FAILED', ErrorCategory.CACHE, ErrorSeverity.LOW, context, {
      recoverable: true,
      retryable: false,
      originalError,
    })
  }
}

export class ContextAnalysisError extends BaseTemplateError {
  constructor(message: string, context: ErrorContext, originalError?: Error) {
    super(message, 'CONTEXT_ANALYSIS_FAILED', ErrorCategory.LLM_API, ErrorSeverity.HIGH, context, {
      recoverable: true,
      retryable: true,
      originalError,
    })
  }
}

export class IntentAnalysisError extends BaseTemplateError {
  constructor(message: string, context: ErrorContext, originalError?: Error) {
    super(message, 'INTENT_ANALYSIS_FAILED', ErrorCategory.LLM_API, ErrorSeverity.HIGH, context, {
      recoverable: true,
      retryable: true,
      originalError,
    })
  }
}

export class RateLimitError extends BaseTemplateError {
  constructor(message: string, context: ErrorContext, originalError?: Error) {
    super(message, 'RATE_LIMIT_EXCEEDED', ErrorCategory.RATE_LIMIT, ErrorSeverity.MEDIUM, context, {
      recoverable: true,
      retryable: true,
      originalError,
    })
  }
}

/**
 * Error reporter for collecting and sending error metrics
 */
export class ErrorReporter {
  private static instance: ErrorReporter
  private errorQueue: TemplateError[] = []
  private maxQueueSize = 100

  static getInstance(): ErrorReporter {
    if (!ErrorReporter.instance) {
      ErrorReporter.instance = new ErrorReporter()
    }
    return ErrorReporter.instance
  }

  /**
   * Report an error to the queue for collection and analysis.
   * @param error - Template error to report
   */
  reportError(error: TemplateError): void {
    // Add to queue
    this.errorQueue.push(error)

    // Prevent memory leaks by limiting queue size
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue.shift()
    }

    // Log critical errors immediately
    if (error.severity === ErrorSeverity.CRITICAL) {
      console.error('CRITICAL ERROR:', error)
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`[${error.category}] ${error.code}:`, error.message)
    }
  }

  /**
   * Get error statistics for monitoring and analysis.
   * @returns Error statistics including counts by category and severity
   */
  getErrorStats(): {
    totalErrors: number
    byCategory: Record<ErrorCategory, number>
    bySeverity: Record<ErrorSeverity, number>
    recentErrors: TemplateError[]
  } {
    const byCategory = {} as Record<ErrorCategory, number>
    const bySeverity = {} as Record<ErrorSeverity, number>

    // Initialize counters
    Object.values(ErrorCategory).forEach(cat => (byCategory[cat] = 0))
    Object.values(ErrorSeverity).forEach(sev => (bySeverity[sev] = 0))

    // Count errors
    this.errorQueue.forEach(error => {
      byCategory[error.category]++
      bySeverity[error.severity]++
    })

    return {
      totalErrors: this.errorQueue.length,
      byCategory,
      bySeverity,
      recentErrors: this.errorQueue.slice(-10), // Last 10 errors
    }
  }

  /**
   * Clear error queue
   */
  clearErrors(): void {
    this.errorQueue = []
  }

  /**
   * Export errors for external reporting
   */
  exportErrors(): TemplateError[] {
    return [...this.errorQueue]
  }
}

/**
 * Utility functions for error handling
 */
export const ErrorUtils = {
  /**
   * Create error context for tracking.
   * @param operation - Operation name
   * @param component - Component name
   * @param metadata - Additional metadata
   * @returns Error context object
   */
  createContext(operation: string, component: string, metadata?: Record<string, any>): ErrorContext {
    return {
      operation,
      component,
      timestamp: Date.now(),
      metadata,
    }
  },

  /**
   * Check if error is retryable based on type and patterns.
   * @param error - Error to check
   * @returns True if error should be retried
   */
  isRetryable(error: Error): boolean {
    if (error instanceof BaseTemplateError) {
      return error.retryable
    }

    // Common retryable error patterns
    const retryablePatterns = [/timeout/i, /network/i, /rate.?limit/i, /503/, /502/, /500/]

    return retryablePatterns.some(pattern => pattern.test(error.message) || pattern.test(error.name))
  },

  /**
   * Get appropriate retry delay with exponential backoff.
   * @param attempt - Attempt number (0-based)
   * @param baseDelay - Base delay in milliseconds
   * @returns Delay in milliseconds
   */
  getRetryDelay(attempt: number, baseDelay = 1000): number {
    return Math.min(baseDelay * Math.pow(2, attempt), 30000) // Max 30 seconds
  },

  /**
   * Sanitize error for logging (remove sensitive data)
   */
  sanitizeError(error: TemplateError): Partial<TemplateError> {
    const { context, ...rest } = error

    return {
      ...rest,
      context: {
        ...context,
        userId: context.userId ? '[REDACTED]' : undefined,
        metadata: context.metadata ? this.sanitizeMetadata(context.metadata) : undefined,
      },
    }
  },

  /**
   * Remove potentially sensitive metadata
   */
  sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    const sanitized = { ...metadata }

    // Remove common sensitive fields
    const sensitiveFields = ['password', 'token', 'key', 'secret', 'auth', 'apikey', 'api_key']
    sensitiveFields.forEach(field => {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]'
      }
    })

    return sanitized
  },

  /**
   * Create a user-friendly error message that doesn't leak sensitive information.
   * @param error - Template error to format
   * @returns User-friendly error message
   */
  createUserFriendlyMessage(error: TemplateError): string {
    const sanitizedMessage = sanitizeErrorMessage(error.message)

    // Map specific errors to user-friendly messages
    switch (error.category) {
      case ErrorCategory.LLM_API:
        return 'Unable to generate content. Please try again in a moment.'
      case ErrorCategory.RATE_LIMIT:
        return 'Service is temporarily busy. Please wait a moment and try again.'
      case ErrorCategory.NETWORK:
        return 'Connection issue detected. Please check your internet connection and try again.'
      case ErrorCategory.AUTHENTICATION:
        return 'Authentication required. Please refresh the page and try again.'
      case ErrorCategory.VALIDATION:
        return sanitizedMessage || 'Invalid input provided. Please check your data and try again.'
      case ErrorCategory.TIMEOUT:
        return 'Request timed out. Please try again with a simpler request.'
      default:
        return sanitizedMessage || 'An unexpected error occurred. Please try again.'
    }
  },
}
