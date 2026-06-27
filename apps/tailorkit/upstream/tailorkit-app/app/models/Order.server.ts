import mongoose from '~/bootstrap/db/connect-db.server'
import { EMPTY_ARRAY } from '~/constants'
import { AddressSchema } from '~/models/Customer.server'
import type { ShopDocument } from './Shop'
import { getShopData } from './Shop.server'
import { DisplayFulfillmentStatus } from '~/models/Order.d'
import { updateOrderCount } from './Subscription.server'

/**
 * The following schema is a reflection of the Shopify order data structure.
 *
 * @see https://shopify.dev/docs/api/admin-rest/2024-01/resources/webhook
 */
const PriceSetSchema = {
  shop_money: {
    amount: String,
    currency_code: String,
  },
  presentment_money: {
    amount: String,
    currency_code: String,
  },
}

const PrintImageSchema = {
  printAreaId: String,
  printAreaName: String,
  image: {
    originalSrc: String,
    width: Number,
    height: Number,
  },
  // SVG version of the print image (optional, for vector output)
  svg: {
    originalSrc: String,
  },
}

const FulfillmentOrderData = {
  provider_id: mongoose.SchemaTypes.Mixed,
  product_id: mongoose.SchemaTypes.Mixed,
  variant_id: mongoose.SchemaTypes.Mixed,
  // print_areas: [{front: "front_url"}, {back: "back_url"}]
  print_areas: mongoose.SchemaTypes.Mixed,
}

const FulfillmentOrderSubmitted = {
  shop_id: String,
  status: String,
  orderId: mongoose.SchemaTypes.Mixed,
}

export type LineItem = any

