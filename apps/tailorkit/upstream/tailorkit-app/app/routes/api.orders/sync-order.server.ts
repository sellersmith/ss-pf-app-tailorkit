import { SHOPIFY_API_VERSION, SHOPIFY_ORDER_PREFIX } from '~/constants/shopify'
import Order from '~/models/Order.server'
import ShopifySession from '~/models/ShopifySession.server'
import type { ShopifyApiClient } from '~/shopify/graphql/api.server'
import { importOrderAndCustomer } from '../webhooks/fns.server'
import { RateLimiter } from '~/services/mcp/rate-limit.server'
import { parseOrderInput } from './parse-order-input'

// Rate limiter: 5 sync requests per minute per shop
const syncRateLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 5,
  cleanupIntervalMs: 5 * 60 * 1000,
  maxCacheSize: 10000,
})

const SEARCH_ORDER_BY_NAME_QUERY = `#graphql
  query searchOrderByName($query: String!) {
    orders(first: 2, query: $query) {
      nodes {
        id
        name
        legacyResourceId
      }
    }
  }
`

/**
 * Resolve an order name (e.g. "#1719") to a Shopify numeric order ID
 * using the Shopify Admin GraphQL API.
 */
async function resolveOrderIdByName(
  api: ShopifyApiClient,
  orderName: string
): Promise<{ success: boolean; orderId?: string; message?: string }> {
  try {
    const response = await api.graphql(SEARCH_ORDER_BY_NAME_QUERY, {
      variables: { query: `name:${orderName}` },
    })

    const data = response?.data ?? (await response?.json?.())?.data
    const nodes = data?.orders?.nodes

    if (!nodes?.length) {
      return { success: false, message: `Order "${orderName}" not found on Shopify. Please verify the order number.` }
    }

    if (nodes.length > 1) {
      return {
        success: false,
        message: `Multiple orders found for "${orderName}". Please use the full Shopify order ID instead.`,
      }
    }

    const orderId = nodes[0].legacyResourceId
    if (!orderId) {
      return {
        success: false,
        message: `Could not resolve order "${orderName}". Please use the full Shopify order ID instead.`,
      }
    }

    return { success: true, orderId }
  } catch {
    return { success: false, message: 'Failed to look up order by name. Please try the full Shopify order ID instead.' }
  }
}

/**
 * Sync a single order from Shopify into the app database.
 * Accepts either a Shopify numeric order ID (e.g. "5551234567890")
 * or an order name/number (e.g. "#1719" or "1719").
 *
 * Fetches the order via Shopify REST API (same format as webhook payloads)
 * then processes it through the existing `importOrderAndCustomer` flow.
 */
export async function syncOrderFromShopify(args: {
  shopifyOrderId: string
  shopDomain: string
  api: ShopifyApiClient
}): Promise<{ success: boolean; message: string; orderId?: number }> {
  const { shopifyOrderId, shopDomain, api } = args

  // --- Parse input ---
  const parsed = parseOrderInput(shopifyOrderId)

  if (!parsed) {
    return {
      success: false,
      message: 'Please enter a valid Shopify order ID (e.g. 5551234567890) or order number (e.g. #1719).',
    }
  }

  // --- Rate limiting ---
  const { limited } = syncRateLimiter.check(`sync:${shopDomain}`)

  if (limited) {
    return { success: false, message: 'Too many sync requests. Please wait a minute before trying again.' }
  }

  // --- Resolve order name to numeric ID if needed ---
  let numericOrderId: string

  if (parsed.type === 'order_name') {
    const resolved = await resolveOrderIdByName(api, parsed.value)

    if (!resolved.success || !resolved.orderId) {
      return { success: false, message: resolved.message! }
    }

    numericOrderId = resolved.orderId
  } else {
    numericOrderId = parsed.value
  }

  // --- Check if order already exists ---
  const existingOrder = await Order.findOne({ shopDomain, id: Number(numericOrderId) })

  if (
    existingOrder
    && existingOrder.line_items?.some((li: { print_images?: { length: number }[] }) => li.print_images?.length)
  ) {
    return { success: false, message: 'This order has already been synced and has print images.' }
  }

  // If order exists but without print images (e.g., generation failed), delete it
  // so importOrderAndCustomer treats it as new and regenerates print images
  if (existingOrder) {
    await Order.deleteOne({ shopDomain, id: Number(numericOrderId) })
  }

  // --- Fetch order from Shopify REST API (same format as webhook payloads) ---
  const session = await ShopifySession.findOne({ shop: shopDomain })

  if (!session?.accessToken) {
    return { success: false, message: 'Unable to authenticate with Shopify. Please try again.' }
  }

  const restUrl = `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/orders/${numericOrderId}.json`

  let orderPayload: any

  try {
    const response = await fetch(restUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': session.accessToken,
      },
    })

    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, message: 'Order not found on Shopify. Please verify the order ID.' }
      }
      if (response.status === 429) {
        return { success: false, message: 'Shopify rate limit reached. Please wait a moment and try again.' }
      }
      return { success: false, message: `Shopify API error (${response.status}). Please try again.` }
    }

    const data = await response.json()
    orderPayload = data?.order
  } catch {
    return { success: false, message: 'Failed to fetch order from Shopify. Please try again.' }
  }

  if (!orderPayload) {
    return { success: false, message: 'Order not found on Shopify. Please verify the order ID.' }
  }

  // Ensure admin_graphql_api_id is set (needed by importOrderAndCustomer)
  if (!orderPayload.admin_graphql_api_id) {
    orderPayload.admin_graphql_api_id = `${SHOPIFY_ORDER_PREFIX}${numericOrderId}`
  }

  // --- Run through the same flow as webhook ---
  console.log(`[SyncOrder] Starting sync for order ${numericOrderId} on shop ${shopDomain}`)
  await importOrderAndCustomer(api, orderPayload, shopDomain, 'ORDERS_CREATE')

  // Verify the order was actually imported (importOrderAndCustomer swallows errors)
  const syncedOrder = await Order.findOne({ shopDomain, id: Number(numericOrderId) })

  if (!syncedOrder || !syncedOrder.line_items?.length) {
    console.error(`[SyncOrder] Verification failed for order ${numericOrderId} on shop ${shopDomain}`)
    return {
      success: false,
      message:
        'Order was fetched from Shopify but failed to process. Please check if the order contains TailorKit items.',
    }
  }

  console.log(`[SyncOrder] Completed sync for order ${numericOrderId} on shop ${shopDomain}`)

  return {
    success: true,
    message: 'Order synced successfully',
    orderId: Number(numericOrderId),
  }
}
