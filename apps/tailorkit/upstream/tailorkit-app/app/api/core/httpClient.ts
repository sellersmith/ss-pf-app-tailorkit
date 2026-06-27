import { t } from 'i18next'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type HttpRequestOptions<TBody = unknown> = {
  method?: HttpMethod
  body?: TBody
  headers?: Record<string, string>
  signal?: AbortSignal
  /** Cache result in-memory for identical GET requests */
  preferCache?: boolean
}

export type HttpResponse<TData> = {
  ok: boolean
  status: number
  data: TData | null
}

export class ApiError extends Error {
  public status: number
  public details?: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

const requesting: Record<string, boolean> = {}
const cache: Record<string, unknown> = {}

/**
 * Minimal auth-aware HTTP client that reuses Shopify `idToken` via existing authenticatedFetch logic.
 * Centralizes error handling and optional GET response caching.
 */
export async function httpRequest<T = unknown>(
  url: string,
  options: HttpRequestOptions = {}
): Promise<HttpResponse<T>> {
  const method = options.method ?? 'GET'
  const cacheKey = method === 'GET' && !options.body ? url : ''

  if (cacheKey && options.preferCache && cache[cacheKey]) {
    return { ok: true, status: 200, data: cache[cacheKey] as T }
  }

  // Prevent duplicate in-flight GETs to the same URL
  if (cacheKey && requesting[cacheKey]) {
    await new Promise(resolve => setTimeout(resolve, 60))
    return httpRequest<T>(url, options)
  }

  if (cacheKey) requesting[cacheKey] = true

  try {
    const shopify = (window as any).opener?.shopify ?? (window as any).shopify
    const idToken = await shopify.idToken()

    const headers: Record<string, string> = {
      ...(options.headers || {}),
      Authorization: `Bearer ${idToken}`,
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
      signal: options.signal,
    }

    if (options.body !== undefined && options.body !== null) {
      if (options.body instanceof FormData || options.body instanceof Blob) {
        ;(fetchOptions as any).body = options.body as any
      } else if (typeof options.body === 'string') {
        headers['Content-Type'] = headers['Content-Type'] || 'application/json'
        ;(fetchOptions as any).body = options.body
      } else {
        headers['Content-Type'] = headers['Content-Type'] || 'application/json'
        ;(fetchOptions as any).body = JSON.stringify(options.body)
      }
    }

    const res = await fetch(url, fetchOptions)

    // Content may be empty (204 or no body)
    const text = await res.text()
    const json = text ? (JSON.parse(text) as any) : null

    if (!res.ok) {
      const message = translateMessage(json?.message || `HTTP ${res.status}`)
      throw new ApiError(message, res.status, json)
    }

    if (cacheKey && options.preferCache && json !== null) {
      cache[cacheKey] = json
    }

    return { ok: true, status: res.status, data: json as T }
  } catch (error: unknown) {
    if (cacheKey) delete requesting[cacheKey]

    if (error instanceof ApiError) {
      return { ok: false, status: error.status, data: null }
    }

    const message = translateMessage((error as any)?.message || 'unknown-error')
    console.error('[httpRequest] Unexpected error:', error)
    throw new ApiError(message, 0, error)
  } finally {
    if (cacheKey) delete requesting[cacheKey]
  }
}

function translateMessage(message: string): string {
  try {
    return t(message)
  } catch {
    return message
  }
}

export const Http = {
  get: <T>(url: string, options?: Omit<HttpRequestOptions, 'method' | 'body'>) =>
    httpRequest<T>(url, { ...options, method: 'GET' }),
  post: <T, B = unknown>(url: string, body?: B, options?: Omit<HttpRequestOptions<B>, 'method' | 'body'>) =>
    httpRequest<T>(url, { ...options, method: 'POST', body }),
  put: <T, B = unknown>(url: string, body?: B, options?: Omit<HttpRequestOptions<B>, 'method' | 'body'>) =>
    httpRequest<T>(url, { ...options, method: 'PUT', body }),
  patch: <T, B = unknown>(url: string, body?: B, options?: Omit<HttpRequestOptions<B>, 'method' | 'body'>) =>
    httpRequest<T>(url, { ...options, method: 'PATCH', body }),
  delete: <T, B = unknown>(url: string, body?: B, options?: Omit<HttpRequestOptions<B>, 'method' | 'body'>) =>
    httpRequest<T>(url, { ...options, method: 'DELETE', body }),
}
