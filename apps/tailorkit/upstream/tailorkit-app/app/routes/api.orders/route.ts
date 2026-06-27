import type { LoaderFunctionArgs } from '@remix-run/node'
import { authenticate } from '~/shopify/app.server'
import { ShopifyApiClient } from '~/shopify/graphql/api.server'
import { ORDER_ACTION } from './constants'
import { fetchOrderList, requestFulfillOrder } from './fns.server'
import { getNumberOfOrdersData, getRevenueData } from '../api.analytics/fns.server'
import { json } from '~/bootstrap/fns/fetch.server'
import { syncOrderFromShopify } from './sync-order.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const {
    admin,
    session: { shop },
  } = await authenticate.admin(request)

  // Get API client
  const api = new ShopifyApiClient(admin)

  // Get orders
  const { page, items, total } = await fetchOrderList(request, shop, api)

  return json({ page, items, total })
}

export async function action({ request }: LoaderFunctionArgs) {
  try {
    const {
      session: { shop: shopDomain },
      admin,
    } = await authenticate.admin(request)

    const payload = (await request.json()) || {}
    const { action, ...rest } = payload

    switch (action) {
      case ORDER_ACTION.FULFILL: {
        const api = new ShopifyApiClient(admin)
        // Request fulfill order
        await requestFulfillOrder({ shopDomain, api, ...rest })

        break
      }

      case ORDER_ACTION.TOTAL_NUMBER_REVENUE: {
        const { dateRange } = payload

        const [orders, revenues] = await Promise.all([
          getNumberOfOrdersData(shopDomain, dateRange),
          getRevenueData(shopDomain, dateRange),
        ])

        return json({
          success: true,
          numberOfOrders: orders?.total || 0,
          totalRevenues: revenues?.total || 0,
        })
      }

      case ORDER_ACTION.SYNC_ORDER: {
        const api = new ShopifyApiClient(admin)
        const result = await syncOrderFromShopify({
          shopifyOrderId: rest.shopifyOrderId,
          shopDomain,
          api,
        })

        return json(result)
      }
    }

    return json({ success: true })
  } catch (e: any) {
    return json({ success: false, message: e?.message || e })
  }
}
