import { PROVIDER_INTEGRATION_ACTION } from '~/routes/api.providers-integration.$id/constants'
import { authenticatedFetch } from '~/shopify/fns.client'

export const deleteSelectedProducts = async (params: { providerId: string; selectedProductIds: string[] }) => {
  try {
    const { providerId, selectedProductIds } = params

    const res = await authenticatedFetch(`/api/providers-integration/${providerId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: PROVIDER_INTEGRATION_ACTION.DELETE_SELECTED_PRODUCTS,
        selectedProductIds,
      }),
    })

    return res
  } catch (e) {
    return null
  }
}
