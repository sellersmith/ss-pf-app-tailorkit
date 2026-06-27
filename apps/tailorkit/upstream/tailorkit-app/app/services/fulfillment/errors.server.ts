/**
 * Shared provider error classes for uniform error handling across all fulfillment adapters.
 * Each adapter maps its SDK errors to these types.
 */

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly providerName: string,
    public readonly retryable: boolean
  ) {
    super(message)
    this.name = 'ProviderError'
  }
}

export class ProviderAuthError extends ProviderError {
  constructor(providerName: string, message = 'Authentication failed') {
    super(message, providerName, false)
    this.name = 'ProviderAuthError'
  }
}

export class ProviderRateLimitError extends ProviderError {
  constructor(
    providerName: string,
    public readonly retryAfterMs?: number
  ) {
    super('Rate limit exceeded', providerName, true)
    this.name = 'ProviderRateLimitError'
  }
}

export class ProviderNotFoundError extends ProviderError {
  constructor(providerName: string, resource: string) {
    super(`${resource} not found`, providerName, false)
    this.name = 'ProviderNotFoundError'
  }
}

export class ProviderOrderError extends ProviderError {
  constructor(providerName: string, message: string, retryable = false) {
    super(message, providerName, retryable)
    this.name = 'ProviderOrderError'
  }
}

export class ProviderValidationError extends ProviderError {
  constructor(providerName: string, message: string) {
    super(message, providerName, false)
    this.name = 'ProviderValidationError'
  }
}
