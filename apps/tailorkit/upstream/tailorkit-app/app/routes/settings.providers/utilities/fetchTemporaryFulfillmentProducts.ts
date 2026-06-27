import { authenticatedFetch } from '~/shopify/fns.client'

export const fetchTemporaryFulfillmentProducts = async (params: { providerId: string }) => {
  try {
    const { providerId } = params
    const res = await authenticatedFetch(`/api/providers-integration/${providerId}`)

    if (res.success && res.importedProducts) {
      return res.importedProducts
    }

    return null
  } catch (err) {
    return null
  }
}
