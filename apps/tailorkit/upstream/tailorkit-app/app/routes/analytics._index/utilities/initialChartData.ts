import { ANALYTICS_API_PATH, ECardType } from '../constants'
import type { TasAnalyticsLineChartKey, TasAnalyticsBarChartKey, TasAnalyticsValues } from '../types'
import { ANALYTICS_ACTION } from '~/routes/api.analytics/constants'

/**
 * @author KhanhNT
 * Generates the initial chart data configuration for analytics dashboards.
 *
 * @param {TFunction} t - Translation function for localizing chart titles.
 * @returns {Record<TasAnalyticsKey, TasAnalyticsValues>} An object containing the initial structure for different analytics chart data.
 *
 * The returned object includes:
 * - `numberOfOrders`: Line chart showing the number of orders.
 * - `revenue`: Line chart displaying revenue data.
 * - `templatesByOrders`: Bar chart showing templates ranked by orders.
 * - `templatesByRevenue`: Bar chart displaying templates ranked by revenue.
 * - `productsByOrders`: Bar chart showing products ranked by orders.
 * - `productsByRevenue`: Bar chart displaying products ranked by revenue.
 *
 * Each key holds:
 * - `title`: Localized string representing the chart's title.
 * - `url`: An empty string placeholder for API or data source URLs.
 * - `cardType`: The type of chart, either `LINE_CHART` or `BAR_CARD`.
 */
const LINE_CHART_DATA: Record<TasAnalyticsLineChartKey, TasAnalyticsValues> = {
  revenue: {
    title: 'revenue',
    url: `${ANALYTICS_API_PATH}?action=${ANALYTICS_ACTION.FETCH_REVENUE}`,
    cardType: ECardType.LINE_CHART,
    isShowMoney: true,
  },
  numberOfOrders: {
    title: 'number-of-orders',
    url: `${ANALYTICS_API_PATH}?action=${ANALYTICS_ACTION.FETCH_NUMBER_OF_ORDERS}`,
    cardType: ECardType.LINE_CHART,
  },
}

const BAR_CHART_DATA: Record<TasAnalyticsBarChartKey, TasAnalyticsValues> = {
  templatesByRevenue: {
    title: 'templates-by-revenue',
    url: `${ANALYTICS_API_PATH}?action=${ANALYTICS_ACTION.FETCH_TEMPLATES_BY_REVENUES}`,
    cardType: ECardType.BAR_CARD,
    isShowMoney: true,
  },
  productsByRevenue: {
    title: 'products-by-revenue',
    url: `${ANALYTICS_API_PATH}?action=${ANALYTICS_ACTION.FETCH_PRODUCTS_BY_REVENUES}`,
    cardType: ECardType.BAR_CARD,
    isShowMoney: true,
  },
  templatesByOrders: {
    title: 'templates-by-orders',
    url: `${ANALYTICS_API_PATH}?action=${ANALYTICS_ACTION.FETCH_TEMPLATES_BY_ORDERS}`,
    cardType: ECardType.BAR_CARD,
  },
  productsByOrders: {
    title: 'products-by-orders',
    url: `${ANALYTICS_API_PATH}?action=${ANALYTICS_ACTION.FETCH_PRODUCTS_BY_ORDERS}`,
    cardType: ECardType.BAR_CARD,
  },
}

export const getChartEntriesDataByChartType = (chartType: ECardType) => {
  try {
    if (chartType === ECardType.BAR_CARD) {
      return Object.entries(BAR_CHART_DATA)
    }

    if (chartType === ECardType.LINE_CHART) {
      return Object.entries(LINE_CHART_DATA)
    }

    return []
  } catch (e) {
    console.error('Failed to initialize chart: ', e)
    return []
  }
}
