import type { AppBackendPorts, AppContext } from '../../../../web/server/src/app-platform/contracts'
import { getValidPropertyNamePrefix, isOneTickProperty, TAILORKIT_PROPERTY_PREFIX } from '../domain/order-property-matchers'
import type { TailorKitOrderCustomerSnapshot, TailorKitOrderRecord } from '../domain/order-record'
import { createTailorKitOrderRepository } from './order-repository'
import { createGraftedGeneratePrintImage, createImportOrderAndCustomer } from './order-capture-graft'

export interface ExchangeRateToUSD {
  [key: string]: {
    value: number
    code: string
  }
}

export interface OrderCaptureRunnerOptions {
  rates?: ExchangeRateToUSD | null
  printImageEnabled?: boolean
}

export interface OrderCaptureRunner {
  (payload: unknown, webhook?: string): Promise<void>
}

interface OrderQuery {
  id?: string | number
  shopDomain?: string
}

function throwOutOfScope(message: string): never {
  throw new Error(message)
}

function toStoredOrder(shopDomain: string, id: string, value: Record<string, unknown>): TailorKitOrderRecord {
  return {
    ...value,
    id,
    shopDomain,
    line_items: Array.isArray(value.line_items) ? value.line_items : [],
  } as TailorKitOrderRecord
}

function toOrderDocument(record: TailorKitOrderRecord | null) {
  if (!record) return null
  return {
    ...record,
    _id: record.id,
    toObject: () => ({ ...record }),
  }
}

function mergeOrderUpdate(update: unknown): Record<string, unknown> {
  return update && typeof update === 'object' ? { ...(update as Record<string, unknown>) } : {}
}

// Copied pure math from web/server/src/modules/ai-sales-page/utils/currency-exchange.ts.
function convertTotalSalesToUSD(currency: string, totalSales: number, exchangeRatesToUSD: ExchangeRateToUSD | null): number {
  if (!exchangeRatesToUSD || currency === 'USD') {
    return totalSales
  }

  const exchangeRate = exchangeRatesToUSD[currency]?.value || 1
  const convertedAmount = totalSales / exchangeRate

  return Math.max(Number(convertedAmount.toFixed(4)), 0.001)
}

// Copied pure math from web/server/src/modules/ai-sales-page/utils/currency-exchange.ts.
function convertUSDToShopCurrency(
  amountUSD: number,
  shopCurrency: string,
  rates: ExchangeRateToUSD | null
): { amount: number; currency: string } {
  if (!rates || shopCurrency === 'USD' || !rates[shopCurrency]) {
    return { amount: amountUSD, currency: 'USD' }
  }
  const rate = rates[shopCurrency].value
  return {
    amount: Math.round(amountUSD * rate * 100) / 100,
    currency: shopCurrency,
  }
}

/**
 * The graft (`order-capture-graft.ts`, byte-identical to upstream) always resolves the order's
 * `customer` field to a bare Mongo id string (`c`) before calling `Order.updateOne`/`findOneAndUpdate`,
 * discarding the customer object it just passed to `Customer.updateOne` a few lines earlier. Since the
 * graft body must stay untouched, this shim substitutes that id string back out for the full customer
 * snapshot `createCustomerModel` captured for the same capture run, so the stored order record — and the
 * copied CustomerCard reading `order.customer.{first_name,last_name,email,phone,default_address}` — sees
 * real customer data instead of `undefined`/an opaque id.
 */
function createOrderModel(
  ports: AppBackendPorts,
  ctx: AppContext,
  getCustomerSnapshot: () => TailorKitOrderCustomerSnapshot | null
) {
  const repository = createTailorKitOrderRepository(ports, ctx)

  function withCustomerSnapshot(update: Record<string, unknown>): Record<string, unknown> {
    if (!('customer' in update)) return update
    const snapshot = getCustomerSnapshot()
    return snapshot ? { ...update, customer: snapshot } : update
  }

  return {
    async findOne(query: OrderQuery) {
      const id = String(query.id ?? '')
      return toOrderDocument(await repository.getById(id))
    },
    async updateOne(query: OrderQuery, update: unknown, options?: { upsert?: boolean }) {
      const id = String(query.id ?? '')
      const existing = await repository.getById(id)
      if (!existing && !options?.upsert) return { matchedCount: 0 }
      const next = toStoredOrder(ctx.shopDomain, id, {
        ...(existing || {}),
        ...withCustomerSnapshot(mergeOrderUpdate(update)),
      })
      await repository.upsert(next)
      return { matchedCount: existing ? 1 : 0, upsertedId: existing ? undefined : id }
    },
    async findOneAndUpdate(query: OrderQuery, update: unknown, options?: { upsert?: boolean }) {
      const id = String(query.id ?? '')
      const existing = await repository.getById(id)
      if (!existing && !options?.upsert) return null
      const next = toStoredOrder(ctx.shopDomain, id, {
        ...(existing || {}),
        ...withCustomerSnapshot(mergeOrderUpdate(update)),
      })
      await repository.upsert(next)
      return toOrderDocument(next)
    },
    aggregate() {
      return { exec: async () => throwOutOfScope('analytics-out-of-scope') }
    },
    countDocuments() {
      return throwOutOfScope('analytics-out-of-scope')
    },
  }
}

function asAddress(value: unknown): TailorKitOrderCustomerSnapshot['default_address'] {
  return value && typeof value === 'object' ? (value as TailorKitOrderCustomerSnapshot['default_address']) : undefined
}

