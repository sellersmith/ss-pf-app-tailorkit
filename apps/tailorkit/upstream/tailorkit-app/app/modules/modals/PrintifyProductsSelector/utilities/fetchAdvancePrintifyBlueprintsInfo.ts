import { PROVIDER_CONNECT_ACTION } from '~/routes/api.providers-connection.$id/constants'
import { authenticatedFetch } from '~/shopify/fns.client'

export const fetchAdvancePrintifyBlueprintsByIds = async (params: { blueprintId: string }) => {
  const { blueprintId } = params

  const res = await authenticatedFetch(`/api/providers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: PROVIDER_CONNECT_ACTION.Printify.GET_ADVANCE_BLUEPRINTS_LIST,
      blueprintId,
    }),
  })

  if (res?.success && res?.providerData) {
    return res
  }

  return []
}
