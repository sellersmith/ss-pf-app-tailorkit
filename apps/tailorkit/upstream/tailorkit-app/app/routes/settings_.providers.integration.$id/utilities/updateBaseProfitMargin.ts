import { PROVIDER_INTEGRATION_ACTION } from '~/routes/api.providers-integration.$id/constants'
import { authenticatedFetch } from '~/shopify/fns.client'

export const updateBaseProfitMargin = async (params: {
  providerId: string
  profitMargin: number
  productIds: string[]
}) => {
  try {
    const { providerId, profitMargin, productIds } = params

    const res = await authenticatedFetch(`/api/providers-integration/${providerId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: PROVIDER_INTEGRATION_ACTION.UPDATE_BASE_PROFIT_MARGIN,
        profitMargin,
        productIds,
      }),
    })

    if (res.success) {
      return res
    }

    return null
  } catch (e) {
    return null
  }
}
