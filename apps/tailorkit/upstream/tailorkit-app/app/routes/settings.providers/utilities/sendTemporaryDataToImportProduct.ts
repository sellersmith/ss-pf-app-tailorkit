import type { TemporaryData } from '~/models/TemporaryFulfillmentProducts'
import { PROVIDER_INTEGRATION_ACTION, type TProductToImport } from '~/routes/api.providers-integration.$id/constants'
import { authenticatedFetch } from '~/shopify/fns.client'

export const sendTemporaryDataToImport = async (params: {
  providerId: string
  temporaryData: Omit<TemporaryData, 'products'> & {
    products: TProductToImport[]
  }
}) => {
  try {
    const { providerId, temporaryData } = params

    const res = await authenticatedFetch(`/api/providers-integration/${providerId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: PROVIDER_INTEGRATION_ACTION.IMPORT_PRODUCT,
        data: {
          ...temporaryData,
          confirmChoosePrintifyChoice: false,
        },
      }),
    })

    if (res.success && res.importedData) {
      return res
    }

    return null
  } catch (e) {
    console.error('Failed to import product: ', e)
    return null
  }
}
