import type { LoaderFunctionArgs } from '@remix-run/node'
import { randomUUID } from 'crypto'
import { format, addDays } from 'date-fns'
import fs from 'fs'
import path from 'path'
import { json } from '~/bootstrap/fns/fetch.server'
import Order from '~/models/Order.server'
import { authenticate } from '~/shopify/app.server'
import type { ExportOrderRecord } from '~/utils/csv'
import { ordersToCsv, ORDER_CSV_COLUMNS } from '~/utils/csv'
import { UNFULFILLED } from '~/constants/fulfillment-providers'
import { getFulfillmentStatus } from '../orders.$id/fns'
import { getMyShopifySubdomainName } from '~/shopify/fns'
import { postEventToCustomerIo } from '~/modules/customer.io/api.server'
import { CUSTOMERIO_EVENTS } from '~/modules/customer.io/constants'

/**
 * GET /api/orders/export?scope=[selected|search|all]&ids=1,2,3
 * Any other search params (financial_status, query, etc.) are respected.
 *
 * small set (<=51)  -> returns CSV download response
 * large set (>51)   -> saves to public/exports and returns JSON { url }
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const {
    session: { shop: shopDomain },
  } = await authenticate.admin(request)

  const url = new URL(request.url)
  const searchParams = url.searchParams
  const scope = searchParams.get('scope') || 'all'
  const idsParam = searchParams.get('ids')
  const ids = idsParam ? idsParam.split(',').map(id => Number(id)) : []

  // Build MongoDB query
  const query: any = { shopDomain }
  if ((scope === 'selected' || scope === 'page') && ids.length) {
    query.id = { $in: ids }
  } else if (scope === 'search') {
    // For now, reuse ids logic only; advanced search filters can be implemented later
    // TODO: apply filters from searchParams (financial_status, etc.)
  }

  // Count orders first to determine export strategy
  const EXPORT_LIMIT = 50
  const orderCount = await Order.countDocuments(query)
  const isLargeExport = orderCount > EXPORT_LIMIT

  // Columns selection (shared)
  const columnsParam = searchParams.get('columns')
  const selectedColumns = columnsParam ? (columnsParam.split(',') as (keyof ExportOrderRecord)[]) : undefined

  // Generate filename & ensure directory (shared)
  const dateStr = format(new Date(), 'yyyyMMdd')
  const fileName = `TLK_orders_export_${getMyShopifySubdomainName(shopDomain)}_${dateStr}_${randomUUID().split('-')[0]}.csv`
  const exportDir = path.resolve('public/exports')
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true })
  }
  const filePath = path.join(exportDir, fileName)

  if (isLargeExport) {
    // ---- STREAMING MODE ----
    // Helper to escape CSV field (duplicated to avoid importing non-exported util)
    const escapeCsvField = (value: unknown): string => {
      if (value === null || value === undefined) return ''
      const str = typeof value === 'object' ? JSON.stringify(value) : String(value)
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
    }

    const usedColumns = (selectedColumns || ORDER_CSV_COLUMNS.map(c => c.key)) as (keyof ExportOrderRecord)[]

    // Create write stream & header
    const fileStream = fs.createWriteStream(filePath)
    const headerRow = usedColumns.map(key => ORDER_CSV_COLUMNS.find(c => c.key === key)?.label || key).join(',')
    fileStream.write(`${headerRow}\n`)

    // Stream orders via cursor
    const cursor = Order.find(query).sort({ created_at: -1 }).lean().cursor()

    for await (const order of cursor) {
      const recs = extractRecordsFromOrder(order)
      for (const record of recs) {
        const row = usedColumns.map(col => escapeCsvField((record as any)[col])).join(',')
        fileStream.write(`${row}\n`)
      }
    }

    fileStream.end()
    await new Promise<void>(resolve => fileStream.on('finish', () => resolve()))

    // Notify via email
    const fileURL = `${process.env.SHOPIFY_APP_URL}/exports/${fileName}`
    const expiresAt = addDays(new Date(), 14).toISOString()

    postEventToCustomerIo({
      shopDomain,
      eventName: CUSTOMERIO_EVENTS.EXPORT_ORDERS,
      eventData: { fileURL, expiresAt },
    }).catch(console.error)

    return json({ success: true, emailed: true })
  }

  // ---- SMALL EXPORT (<= 50 orders) ----

  // Fetch orders normally
  const ordersRaw = await Order.find(query).sort({ created_at: -1 }).lean()

  const records: ExportOrderRecord[] = []

  ordersRaw.forEach(order => {
    records.push(...extractRecordsFromOrder(order))
  })

  const csvString = ordersToCsv(records, selectedColumns)

  fs.writeFileSync(filePath, csvString, 'utf8')

  return json({ success: true, url: `/exports/${fileName}` })
}

// Helper to extract ExportOrderRecord(s) from a Mongo order document
function extractRecordsFromOrder(order: any): ExportOrderRecord[] {
  const orderBase = {
    id: order.id,
    name: order.name,
    created_at: order.created_at,
    order_number: order.order_number,
    shipping_method: order.shipping_lines?.[0]?.title ?? '',

    // Customer / addresses
    email: order.customer?.email || order.email || '',
    'shipping_address.first_name': order.shipping_address?.first_name || '',
    'shipping_address.last_name': order.shipping_address?.last_name || '',
    phone: order.customer?.phone || order.phone || '',
    'shipping_address.country_code': order.shipping_address?.country_code || '',
    'shipping_address.city': order.shipping_address?.city || '',
    'shipping_address.province': order.shipping_address?.province || '',
    'shipping_address.zip': order.shipping_address?.zip || '',
    'shipping_address.address1': order.shipping_address?.address1 || '',
    'shipping_address.address2': order.shipping_address?.address2 || '',

    // displayFulfillmentStatus: formatOrderStatus(order.displayFulfillmentStatus),
    fulfillment_status: order.fulfillment_status,
    financial_status: order.financial_status,
  }

  const records: ExportOrderRecord[] = []
  let revenueAdded = false
  let totalPriceAdded = false
  let currencyAdded = false

  const fulfillmentOrders = order.fulfillmentOrders ?? []

  for (const line_item of order.line_items ?? []) {
    const printAreasData = line_item.fulfillment_order_data?.print_areas ?? []

    const fulfillmentOrderLineItem = fulfillmentOrders.find((fo: any) =>
      fo.lineItems?.some((li: any) => li.lineItem.id === line_item.admin_graphql_api_id)
    )

    const fulfillmentStatus = fulfillmentOrderLineItem
      ? (getFulfillmentStatus(fulfillmentOrderLineItem)?.content ?? UNFULFILLED)
      : UNFULFILLED

    const printAreaPositions: string[] = []
    const designUrls: string[] = []

    if (Array.isArray(printAreasData)) {
      printAreasData.forEach((areaObj: any) => {
        Object.entries(areaObj || {}).forEach(([pos, val]: [string, any]) => {
          printAreaPositions.push(pos)
          if (typeof val === 'string') {
            designUrls.push(val)
          } else if (val && typeof val === 'object' && 'src' in val) {
            designUrls.push((val as any).src)
          }
        })
      })
    }

    // Determine how many rows we need based on max length of arrays
    const rowCount = Math.max(printAreaPositions.length, designUrls.length, 1)

    for (let idx = 0; idx < rowCount; idx++) {
      const isFirstRow = idx === 0

      // Base record for first row contains full order + line item info
      if (isFirstRow) {
        records.push({
          ...orderBase,
          product_sku: line_item.sku,
          product_name: line_item.name,
          variant_id: line_item.variant_id,
          quantity: line_item.quantity,
          print_provider_id: line_item.fulfillment_order_data?.provider_id || '',
          print_area: printAreaPositions[idx] ?? '',
          design_file_url: designUrls[idx] ?? '',
          fulfillment_status: fulfillmentStatus,
          shipping_method: order.shipping_lines?.[0]?.title ?? '',
          // Include revenue only once per order
          ...(revenueAdded ? {} : { appGeneratedRevenue: order.appGeneratedRevenueInShopCurrency ?? 0 }),
          ...(totalPriceAdded ? {} : { total_price: order.total_price }),
          ...(currencyAdded ? {} : { currency: order.currency }),
        } as ExportOrderRecord)
        revenueAdded = true
        totalPriceAdded = true
        currencyAdded = true
      } else {
        // Subsequent rows: only include id, print_area, design_file_url to avoid duplicate data
        records.push({
          id: order.id,
          name: order.name,
          product_name: line_item.name,
          product_sku: line_item.sku,
          variant_id: line_item.variant_id,
          print_provider_id: line_item.fulfillment_order_data?.provider_id || '',
          // Empty strings for other required fields to satisfy type checker when casting
          order_number: '' as any,
          created_at: '',
          email: '',
          phone: '',
          'shipping_address.first_name': '',
          'shipping_address.last_name': '',
          'shipping_address.country_code': '',
          'shipping_address.city': '',
          'shipping_address.province': '',
          'shipping_address.zip': '',
          'shipping_address.address1': '',
          'shipping_address.address2': '',
          total_price: '' as any,
          currency: '',
          financial_status: '',
          fulfillment_status: '',
          print_area: printAreaPositions[idx] ?? '',
          design_file_url: designUrls[idx] ?? '',
        } as ExportOrderRecord)
      }
    }
  }

  return records
}