const OrderSchema = new mongoose.Schema(
  {
    admin_graphql_api_id: String,
    app_id: String,
    id: {
      type: Number,
      index: true,
    },
    buyer_accepts_marketing: Boolean,
    cancel_reason: String,
    cancelled_at: String,
    confirmed: Boolean,
    contact_email: String,
    created_at: String,
    currency: String,
    current_subtotal_price: String,
    current_subtotal_price_set: PriceSetSchema,
    current_total_additional_fees_set: PriceSetSchema,
    current_total_discounts: String,
    current_total_discounts_set: PriceSetSchema,
    current_total_duties_set: PriceSetSchema,
    current_total_price: String,
    current_total_price_set: PriceSetSchema,
    current_total_tax: String,
    current_total_tax_set: PriceSetSchema,
    customer_locale: String,
    discount_codes: mongoose.SchemaTypes.Mixed,
    displayFulfillmentStatus: {
      type: String,
      enum: DisplayFulfillmentStatus,
    },
    email: String,
    estimated_taxes: mongoose.SchemaTypes.Mixed,
    financial_status: {
      type: String,
      index: true,
    },
    fulfillment_status: {
      type: String,
      index: true,
    },
    name: {
      type: String,
      index: true,
    },
    note: mongoose.SchemaTypes.Mixed,
    note_attributes: mongoose.SchemaTypes.Mixed,
    number: Number,
    order_number: Number,
    order_status_url: String,
    original_total_additional_fees_set: PriceSetSchema,
    original_total_duties_set: PriceSetSchema,
    payment_gateway_names: mongoose.SchemaTypes.Mixed,
    phone: String,
    po_number: String,
    presentment_currency: String,
    processed_at: String,
    subtotal_price: String,
    subtotal_price_set: PriceSetSchema,
    tags: String,
    tax_exempt: Boolean,
    tax_lines: mongoose.SchemaTypes.Mixed,
    taxes_included: Boolean,
    test: Boolean,
    token: String,
    total_discounts: String,
    total_discounts_set: PriceSetSchema,
    total_line_items_price: String,
    total_line_items_price_set: PriceSetSchema,
    total_outstanding: String,
    total_price: String,
    total_price_set: PriceSetSchema,
    total_shipping_price_set: PriceSetSchema,
    total_tax: String,
    total_tax_set: PriceSetSchema,
    total_tip_received: String,
    total_weight: Number,
    updated_at: String,
    user_id: mongoose.SchemaTypes.Mixed,
    billing_address: AddressSchema,
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
    },
    discount_applications: mongoose.SchemaTypes.Mixed,
    fulfillments: mongoose.SchemaTypes.Mixed,
    fulfillmentOrders: { type: mongoose.SchemaTypes.Mixed, default: EMPTY_ARRAY },
    line_items: [
      {
        id: Number,
        // Fulfillment order submitted information
        fulfillment_order_submitted: FulfillmentOrderSubmitted,
        // Print images
        print_images: { type: [PrintImageSchema], default: EMPTY_ARRAY },
        // Fulfillment order data
        fulfillment_order_data: FulfillmentOrderData,
        admin_graphql_api_id: String,
        attributed_staffs: [
          {
            id: String,
            quantity: Number,
          },
        ],
        current_quantity: Number,
        fulfillable_quantity: Number,
        fulfillment_service: String,
        fulfillment_status: {
          type: String,
          default: 'unfulfilled',
        },
        gift_card: Boolean,
        grams: Number,
        name: String,
        price: String,
        price_set: PriceSetSchema,
        product_exists: Boolean,
        product_id: Number,
        properties: [
          {
            name: String,
            value: String,
          },
        ],
        quantity: Number,
        requires_shipping: Boolean,
        sku: String,
        taxable: Boolean,
        title: String,
        total_discount: String,
        total_discount_set: PriceSetSchema,
        variant_id: Number,
        variant_inventory_management: String,
        variant_title: String,
        vendor: String,
        tax_lines: mongoose.SchemaTypes.Mixed,
        duties: mongoose.SchemaTypes.Mixed,
        discount_allocations: mongoose.SchemaTypes.Mixed,
      },
    ],
    payment_terms: mongoose.SchemaTypes.Mixed,
    refunds: mongoose.SchemaTypes.Mixed,
    shipping_address: AddressSchema,
    shipping_lines: [
      {
        id: Number,
        carrier_identifier: mongoose.SchemaTypes.Mixed,
        code: mongoose.SchemaTypes.Mixed,
        discounted_price: String,
        discounted_price_set: PriceSetSchema,
        phone: String,
        price: String,
        price_set: PriceSetSchema,
        requested_fulfillment_service_id: mongoose.SchemaTypes.Mixed,
        source: String,
        title: String,
        tax_lines: mongoose.SchemaTypes.Mixed,
        discount_allocations: mongoose.SchemaTypes.Mixed,
      },
    ],
    // The shop domain that owns the order
    shopDomain: {
      type: String,
      index: true,
      required: true,
    },
    // The app-generated revenue for the order
    appGeneratedRevenue: {
      type: Number,
      index: true,
      default: 0,
    },
    // The app-generated revenue for the order in the order currency
    appGeneratedRevenueInOrderCurrency: {
      type: Number,
      index: true,
      default: 0,
    },
    // The app-generated revenue for the order in the shop currency
    appGeneratedRevenueInShopCurrency: {
      type: Number,
      index: true,
      default: 0,
    },
    /**
     * The time that order changes from other status to 'fulfilled'
     * By default, Shopify doesn't natively support this field,
     * the reason can come from a case that a order can have multiple type of products from multiple fulfillment and hard to control.
     * We update this field once order status changes to 'fulfilled' and different from above status.
     * This type field should be String instead of Date. Because mongodb has some problems when comparing date at 00:00:00:000
     */
    fulfilledAt: {
      type: String,
      index: true,
      default: null,
    },
    // Explicit boolean flag: true when the order contains at least one TailorKit-personalized
    // line item (detected by TK property prefix or OneTick property), regardless of price.
    // Replaces the `appGeneratedRevenue > 0` proxy which misses $0 TK products.
    isTailorKitOrder: {
      type: Boolean,
      index: true,
      default: false,
    },
  },
  {
    timestamps: true,
  }
)

