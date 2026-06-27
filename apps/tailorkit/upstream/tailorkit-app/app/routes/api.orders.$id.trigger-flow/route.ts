import type { ActionFunctionArgs } from '@remix-run/node'
import { authenticate } from '~/shopify/app.server'
import Order from '~/models/Order.server'
import { ShopifyApiClient } from '~/shopify/graphql/api.server'
import { json } from '~/bootstrap/fns/fetch.server'

/**
 * Shopify Flow maximum payload size limit (50KB)
 * @see https://shopify.dev/docs/apps/build/flow/triggers/reference
 */
const SHOPIFY_FLOW_MAX_PAYLOAD_SIZE = 50000

/**
 * Print image interface matching the Order schema
 */
interface PrintImage {
  printAreaId?: string
  printAreaName?: string
  image?: {
    originalSrc?: string
    url?: string
    width?: number
    height?: number
  }
}

/**
 * Line item interface matching the Order schema
 */
interface LineItem {
  id: number
  print_images?: PrintImage[]
  [key: string]: unknown
}

/**
 * Order document interface for database queries
 */
interface OrderDocument {
  id: number
  name?: string
  order_number?: number
  created_at?: string
  total_price?: string
  currency?: string
  financial_status?: string
  fulfillment_status?: string
  shopDomain?: string
  line_items?: LineItem[]
  customer?: {
    id?: string | number
    email?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

/**
 * Shopify Flow trigger payload interface
 * All fields must be strings for Flow triggers
 */
interface FlowTriggerPayload extends Record<string, string | number> {
  order_id: number
  'Order Number': string
  'Order Name': string
  'Created At': string
  'Total Price': string
  Currency: string
  'Financial Status': string
  'Fulfillment Status': string
  'Customer ID': string
  'Customer Email': string
  'Admin URL': string
  'Print Files': string
  'Print Files Count': string
}

/**
 * Shopify Flow API user error interface
 */
interface FlowUserError {
  field: string[] | null
  message: string
}

/**
 * Shopify Flow trigger response interface
 */
interface FlowTriggerResponse {
  userErrors?: FlowUserError[]
}

/**
 * Manual trigger for Shopify Flow - sends order data to Flow
 * User clicks button in Order Details to trigger this
 */
export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request)
  const orderId = params.id

  if (!orderId) {
    return json({ success: false, error: 'Order ID is required' })
  }

  if (!session?.shop) {
    return json({ success: false, error: 'Authentication failed - no shop in session' })
  }

  try {
    // Get order from database
    const orderDoc = await Order.findOne({ id: orderId }).lean()

    if (!orderDoc) {
      return json({ success: false, error: 'Order not found' })
    }

    // Type assertion for order document - use unknown first to safely cast
    const order = orderDoc as unknown as OrderDocument

    // Check if order has print images
    const lineItemsWithPrintImages
      = order.line_items?.filter((item: LineItem) => item.print_images && item.print_images.length > 0) || []

    if (lineItemsWithPrintImages.length === 0) {
      return json({ success: false, error: 'No print images found for this order' })
    }

    // Build comprehensive order payload
    // Format for print files: "PrintAreaName1|URL1;;PrintAreaName2|URL2"
    const printFileDetails: string[] = []

    for (const lineItem of lineItemsWithPrintImages) {
      if (lineItem.print_images && lineItem.print_images.length > 0) {
        lineItem.print_images.forEach((pi: PrintImage) => {
          const imageUrl = pi.image?.originalSrc || pi.image?.url
          const printAreaName = pi.printAreaName || 'Unknown Print Area'

          if (imageUrl) {
            printFileDetails.push(`${printAreaName}|${imageUrl}`)
          }
        })
      }
    }

    const shopDomain = order.shopDomain || session.shop || ''
    const customer = order.customer || {}

    // Build comprehensive payload - ALL fields must be strings for Flow triggers
    const payload: FlowTriggerPayload = {
      // Reference field - Shopify Flow expects numeric order ID (legacyResourceId), NOT GID string
      // See: https://shopify.dev/docs/apps/build/flow/triggers/reference
      order_id: Number(order.id),

      // Basic order info
      'Order Number': String(order.order_number || order.name || ''),
      'Order Name': String(order.name || ''),
      'Created At': String(order.created_at || ''),

      // Financial info
      'Total Price': String(order.total_price || 0),
      Currency: String(order.currency || 'USD'),
      'Financial Status': String(order.financial_status || ''),
      'Fulfillment Status': String(order.fulfillment_status || 'unfulfilled'),

      // Customer info
      'Customer ID': String(customer.id || ''),
      'Customer Email': String(customer.email || ''),

      // URLs and references
      'Admin URL': `https://${shopDomain}/admin/orders/${order.id}`,

      // Print files with details: "PrintAreaName1|URL1;;PrintAreaName2|URL2"
      // Can be split by ";;" to get each print file, then split by "|" to get name and URL
      'Print Files': printFileDetails.join(';;'),
      'Print Files Count': String(printFileDetails.length),
    }

    // Validate payload size before triggering Flow
    const payloadJson = JSON.stringify(payload)
    const payloadSize = new Blob([payloadJson]).size

    // Hard limit: 50KB (Shopify Flow will reject)
    if (payloadSize > SHOPIFY_FLOW_MAX_PAYLOAD_SIZE) {
      return json({
        success: false,
        error: `Payload size ${payloadSize} bytes exceeds Shopify Flow 50KB limit.`,
      })
    }

    // Trigger Shopify Flow
    const api = new ShopifyApiClient(admin)
    const response: FlowTriggerResponse = await api.triggerShopifyFlow('tlk-order-processed', payload)

    // Check for user errors in the response
    if (response?.userErrors && response.userErrors.length > 0) {
      const errorMessages = response.userErrors.map((e: FlowUserError) => e.message).join(', ')
      return json({
        success: false,
        error: `Flow trigger failed with errors: ${errorMessages}`,
      })
    }

    return json({
      success: true,
      message: 'Flow triggered successfully',
      warning:
        'Make sure you have Shopify Flow app installed and a workflow listening to "tlk-order-processed" trigger',
      data: {
        orderId: order.id,
        printImageCount: printFileDetails.length,
        payloadSize,
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return json(
      {
        success: false,
        error: `Failed to trigger flow: ${errorMessage}`,
      },
      { status: 500 }
    )
  }
}
