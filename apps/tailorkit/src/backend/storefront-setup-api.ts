// Sales Tools (/storefront-setup) backend routes for the two NEW endpoints the copied tabs call. Every
// /api/* the copied UI hits must resolve through the bridge AND have a backend route, or the island throws
// "Unsupported endpoint" at runtime (the Orders lesson). These two routes acknowledge with the
// contract-shaped success the UI consumes; the DEEP Shopify side-effects are deferred (see TODO(host-port)).
import type { AppApiRequest, AppBackendRegisterContext } from '../../../../web/server/src/app-platform/contracts'
import { TAILORKIT_CAPABILITIES } from '../domain/capabilities'

const OPTION_PRICING_ENSURE_ACTION = 'ENSURE_PRICING_PRODUCT'
const MAX_AVERAGE_PRICE = 1_000_000
const MAX_EMOJIS_LENGTH = 2000
const MAX_FONT_FIELD_LENGTH = 2048

function bodyObject(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {}
}

function isValidAveragePrice(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= MAX_AVERAGE_PRICE
}

function isFontShape(value: unknown): value is { family: string; src: string } {
  if (!value || typeof value !== 'object') return false
  const family = (value as { family?: unknown }).family
  const src = (value as { src?: unknown }).src
  if (typeof family !== 'string' || typeof src !== 'string') return false
  if (family.length === 0 || family.length > MAX_FONT_FIELD_LENGTH) return false
  return src.startsWith('https://') && src.length <= MAX_FONT_FIELD_LENGTH
}

export function registerTailorKitStorefrontSetupApi(ctx: AppBackendRegisterContext): void {
  /**
   * POST /emoji-picker/apply-to-all
   *
   * Sales Tools Storefront-tab EmojiPickerCard "apply emojis to all text layers".
   *
   * Validates the upstream body shape ({ emojis, font? }) and acknowledges with the
   * { success, matched, modified } envelope the card reads. The deep apply is deferred.
   * TODO(host-port): the upstream route does `Layer.updateMany` across every text layer in a Mongo `Layer`
   * collection. PageFly stores personalization as the per-integration `editorPayload` blob and has no Layer
   * store; applying the master emoji set storefront-wide needs a host port. Until then we acknowledge with
   * modified:0 so the screen is usable and never errors.
   */
  ctx.api.route({
    method: 'POST',
    path: '/emoji-picker/apply-to-all',
    capability: TAILORKIT_CAPABILITIES.writePersonalizedProducts,
    handler(request: AppApiRequest) {
      const body = bodyObject(request.body)
      const rawEmojis = typeof body.emojis === 'string' ? body.emojis : ''

      if (rawEmojis.length > MAX_EMOJIS_LENGTH) {
        return { status: 400, body: { success: false, error: 'Emoji string too long' } }
      }
      // font is validated for shape parity with upstream; unused until the host-port apply lands.
      void isFontShape(body.font)

      return { body: { success: true, matched: 0, modified: 0 } }
    },
  })

  /**
   * POST /option-pricing
   *
   * Sales Tools Storefront-tab InstallAppEmbedActivator ENSURE_PRICING_PRODUCT (the Upsell tab that also
   * called this was dropped — OneTick; the Storefront tab's app-embed activator still fires it on mount).
   *
   * Validates the body ({ action, averagePrice? }) and acknowledges with { success, productId, message }.
   * TODO(host-port): the upstream route creates a hidden Shopify product (productCreate +
   * productVariantsBulkCreate + publishablePublish across all publications, currency-aware unit price).
   * ShopifyResourcePort exposes only read/duplicate/upload — no create/publish — and apps may not issue raw
   * Shopify GraphQL. Real creation needs a host ShopifyResourcePort.createHiddenProduct capability. Until
   * then we acknowledge (productId:null) so the screen is usable and never errors.
   */
  ctx.api.route({
    method: 'POST',
    path: '/option-pricing',
    capability: TAILORKIT_CAPABILITIES.writePersonalizedProducts,
    handler(request: AppApiRequest) {
      const body = bodyObject(request.body)

      if (body.action !== OPTION_PRICING_ENSURE_ACTION) {
        return { status: 400, body: { success: false, message: 'Unsupported option-pricing action' } }
      }
      if (body.averagePrice !== undefined && !isValidAveragePrice(body.averagePrice)) {
        return { status: 400, body: { success: false, message: 'Invalid average price' } }
      }

      return { body: { success: true, productId: null, message: 'Option pricing acknowledged' } }
    },
  })
}
