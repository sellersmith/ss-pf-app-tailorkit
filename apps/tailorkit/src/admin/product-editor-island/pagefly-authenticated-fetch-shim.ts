import type { AppApiClient } from '../../../../../web/core/src/app-platform/admin'
import {
  mapTailorKitIntegrationActionPath,
  mapTailorKitIntegrationActionRequest,
} from '../../domain/product-personalizer-integration-action-request'
import {
  resolveTailorKitCopiedRouteRequestBridge,
  type TailorKitCopiedRouteRequestBridgeResult,
} from '../../domain/product-personalizer-copied-route-request-bridge'
import {
  isTailorKitTemplateSaveAction,
  mapTailorKitTemplateSaveActionRequest,
} from '../../domain/product-personalizer-template-action-request'
import {
  buildTailorKitColourGuideRequestBody,
  buildTailorKitImageUploadRequestBody,
  isTailorKitColourGuideUploadRequest,
  isTailorKitImageUploadRequest,
} from './pagefly-image-upload-bridge'

let pageflyAppApiClient: AppApiClient | null = null
let restorePageFlyRawFetch: (() => void) | null = null

// In-flight GET dedup + short-TTL cache: many copied components (useAppConfig,
// global-styling, InstallAppEmbedActivator…) independently fetch the same setup
// endpoint on mount, seconds apart — in-flight dedup alone misses the sequential
// ones. A 3s resolved-value cache collapses the mount burst to one host call.
//
// TTL is kept below the embed-install poll interval (InstallAppEmbedActivator polls
// /theme-config every 4s to detect `enabledAppEmbed` flipping true). The poll is the
// only recurring reader while a merchant waits on install, and it is temporally
// disjoint from the page-load mount burst, so in practice each 4s tick finds the
// 3s entry expired and reaches the server. Edge: a *coincidental* non-poll fetch in
// the (tick-3s, tick) window can serve one poll tick from cache — bounded to a
// single ~4s detection delay that self-heals on the next tick. If install detection
// ever needs a hard freshness guarantee, give the poll path a cache-bypass instead
// of widening this comment. Keep TTL < poll interval.
const GET_CACHE_TTL_MS = 3000
const inFlightGetRequests = new Map<string, Promise<unknown>>()
const resolvedGetCache = new Map<string, { value: unknown; expiresAt: number }>()

export { mapTailorKitIntegrationActionPath }

export function bindPageFlyAuthenticatedFetch(apiClient: AppApiClient | null) {
  pageflyAppApiClient = apiClient
}

type TailorKitRawFetchBridgeMethod = 'GET' | 'POST'

export interface TailorKitRawFetchBridgeMapping {
  method: TailorKitRawFetchBridgeMethod
  path: string
}

interface TailorKitRawFetchMappedBridge {
  status: 'mapped'
  method: TailorKitRawFetchBridgeMethod
  path: string
}

interface TailorKitRawFetchBlockedBridge {
  status: 'blocked'
  body: {
    success: false
    message: string
    reason: string
    sourceDecisionId: string | null
  }
}

type TailorKitRawFetchBridgeResolution = TailorKitRawFetchMappedBridge | TailorKitRawFetchBlockedBridge | null

/**
 * TailorKit ProductSelector clears its authenticatedFetch client cache after product mutations.
 * Clears the shim's short-TTL GET cache + in-flight map so the next read is fresh. With no keys
 * (or an empty list) it clears everything; otherwise it best-effort deletes the given mapped paths.
 * Note: theme-config freshness is primarily TTL-driven (3s), so exact-key matching is not required.
 */
export function clearAuthenticatedFetchCache(cacheKeys?: string[]) {
  if (!cacheKeys || cacheKeys.length === 0) {
    resolvedGetCache.clear()
    inFlightGetRequests.clear()
    return
  }
  for (const key of cacheKeys) {
    resolvedGetCache.delete(key)
    inFlightGetRequests.delete(key)
  }
}

function requestAction(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const action = (body as { action?: unknown }).action
  return typeof action === 'string' ? action : null
}

