import type { AppBackendRegisterContext } from '../../../../web/server/src/app-platform/contracts'
import { TAILORKIT_CAPABILITIES } from '../domain/capabilities'
import { parseTrackEvent, parseUploadFiles } from './storefront-proxy-action-parsers'

/**
 * Storefront app-proxy action dispatcher for TailorKit.
 *
 * The TailorKit storefront runtime POSTs to PageFly's shared app proxy
 * (`/apps/<subpath>/app_proxy/storefront`) with an `action` + `body`. The PageFly proxy entry
 * (`web/server/src/routers/api/proxy/app_proxy/storefront.ts`) verifies the Shopify HMAC, resolves
 * the shop, marshals multipart files onto the body, and forwards here as `POST /storefront`. This
 * handler switches on `body.action`, dispatching each action to the host port it actually needs.
 *
 * Action → infra parity (mirrors the upstream Remix `api.app_proxy.storefront` route):
 *  - get-products-from-ids → Shopify resource port (charm products)
 *  - upload-image / upload-svg → Shopify resource port `uploadFiles` (NO AI; same path admin uses)
 *  - track-event → tracking port
 *  - check-ai-credits-status → soft availability (storefront degrades to "available" on uncertainty)
 *  - generate-* / remove-background-image / ai-assistant-call / get-prompt-presets → require the
 *    TailorKit AI server, not yet ported into app-platform; these return a per-action `not available`
 *    so the storefront hides the feature instead of throwing. (proxy-image returns binary and is
 *    served at the proxy boundary, never reaching this JSON dispatcher.)
 */

const PREFIX_PRODUCT_ID = 'gid://shopify/Product/'

const CORS_HEADER = { 'Access-Control-Allow-Origin': '*' } as const

function parseProxyBody(body: unknown): { action: string; payload: Record<string, unknown> } {
  const record = (body || {}) as Record<string, unknown>
  const action = typeof record.action === 'string' ? record.action : ''

  // Storefront posts FormData: `body` is a JSON string field alongside `action`.
  let payload: Record<string, unknown> = {}
  const rawBody = record.body
  if (typeof rawBody === 'string') {
    try {
      const parsed = JSON.parse(rawBody)
      if (parsed && typeof parsed === 'object') payload = parsed as Record<string, unknown>
    } catch {
      payload = {}
    }
  } else if (rawBody && typeof rawBody === 'object') {
    payload = rawBody as Record<string, unknown>
  }

  return { action, payload }
}

function normalizeCharmIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return []
  return ids
    .filter((id): id is string => typeof id === 'string' && Boolean(id))
    .map(id => (id.includes(PREFIX_PRODUCT_ID) ? id.split(PREFIX_PRODUCT_ID)[1] : id))
}

// AI generation actions that require the TailorKit AI server (text/image/vector generation, background
// removal, the MCP assistant) or DB-backed prompt presets. None are ported into app-platform yet, so
// each returns a structured per-action `not available` (503) the storefront treats as a soft failure.
const PENDING_AI_ACTIONS = new Set([
  'generate-text',
  'generate-image',
  'generate-vector',
  'remove-background-image',
  'ai-assistant-call',
  'get-prompt-presets',
])

export function registerTailorKitStorefrontProxyApi(ctx: AppBackendRegisterContext) {
  ctx.api.route({
    method: 'POST',
    path: '/storefront',
    capability: TAILORKIT_CAPABILITIES.readThemeConfig,
    async handler(request) {
      const { action, payload } = parseProxyBody(request.body)

      if (action === 'get-products-from-ids') {
        const ids = normalizeCharmIds(payload.ids)
        if (!ids.length) {
          return { headers: CORS_HEADER, body: { data: [] } }
        }
        const products = await ctx.ports.shopifyResources.charmProducts(request.context, ids)
        return { headers: CORS_HEADER, body: { data: products } }
      }

      // upload-image and upload-svg both push raw files to Shopify Files — no AI involved. The proxy
      // boundary already normalized the multipart `files` into upload entries on the body, so this
      // mirrors the admin `/files/upload` route's port call exactly.
      if (action === 'upload-image' || action === 'upload-svg') {
        const files = parseUploadFiles(request.body)
        if (!files.length) {
          return { status: 400, headers: CORS_HEADER, body: { success: false, message: 'No files were uploaded' } }
        }
        const data = await ctx.ports.shopifyResources.uploadFiles(request.context, files, {
          shopDomain: request.context.shopDomain,
        })
        return { headers: CORS_HEADER, body: { success: true, data } }
      }

      if (action === 'track-event') {
        const { eventName, properties } = parseTrackEvent(request.body)
        if (!eventName) {
          return { status: 400, headers: CORS_HEADER, body: { success: false, message: 'eventName is required' } }
        }
        await ctx.ports.tracking.track(request.context, eventName, properties)
        return { headers: CORS_HEADER, body: { success: true, message: 'Event tracked successfully' } }
      }

      // Storefront caches this to gate AI UI; it already defaults to "available" when the call fails.
      // App-platform exposes no storefront credit-balance read yet, so report available (fail-open) to
      // preserve the upstream default rather than block AI UI on a value we cannot authoritatively read.
      if (action === 'check-ai-credits-status') {
        return { headers: CORS_HEADER, body: { success: true, aiCreditsAvailable: true } }
      }

      if (PENDING_AI_ACTIONS.has(action)) {
        return {
          status: 503,
          headers: CORS_HEADER,
          body: { success: false, message: `TailorKit storefront action not available yet: ${action}` },
        }
      }

      return {
        status: 400,
        headers: CORS_HEADER,
        body: { success: false, message: `Unsupported TailorKit storefront action: ${action}` },
      }
    },
  })
}
