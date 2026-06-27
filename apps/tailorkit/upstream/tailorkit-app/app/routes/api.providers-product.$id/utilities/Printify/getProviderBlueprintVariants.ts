import { PROVIDER_API_URL } from '~/constants/fulfillment-providers'
import { fetchWithPrintify } from './fetchWithPrintify'
import type { IPrintifyVariant } from '~/routes/api.providers-connection.$id/Printify/types'

export const getProviderBluePrintVariants = async (blueprintId: string, printProviderId: string, apiToken: string) => {
  const providersUrl
    = `${PROVIDER_API_URL.Printify.baseUrl}${PROVIDER_API_URL.Printify.variantsOfBlueprintProviderPath}`
      .replace('{blueprint_id}', blueprintId)
      .replace('{print_provider_id}', printProviderId)
  try {
    const data: { id: number; title: string; variants: IPrintifyVariant[] } | null = await fetchWithPrintify(
      providersUrl,
      apiToken
    )

    return data?.variants
  } catch (err) {
    return null
  }
}