function requestType(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const type = (body as { type?: unknown }).type
  return typeof type === 'string' ? type : null
}

export function mapTailorKitAuthenticatedFetchPath(path: string, method = 'GET', action?: string | null): string {
  const url = new URL(path, 'https://tailorkit.local')
  const pathname = url.pathname
  const normalizedMethod = method.toUpperCase()

  if (!pathname.startsWith('/api/')) return `${pathname}${url.search}`

  const bridge = resolveTailorKitCopiedRouteRequestBridge({ path, method: normalizedMethod, action })
  if (bridge.status === 'mapped' && bridge.pageflyPath) return bridge.pageflyPath

  throw mappedFetchError(bridge, pathname, normalizedMethod)
}

function mappedFetchError(
  bridge: TailorKitCopiedRouteRequestBridgeResult,
  pathname: string,
  normalizedMethod: string
): Error {
  if (bridge.sourceDecisionId === 'product-selector-products') {
    return new Error(
      `Unsupported TailorKit ProductSelector mutation or non-existing source in PageFly island: ${normalizedMethod} ${pathname}`
    )
  }
  if (bridge.sourceDecisionId?.startsWith('product-selector-provider-product-')) {
    return new Error(
      `Unsupported TailorKit provider ProductSelector endpoint in PageFly island: ${normalizedMethod} ${pathname}`
    )
  }

  return new Error(`Unsupported TailorKit authenticatedFetch endpoint in PageFly island: ${pathname}`)
}

function requestBody(body: unknown) {
  if (typeof FormData !== 'undefined' && body instanceof FormData) return formDataBody(body)
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return formDataBody(body)
  if (typeof body !== 'string') return body
  try {
    return JSON.parse(body)
  } catch {
    return body
  }
}

function parseFormValue(value: FormDataEntryValue | string): unknown {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed) return value

  if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
    try {
      return JSON.parse(trimmed)
    } catch {
      return value
    }
  }

  return value
}

function formDataBody(body: FormData | URLSearchParams): Record<string, unknown> {
  const record: Record<string, unknown> = {}

  for (const [key, value] of body.entries()) {
    const parsed = parseFormValue(value)
    if (key in record) {
      const current = record[key]
      record[key] = Array.isArray(current) ? [...current, parsed] : [current, parsed]
    } else {
      record[key] = parsed
    }
  }

  return record
}

function fetchUrl(input: RequestInfo | URL): URL | null {
  if (typeof input === 'string') return new URL(input, 'https://tailorkit.local')
  if (input instanceof URL) return input
  if (typeof Request !== 'undefined' && input instanceof Request) return new URL(input.url, 'https://tailorkit.local')
  return null
}

function isAbsoluteUrl(input: string) {
  return /^[a-z][a-z\d+\-.]*:\/\//i.test(input)
}

function isLocalTailorKitApiFetch(input: RequestInfo | URL, url: URL): boolean {
  if (!url.pathname.startsWith('/api/')) return false

  // PageFly app-platform owns `/api/apps/<appId>/*`; those are host API calls
  // (e.g. host.api.get('/theme-config')) and must pass through to the real
  // fetch, not be re-intercepted as copied TailorKit `~/routes/api.*` traffic.
  if (url.pathname.startsWith('/api/apps/')) return false

  if (typeof input === 'string') return !isAbsoluteUrl(input)
  if (input instanceof URL) return url.origin === 'https://tailorkit.local'
  if (typeof Request !== 'undefined' && input instanceof Request) {
    if (url.origin === 'https://tailorkit.local') return true
    return typeof window !== 'undefined' && url.origin === window.location.origin
  }

  return false
}

function fetchMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase()
  if (typeof Request !== 'undefined' && input instanceof Request) return input.method.toUpperCase()
  return 'GET'
}

async function fetchBody(input: RequestInfo | URL, init?: RequestInit): Promise<unknown> {
  if (init && 'body' in init) return requestBody(init.body)
  if (typeof Request !== 'undefined' && input instanceof Request) return requestBody(await input.clone().text())
  return undefined
}

