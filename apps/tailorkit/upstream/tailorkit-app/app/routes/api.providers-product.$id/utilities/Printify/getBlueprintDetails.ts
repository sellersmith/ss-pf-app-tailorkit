import { PROVIDER_API_URL } from '~/constants/fulfillment-providers'
import { getAdvanceBlueprintsProvider } from '~/routes/api.providers-connection.$id/Printify/fns.server'
import type { IPrintifyBlueprint } from '~/routes/api.providers-connection.$id/Printify/types'
import { fetchWithPrintify } from './fetchWithPrintify'

export const getBlueprintDetails = async (blueprintId: string, apiToken: string) => {
  const blueprintsUrl = `${PROVIDER_API_URL.Printify.baseUrl}${PROVIDER_API_URL.Printify.blueprintByIdPath}`.replace(
    '{blueprint_id}',
    blueprintId
  )
  try {
    const blueprint: (IPrintifyBlueprint & any) | null = await fetchWithPrintify(blueprintsUrl, apiToken)
    const advanceInfo = await getAdvanceBlueprintsProvider(blueprintId)
    if (blueprint) {
      blueprint.advanceInfo = advanceInfo || {}
    }
    return blueprint
  } catch (err) {
    return null
  }
}
