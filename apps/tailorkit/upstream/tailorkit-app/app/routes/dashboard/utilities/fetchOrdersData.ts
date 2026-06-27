import { todayRange } from '~/routes/analytics._index/constants'
import { ORDER_ACTION } from '~/routes/api.orders/constants'
import { authenticatedFetch } from '~/shopify/fns.client'

/**
 * @author KhanhNT
 * Fetches data related to the total number of orders and total revenue
 * from the backend API.
 *
 * - Cancels any ongoing fetch request if this function is called again
 *   before the previous request completes, ensuring no overlapping requests.
 * - Uses the `authenticatedFetch` utility to send a POST request with the
 *   required action to retrieve order statistics.
 * - Returns an object containing `numberOfOrders` and `totalRevenues` if
 *   the response is successful.
 * - Handles errors gracefully by logging them to the console.
 * @returns {Promise<{numberOfOrders: number, totalRevenues: number} | undefined>}
 *          A promise that resolves to an object containing order data or `undefined` if an error occurs.
 */

let fetchController: AbortController | null = null

export const getOrdersData = async () => {
  try {
    if (fetchController) {
      fetchController.abort()
    }

    fetchController = new AbortController()
    const { signal } = fetchController

    const response = await authenticatedFetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: ORDER_ACTION.TOTAL_NUMBER_REVENUE,
        dateRange: todayRange,
      }),
      signal,
    })

    if (response && response.success) {
      const { numberOfOrders, totalRevenues } = response

      return {
        numberOfOrders,
        totalRevenues,
      }
    }
  } catch (error) {
    console.error('Failed to fetch orders data', error)
  }
}