export function mapTailorKitRawFetchPath(
  input: RequestInfo | URL,
  init?: RequestInit
): TailorKitRawFetchBridgeMapping | null {
  const resolution = resolveTailorKitRawFetchBridge(input, init)

  if (resolution?.status === 'mapped') return { method: resolution.method, path: resolution.path }

  return null
}

function resolveTailorKitRawFetchBridge(
  input: RequestInfo | URL,
  init?: RequestInit
): TailorKitRawFetchBridgeResolution {
  const url = fetchUrl(input)
  if (!url) return null

  const method = fetchMethod(input, init)
  const rawBridgePath = url.pathname.startsWith('/api/templates') || url.pathname === '/api/integrations'
  const localApiFetch = isLocalTailorKitApiFetch(input, url)
  if (method !== 'GET' && method !== 'POST') return null
  if (!rawBridgePath && !localApiFetch) return null

  const parsedBody = init && 'body' in init ? requestBody(init.body) : undefined
  const bridge = resolveTailorKitCopiedRouteRequestBridge({
    path: `${url.pathname}${url.search}`,
    method,
    action: requestAction(parsedBody) || requestType(parsedBody),
  })
  if (
    bridge.status === 'mapped' &&
    (bridge.pageflyMethod === 'GET' || bridge.pageflyMethod === 'POST') &&
    bridge.pageflyPath
  ) {
    return { status: 'mapped', method: bridge.pageflyMethod, path: bridge.pageflyPath }
  }

  if (bridge.status === 'blocked-pending-source-mapped-adapter') {
    return {
      status: 'blocked',
      body: {
        success: false,
        message: bridge.reason,
        reason: bridge.sourceDecisionStatus || bridge.status,
        sourceDecisionId: bridge.sourceDecisionId,
      },
    }
  }

  if (localApiFetch && !bridge.sourceDecisionId) {
    return {
      status: 'blocked',
      body: {
        success: false,
        message: `Unsupported TailorKit raw fetch endpoint in PageFly island: ${method} ${url.pathname}`,
        reason: 'unsupported-tailorkit-raw-api',
        sourceDecisionId: null,
      },
    }
  }

  return {
    status: 'blocked',
    body: {
      success: false,
      message: bridge.reason,
      reason: bridge.status,
      sourceDecisionId: bridge.sourceDecisionId,
    },
  }
}

