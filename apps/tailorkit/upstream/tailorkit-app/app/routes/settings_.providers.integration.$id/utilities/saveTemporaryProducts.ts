import { PROVIDER_INTEGRATION_ACTION, type TProductToImport } from '~/routes/api.providers-integration.$id/constants'
import { authenticatedFetch } from '~/shopify/fns.client'

export const saveTemporaryProducts = async (params: {
  providerId: string
  selectedProducts: TProductToImport[]
  providerName: string
}) => {
  try {
    const { providerId, selectedProducts, providerName } = params

    const res = await authenticatedFetch(`/api/providers-integration/${providerId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: PROVIDER_INTEGRATION_ACTION.UPDATE_PRODUCTS_SELECTED,
        providerName,
        selectedProducts,
      }),
    })

    return res
  } catch (e) {
    return null
  }
}
