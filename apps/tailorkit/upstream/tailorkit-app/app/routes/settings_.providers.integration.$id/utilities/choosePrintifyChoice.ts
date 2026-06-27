import { PROVIDER_INTEGRATION_ACTION } from '~/routes/api.providers-integration.$id/constants'
import { authenticatedFetch } from '~/shopify/fns.client'

export const choosePrintifyChoice = async (params: {
  providerId: string
  confirm: boolean
  printifyProductIds: string[]
}) => {
  try {
    const { providerId, confirm, printifyProductIds } = params

    const res = await authenticatedFetch(`/api/providers-integration/${providerId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: PROVIDER_INTEGRATION_ACTION.CONFIRM_CHOOSE_PRINTIFY_CHOICE,
        confirm,
        printifyProductIds,
      }),
    })

    return res
  } catch (e) {
    return null
  }
}
