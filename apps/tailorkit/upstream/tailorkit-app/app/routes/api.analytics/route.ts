import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import { authenticate } from '~/shopify/app.server'
import { ANALYTICS_ACTION } from './constants'
import { catchAsync } from '~/utils/catchAsync'
import {
  getNumberOfOrdersData,
  getProductsByOrders,
  getProductsByRevenues,
  getRevenueData,
  getTemplatesByOrders,
  getTemplatesByRevenues,
} from './fns.server'

// Helper function to handle compared range logic
async function fetchComparedData(
  fetchFn: (shopDomain: string, comparedToRange: { startDate: string; endDate: string }) => Promise<any>,
  shopDomain: string,
  comparedToRange: any
) {
  const { startDate, endDate } = comparedToRange || {}
  if (startDate && endDate) {
    const data = await fetchFn(shopDomain, comparedToRange)
    return data
  }
  return null
}

export const action = catchAsync(async ({ request }: LoaderFunctionArgs) => {
  const {
    session: { shop: shopDomain },
  } = await authenticate.admin(request)

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')
  const payload = (await request.json()) || {}
  const { dateRange, comparedToRange } = payload

  // Main switch block handling analytics actions
  switch (action) {
    case ANALYTICS_ACTION.FETCH_NUMBER_OF_ORDERS: {
      const numberOfOrders = await getNumberOfOrdersData(shopDomain, dateRange)
      const numberOfOrdersCompared = await fetchComparedData(getNumberOfOrdersData, shopDomain, comparedToRange)
      return json({
        success: true,
        data: numberOfOrders,
        comparedData: numberOfOrdersCompared,
      })
    }

    case ANALYTICS_ACTION.FETCH_REVENUE: {
      const revenues = await getRevenueData(shopDomain, dateRange)
      const revenuesCompared = await fetchComparedData(getRevenueData, shopDomain, comparedToRange)
      return json({
        success: true,
        data: revenues,
        comparedData: revenuesCompared,
      })
    }

    case ANALYTICS_ACTION.FETCH_TEMPLATES_BY_ORDERS: {
      const templates = await getTemplatesByOrders(shopDomain, dateRange)
      return json({
        success: true,
        data: templates,
      })
    }

    case ANALYTICS_ACTION.FETCH_TEMPLATES_BY_REVENUES: {
      const templates = await getTemplatesByRevenues(shopDomain, dateRange)

      return json({
        success: true,
        data: templates,
      })
    }

    case ANALYTICS_ACTION.FETCH_PRODUCTS_BY_ORDERS: {
      const products = await getProductsByOrders(shopDomain, dateRange)
      return json({
        success: true,
        data: products,
      })
    }

    case ANALYTICS_ACTION.FETCH_PRODUCTS_BY_REVENUES: {
      const products = await getProductsByRevenues(shopDomain, dateRange)

      return json({
        success: true,
        data: products,
      })
    }

    default:
      return json({ success: false, message: 'Invalid action' })
  }
})
