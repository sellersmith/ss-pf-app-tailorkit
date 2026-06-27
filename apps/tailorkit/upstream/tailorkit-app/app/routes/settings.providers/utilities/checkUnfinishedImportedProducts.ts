import { PROVIDER_INTEGRATION_ACTION } from '~/routes/api.providers-integration.$id/constants'
import { authenticatedFetch } from '~/shopify/fns.client'

export const fetchUnfinishedImportedProducts = async (params: { providerId: string }) => {
  try {
    const { providerId } = params

    const res = await authenticatedFetch(`/api/providers-integration/${providerId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: PROVIDER_INTEGRATION_ACTION.CHECK_UNFINISHED_IMPORTED_PRODUCTS,
      }),
    })

    if (res.success && res.isUnfinishedImported) {
      return res.isUnfinishedImported
    }

    return null
  } catch (e) {
    console.error('Failed to get unfinished imported products: ', e)
    return null
  }
}
