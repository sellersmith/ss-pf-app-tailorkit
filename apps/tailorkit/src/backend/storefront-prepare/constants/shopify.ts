/// <reference lib="dom" />
import type { ShopifyGlobal } from '@shopify/app-bridge-types'

export const SHOPIFY_API_VERSION = '2025-10'
export const PREFIX_PRODUCT_ID = 'gid://shopify/Product/'
export const PREFIX_VARIANT_ID = 'gid://shopify/ProductVariant/'
export const SHOPIFY_METAFIELD_ID_PREFIX = 'gid://shopify/Metafield/'
export const SHOPIFY_MEDIA_ID_PREFIX = 'gid://shopify/MediaImage/'
export const SHOPIFY_ORDER_PREFIX = 'gid://shopify/Order/'
export const SHOPIFY_FULFILLMENT_ORDER_PREFIX = 'gid://shopify/FulfillmentOrder/'
export const TAILORKIT_SHOPIFY_FILE_PREFIX = 'TailorKit-DO_NO_DELETE'
export const ONLINE_STORE = 'Online Store'

// The app subscription bills the shop every 30 days.
export const THIRTY_DAYS_BILLING_CYCLE_INTERVAL = 30

/**
 * @description The topics that can be used to create webhooks.
 * @see https://shopify.dev/docs/api/admin-graphql/2025-10/enums/WebhookSubscriptionTopic
 */
export enum WEBHOOK_TOPICS {
  APP_UNINSTALLED = 'APP_UNINSTALLED',
  SHOP_UPDATE = 'SHOP_UPDATE',
  ORDERS_CREATE = 'ORDERS_CREATE',
  ORDERS_UPDATED = 'ORDERS_UPDATED',
  ORDERS_DELETE = 'ORDERS_DELETE',
  ORDERS_CANCELLED = 'ORDERS_CANCELLED',
  FULFILLMENT_ORDERS_FULFILLMENT_REQUEST_SUBMITTED = 'FULFILLMENT_ORDERS_FULFILLMENT_REQUEST_SUBMITTED',
  FULFILLMENT_ORDERS_FULFILLMENT_REQUEST_REJECTED = 'FULFILLMENT_ORDERS_FULFILLMENT_REQUEST_REJECTED',
  FULFILLMENT_ORDERS_FULFILLMENT_REQUEST_ACCEPTED = 'FULFILLMENT_ORDERS_FULFILLMENT_REQUEST_ACCEPTED',
  FULFILLMENT_ORDERS_CANCELLATION_REQUEST_SUBMITTED = 'FULFILLMENT_ORDERS_CANCELLATION_REQUEST_SUBMITTED',
  FULFILLMENT_ORDERS_CANCELLATION_REQUEST_ACCEPTED = 'FULFILLMENT_ORDERS_CANCELLATION_REQUEST_ACCEPTED',
  FULFILLMENT_ORDERS_CANCELLATION_REQUEST_REJECTED = 'FULFILLMENT_ORDERS_CANCELLATION_REQUEST_REJECTED',
  APP_SUBSCRIPTIONS_APPROACHING_CAPPED_AMOUNT = 'APP_SUBSCRIPTIONS_APPROACHING_CAPPED_AMOUNT',
  APP_SUBSCRIPTIONS_UPDATE = 'APP_SUBSCRIPTIONS_UPDATE',
  PRODUCTS_UPDATE = 'PRODUCTS_UPDATE',
}

export enum ORDER_WEBHOOK_TOPICS {
  ORDERS_CREATE = 'ORDERS_CREATE',
  ORDERS_UPDATED = 'ORDERS_UPDATED',
  ORDERS_DELETE = 'ORDERS_DELETE',
  ORDERS_CANCELLED = 'ORDERS_CANCELLED',
}

/**
 * @description The type of money in Shopify
 * @see https://shopify.dev/docs/api/admin-graphql/2025-10/scalars/Money
 */
export type Money = string

export const shopifyGlobal: ShopifyGlobal
  = typeof window !== 'undefined' ? window.opener?.shopify || window.shopify : null
export const isShopifyMobileApp = () => shopifyGlobal?.environment?.mobile || false