async function mapTailorKitRawFetchBody(
  sourcePath: string,
  mappedPath: string,
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<unknown> {
  const body = await fetchBody(input, init)

  if (isTailorKitTemplateSaveAction(sourcePath, body)) {
    return (await mapTailorKitTemplateSaveActionRequest(sourcePath, body)).body
  }

  void mappedPath
  return body
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export function createPageFlyRawFetchBridge(apiClient: AppApiClient, originalFetch: typeof fetch): typeof fetch {
  return async (input, init) => {
    const resolution = resolveTailorKitRawFetchBridge(input, init)
    if (!resolution) return originalFetch(input, init)

    if (resolution.status === 'blocked') {
      return jsonResponse(resolution.body, 501)
    }

    if (resolution.method === 'GET') {
      return jsonResponse(await dedupGet(apiClient, resolution.path, Date.now()))
    }

    const url = fetchUrl(input)
    const sourcePath = url ? `${url.pathname}${url.search}` : ''
    const body = await mapTailorKitRawFetchBody(sourcePath, resolution.path, input, init)
    return jsonResponse(await apiClient.post(resolution.path, body))
  }
}

export function bindPageFlyRawFetch(apiClient: AppApiClient | null) {
  restorePageFlyRawFetch?.()
  restorePageFlyRawFetch = null

  if (!apiClient || typeof window === 'undefined' || typeof window.fetch !== 'function') return

  const originalFetch = window.fetch.bind(window)
  const bridgedFetch = createPageFlyRawFetchBridge(apiClient, originalFetch)

  window.fetch = bridgedFetch
  restorePageFlyRawFetch = () => {
    if (window.fetch === bridgedFetch) {
      window.fetch = originalFetch
    }
  }
}

function isIntegrationDetailRead(path: string, method: string) {
  const url = new URL(path, 'https://tailorkit.local')
  return method === 'GET' && url.pathname.startsWith('/api/integrations/')
}

function adaptTailorKitAuthenticatedFetchResponse(path: string, method: string, response: unknown) {
  if (!isIntegrationDetailRead(path, method) || !response || typeof response !== 'object') return response

  const payload = response as {
    success?: unknown
    item?: unknown
    editorLoader?: { integration?: unknown }
  }

  if (payload.success === true) return payload.editorLoader?.integration ?? payload.item ?? response

  return response
}

function dedupGet<T>(apiClient: AppApiClient, mappedPath: string, nowMs: number): Promise<T> {
  const cached = resolvedGetCache.get(mappedPath)
  if (cached && cached.expiresAt > nowMs) return Promise.resolve(cached.value as T)

  const pending = inFlightGetRequests.get(mappedPath)
  if (pending) return pending as Promise<T>

  // Cache only on resolve; a rejected GET leaves no entry so the next call retries cleanly.
  const request = apiClient
    .get<T>(mappedPath)
    .then(value => {
      resolvedGetCache.set(mappedPath, { value, expiresAt: nowMs + GET_CACHE_TTL_MS })
      return value
    })
    .finally(() => {
      inFlightGetRequests.delete(mappedPath)
    })
  inFlightGetRequests.set(mappedPath, request)
  return request
}

export async function authenticatedFetch<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown } = {}
): Promise<T> {
  if (!pageflyAppApiClient) {
    throw new Error('PageFly app API client is unavailable for TailorKit authenticatedFetch')
  }

  const url = new URL(path, 'https://tailorkit.local')
  const method = (init.method || 'GET').toUpperCase()

  // ImageSelector upload posts a multipart FormData of File blobs. Base64-bridge it to JSON before the
  // generic formDataBody flattening (which would drop the binary File entries) and send to /files/upload.
  if (method === 'POST' && isTailorKitImageUploadRequest(path, init.body)) {
    const uploadBody = await buildTailorKitImageUploadRequestBody(init.body as FormData)
    return pageflyAppApiClient.post<T>(mapTailorKitAuthenticatedFetchPath(path, method), uploadBody)
  }

  // Colour Guide upload posts a single-file FormData; base64-bridge it the same way.
  if (method === 'POST' && isTailorKitColourGuideUploadRequest(path, init.body)) {
    const colourGuideBody = await buildTailorKitColourGuideRequestBody(init.body as FormData)
    return pageflyAppApiClient.post<T>(mapTailorKitAuthenticatedFetchPath(path, method), colourGuideBody)
  }

  const parsedBody = requestBody(init.body)
  const isTailorKitIntegrationAction = url.pathname === '/api/integration' && method === 'POST'
  const mappedAction = isTailorKitIntegrationAction ? await mapTailorKitIntegrationActionRequest(init.body) : null
  const mappedPath = mappedAction?.path ?? mapTailorKitAuthenticatedFetchPath(path, method, requestAction(parsedBody))
  const mappedMethod = mappedAction?.method ?? method
  const mappedBody = mappedAction ? mappedAction.body : parsedBody

  if (mappedMethod === 'GET') {
    const response = await dedupGet<T>(pageflyAppApiClient, mappedPath, Date.now())
    return adaptTailorKitAuthenticatedFetchResponse(path, method, response) as T
  }
  if (mappedMethod === 'POST') return pageflyAppApiClient.post<T>(mappedPath, mappedBody)
  if (mappedMethod === 'PUT') return pageflyAppApiClient.put<T>(mappedPath, mappedBody)
  if (mappedMethod === 'DELETE') return pageflyAppApiClient.delete<T>(mappedPath)

  throw new Error(`Unsupported TailorKit authenticatedFetch method in PageFly island: ${mappedMethod}`)
}