// Compound indexes for analytics queries optimization
OrderSchema.index({ shopDomain: 1, created_at: 1 }) // Order count in billing cycle queries (uses Shopify created_at)
OrderSchema.index({ shopDomain: 1, financial_status: 1, created_at: 1 }) // Revenue calculations (paid orders only)
OrderSchema.index({ financial_status: 1, created_at: 1 }) // Global revenue analytics
OrderSchema.index({ shopDomain: 1, isTailorKitOrder: 1, created_at: 1 }) // TK order count per shop in date range

const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema)

export default Order

/**
 * Tracks order creation for billing purposes.
 *
 * Flow: ORDERS_CREATE webhook → updateOrderUsage() → updateOrderCount() (direct)
 *
 * Real-time Update (Webhook Path):
 * - Calls updateOrderCount() DIRECTLY to update shop.usages.orders immediately
 * - NEVER charges Shopify (charging happens separately via cron at 23:00)
 *
 * Daily Batch Charging (Cron Path - separate):
 * - Cron calls syncShopUsage() at 23:00 → submitDailyUsageCharge()
 * - Batches all overage orders from the day into ONE charge
 * - Follows Shopify recommendation to avoid "merchant shock"
 *
 * Single source of truth: Order.countDocuments() in billing cycle.
 *
 * @param shopDomain string
 * @param shopData null | ShopDocument
 */
export async function updateOrderUsage(shopDomain: string, shopData: null | ShopDocument = null) {
  shopData = shopData || (await getShopData(shopDomain))

  if (shopData) {
    // Real-time update ONLY (webhook path)
    // Updates shop.usages.orders immediately for progress bar
    // NEVER charges Shopify (charging happens via cron at 23:00)
    await updateOrderCount(shopDomain)
  }
}

/**
 * Get app-generated revenue from orders in the current billing cycle
 * The app-generated revenue is dollar-based
 *
 * @param shopDomain string
 * @param from Date
 * @param to Date
 * @returns number
 */
export async function getAppGeneratedRevenueInBillingCycle(shopDomain: string, from: Date, to: Date): Promise<number> {
  // Sum app-generated revenue from orders in the current billing cycle
  const orders = await Order.aggregate([
    {
      $match: {
        $and: [
          { shopDomain },
          // Only sum app-generated revenue for paid orders
          { financial_status: 'paid' },
          // Filter date range in billing cycle range
          { createdAt: { $lte: to } },
          { createdAt: { $gte: from } },
        ],
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$appGeneratedRevenue' },
      },
    },
  ])

  return orders[0]?.total || 0
}

/**
 * Get count of orders in a billing cycle for order-based pricing
 * Counts ALL orders created regardless of financial status
 *
 * @param shopDomain - Shop domain
 * @param from - Billing cycle start date
 * @param to - Billing cycle end date
 * @returns Number of orders created in the billing cycle
 */
export async function getOrderCountInBillingCycle(shopDomain: string, from: Date, to: Date): Promise<number> {
  // Ensure from and to are Date objects for proper MongoDB comparison
  const fromDate = from instanceof Date ? from : new Date(from)
  const toDate = to instanceof Date ? to : new Date(to)

  // Use aggregation pipeline to parse Shopify's created_at string (with timezone) to Date
  // CRITICAL: created_at is a string like "2026-02-08T23:23:09-05:00" (includes timezone)
  // Simple string comparison doesn't work because timezone offset makes lexicographic comparison wrong
  // Example: "2026-02-08T23:23:09-05:00" < "2026-02-09T04:00:00Z" lexicographically, but they're same time!
  const result = await Order.aggregate([
    {
      $match: {
        shopDomain,
        created_at: { $exists: true, $ne: null },
      },
    },
    {
      $addFields: {
        // Parse created_at string to Date object for proper temporal comparison
        created_at_date: { $dateFromString: { dateString: '$created_at' } },
      },
    },
    {
      $match: {
        created_at_date: {
          $gte: fromDate,
          $lte: toDate,
        },
      },
    },
    {
      $count: 'total',
    },
  ])

  return result.length > 0 ? result[0].total : 0
}