/**
 * Mirrors the graft's `Customer.updateOne({ shopDomain, id: customerId }, customerData, { upsert: true })`
 * call. The graft only uses the resolved Mongo id (`c`) afterwards, so this captures the customer object
 * passed in `customerData` as `lastSnapshot` for `createOrderModel` to re-attach to the order record.
 */
function createCustomerModel() {
  let lastSnapshot: TailorKitOrderCustomerSnapshot | null = null

  return {
    model: {
      async updateOne(query: { id?: string | number }, update: unknown, options?: { upsert?: boolean }) {
        const data = update && typeof update === 'object' ? (update as Record<string, unknown>) : {}
        lastSnapshot = {
          id: typeof query.id === 'number' ? query.id : Number(query.id) || undefined,
          email: typeof data.email === 'string' ? data.email : undefined,
          first_name: typeof data.first_name === 'string' ? data.first_name : undefined,
          last_name: typeof data.last_name === 'string' ? data.last_name : undefined,
          phone: typeof data.phone === 'string' ? data.phone : undefined,
          default_address: asAddress(data.default_address),
        }
        return { upsertedId: options?.upsert ? String(query.id ?? 'customer') : undefined }
      },
      async findOne(query: { id?: string | number }) {
        const id = String(query.id ?? 'customer')
        return { _id: id, id }
      },
    },
    getLastSnapshot: () => lastSnapshot,
  }
}

function createDisabledPrintImage() {
  return async () => null
}

export function createOrderCaptureRunner(
  ports: AppBackendPorts,
  ctx: AppContext,
  deps: OrderCaptureRunnerOptions = {}
): OrderCaptureRunner {
  const printImageEnabled = deps.printImageEnabled === true
  const rates = deps.rates ?? null
  const api = {}

  const realGeneratePrintImage = createGraftedGeneratePrintImage({
    acquireBrowser: async () => throwOutOfScope('print-image-browser-out-of-scope'),
    releaseBrowser: async () => undefined,
    postSlackMessage: async () => throwOutOfScope('not-wired-yet'),
    APP_URL: process.env.SHOPIFY_APP_URL || process.env.HOST,
    PRINT_IMAGE_TIMEOUT_MULTIPLIER: 120,
    THIRTY_SECONDS: 30000,
    PRINT_IMAGE_FAILURE_SLACK_CHANNEL: 'U03TPREDM1S',
  })

  const customerModel = createCustomerModel()

  const importOrderAndCustomer = createImportOrderAndCustomer({
    Order: createOrderModel(ports, ctx, customerModel.getLastSnapshot),
    Customer: customerModel.model,
    Shop: { updateOne: async () => throwOutOfScope('not-wired-yet') },
    PrintArea: { findOne: async () => throwOutOfScope('print-image-out-of-scope') },
    ShopifySession: { findOne: async () => throwOutOfScope('print-image-out-of-scope') },
    ProviderIntegration: { findOne: async () => throwOutOfScope('fulfillment-out-of-scope') },
    Provider: { findOne: async () => throwOutOfScope('fulfillment-out-of-scope') },
    hasRequiredScopes: () => true,
    async getShopData() {
      const shopContext = await ports.shopContext.getSafeContext(ctx, ['localization', 'identity', 'plan'])
      return {
        shopDomain: shopContext.identity.shopDomain,
        shopConfig: { currency: shopContext.localization.currency },
        appConfig: { occurredEvents: {}, requiredFulfillmentServices: {} },
        usages: {},
        createdAt: new Date(),
        subscription: { trialActive: shopContext.plan.trialActive },
      }
    },
    getValidPropertyNamePrefix,
    isOneTickProperty,
    convertCurrencyToDollar: (currency, amount) => convertTotalSalesToUSD(currency, amount, rates),
    convertDollarToCurrency: (currency, amount) => convertUSDToShopCurrency(amount, currency, rates).amount,
    generatePrintImage: printImageEnabled ? realGeneratePrintImage : createDisabledPrintImage(),
    dataURLtoFile: () => throwOutOfScope('print-image-out-of-scope'),
    uploadPrintImagesToS3: async () => throwOutOfScope('print-image-out-of-scope'),
    uploadFilesWithAccessToken: async () => throwOutOfScope('print-image-out-of-scope'),
    getFulfillmentServiceName: () => throwOutOfScope('fulfillment-out-of-scope'),
    verifyResponse: () => throwOutOfScope('fulfillment-out-of-scope'),
    requestGraphqlApi: () => throwOutOfScope('fulfillment-out-of-scope'),
    queryForProductVariantMetafields: () => throwOutOfScope('fulfillment-out-of-scope'),
    convertIdsToQuery: () => throwOutOfScope('fulfillment-out-of-scope'),
    isJSON: value => {
      try {
        JSON.parse(value)
        return true
      } catch {
        return false
      }
    },
    getProviderOrNull: () => throwOutOfScope('fulfillment-out-of-scope'),
    getOriginalSrc: () => throwOutOfScope('fulfillment-out-of-scope'),
    fulfillFulfillmentServiceLineItems: () => throwOutOfScope('fulfillment-out-of-scope'),
    FULFILLED: 'fulfilled',
    FULFILLMENT_PROVIDERS: [],
    PREFIX_VARIANT_ID: 'gid://shopify/ProductVariant/',
    PROPERTY_PREFIX: TAILORKIT_PROPERTY_PREFIX,
  })

  return async (payload: unknown, webhook?: string) => {
    await importOrderAndCustomer(api, payload, ctx.shopDomain, webhook)
  }
}
