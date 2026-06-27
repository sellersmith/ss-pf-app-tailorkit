import type { SSReferral, SSTargetApp } from './types.server'
import { getSSReferralConfig } from './config.server'

const REQUEST_TIMEOUT_MS = 5_000

// ── Internal fetch wrapper ─────────────────────────────────────────────────

interface FetchOptions {
  method: 'GET' | 'PUT' | 'PATCH'
  path: string
  query?: Record<string, string>
  body?: Record<string, unknown>
}

type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string }

async function ssApiFetch<T = unknown>(opts: FetchOptions): Promise<ApiResult<T>> {
  const config = getSSReferralConfig()
  if (!config) {
    return { ok: false, status: 0, error: 'SS referral tracking not configured — skipping' }
  }

  const url = new URL(`${config.baseUrl}${opts.path}`)
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      url.searchParams.set(k, v)
    }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const res = await fetch(url.toString(), {
      method: opts.method,
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { ok: false, status: res.status, error: text }
    }

    const data = (await res.json()) as T
    return { ok: true, data }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, status: 0, error: msg }
  } finally {
    clearTimeout(timer)
  }
}

// ── Request / response shapes ──────────────────────────────────────────────

interface PutReferralBody {
  sourceApp: 'tailorkit'
  targetApp: SSTargetApp
  clientIPAddress: string
  clientUserAgent: string
  shopDomain?: string
  email?: string
  shopDescription?: string
  landingPage?: string
  crossSellPosition?: string
}

interface GetReferralQuery {
  targetApp: 'tailorkit'
  clientIPAddress: string
  clientUserAgent: string
}

export interface GetReferralResponse {
  referral: SSReferral | null
}

interface PatchReferralBody {
  targetApp: 'tailorkit'
  clientIPAddress: string
  clientUserAgent: string
  convertedShopDomain?: string
  convertedEmail?: string
  convertedShopDescription?: string
}

// ── Public API wrappers ────────────────────────────────────────────────────

/**
 * PUT /api/v1/referrals — record a cross-sell click (idempotent upsert).
 * TailorKit is always the source app.
 */
export function putReferral(body: PutReferralBody): Promise<ApiResult<unknown>> {
  return ssApiFetch({ method: 'PUT', path: '/api/v1/referrals', body: body as Record<string, unknown> })
}

/**
 * GET /api/v1/referrals — look up a pending referral by IP + UA fingerprint.
 * Returns only status='referred' records; already-converted ones return null.
 */
export function getReferral(query: GetReferralQuery): Promise<ApiResult<GetReferralResponse>> {
  return ssApiFetch<GetReferralResponse>({ method: 'GET', path: '/api/v1/referrals', query })
}

/**
 * PATCH /api/v1/referrals — confirm a conversion.
 * Returns 404 when no pending referral found (organic install) — handle gracefully.
 */
export function patchReferral(body: PatchReferralBody): Promise<ApiResult<unknown>> {
  return ssApiFetch({ method: 'PATCH', path: '/api/v1/referrals', body: body as Record<string, unknown> })
}
