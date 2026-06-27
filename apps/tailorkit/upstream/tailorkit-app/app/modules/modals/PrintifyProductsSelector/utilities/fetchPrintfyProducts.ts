import { PROVIDER_CONNECT_ACTION } from '~/routes/api.providers-connection.$id/constants'
import { authenticatedFetch } from '~/shopify/fns.client'

export const fetchPrintifyBlueprints = async (providerId: string) => {
  const res = await authenticatedFetch(`/api/providers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: PROVIDER_CONNECT_ACTION.Printify.GET_BLUEPRINTS_LIST,
      providerId,
    }),
  })

  if (res?.success && res?.blueprintsList?.length > 0) {
    return res
  }

  return { blueprintsList: [] }
}
