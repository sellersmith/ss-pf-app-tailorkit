// Registers the TailorKit `orders/create` webhook-intent hook. The host webhook ingress matches a
// delivery's `x-shopify-topic` header against `hook.name`, so the name MUST equal the Shopify topic
// `orders/create`. On delivery the hook runs the grafted capture (verbatim upstream importOrderAndCustomer
// behind the shim) which filters TailorKit line items, computes app-generated revenue, and upserts the
// order into scoped app-data.
//
// Exchange rates: the capture body converts revenue to USD + shop currency, which needs currencyapi.com
// rates from Redis — unreachable from an app package (import boundary). The GAP-1 host caller
// (`order-capture-dispatch.ts`, in web/server) resolves the rates and threads them through the delivery
// payload under `_pfExchangeRates`. This hook peels that off and passes it to the runner; the remaining
// payload is the raw Shopify order the grafted body reads. (Rates absent → conversion falls back to the
// raw amount, matching the upstream "rates null" branch.)
import type {
  AppBackendRegisterContext,
  AppHookExecutionResult,
} from '../../../../web/server/src/app-platform/contracts'
import { TAILORKIT_CAPABILITIES } from '../domain/capabilities'
import { createOrderCaptureRunner, type ExchangeRateToUSD } from './order-capture-shim'

export const TAILORKIT_ORDERS_CREATE_TOPIC = 'orders/create'

/** Envelope the GAP-1 caller wraps the order payload in to carry host-resolved exchange rates. */
interface OrderCaptureDeliveryEnvelope {
  order: unknown
  _pfExchangeRates?: ExchangeRateToUSD | null
}

function unwrapDelivery(payload: unknown): { order: unknown; rates: ExchangeRateToUSD | null } {
  if (payload && typeof payload === 'object' && 'order' in payload) {
    const envelope = payload as OrderCaptureDeliveryEnvelope
    return { order: envelope.order, rates: envelope._pfExchangeRates ?? null }
  }
  // Raw order payload (no envelope) — rates unavailable, conversion falls back to raw amount.
  return { order: payload, rates: null }
}

export function registerTailorKitOrderWebhookIntent(ctx: AppBackendRegisterContext) {
  ctx.hooks.webhookIntent({
    name: TAILORKIT_ORDERS_CREATE_TOPIC,
    capability: TAILORKIT_CAPABILITIES.captureOrders,
    timeoutMs: 15000,
    retryPolicy: { maxAttempts: 3 },
    async handler({ context, payload }): Promise<AppHookExecutionResult> {
      const { order, rates } = unwrapDelivery(payload)
      const runner = createOrderCaptureRunner(ctx.ports, context, { rates, printImageEnabled: false })
      await runner(order, 'ORDERS_CREATE')
      return { status: 'completed' }
    },
  })
}
