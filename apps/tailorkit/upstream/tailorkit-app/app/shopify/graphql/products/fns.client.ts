import { SHOPIFY_API_ACTIONS } from '~/routes/api.shopify/constants'
import { authenticatedFetch } from '~/shopify/fns.client'

export const checkUserHasProduct = async (): Promise<boolean> => {
  try {
    const response = await authenticatedFetch(`/api/shopify?action=${SHOPIFY_API_ACTIONS.CHECK_USER_HAS_PRODUCT}`)

    if (response.success) {
      return !!response.data
    }

    return false
  } catch (error) {
    console.error('Error checking user has product', error)

    return false
  }
}
