import { PROVIDER_API_URL } from '~/constants/fulfillment-providers'
import type { IPrintifyProvider } from '~/routes/api.providers-connection.$id/Printify/types'
import { fetchWithPrintify } from './fetchWithPrintify'
import { chunkArray } from '~/utils/chunkArray'
import { sleep } from '~/utils/sleep'

/**
 * Configuration for API requests
 */
const CONFIG = {
  CHUNK_SIZE: 3, // Number of concurrent requests
  DELAY_BETWEEN_CHUNKS: 1000, // Delay in ms between chunks
} as const

/**
 * Constructs the URL for fetching all providers of a blueprint
 * @param blueprintId - The ID of the blueprint
 * @returns The constructed URL
 */
const constructProvidersUrl = (blueprintId: string): string => {
  return `${PROVIDER_API_URL.Printify.baseUrl}${PROVIDER_API_URL.Printify.allProvidersOfBlueprintPath}`.replace(
    '{blueprint_id}',
    blueprintId
  )
}

/**
 * Constructs the URL for fetching provider details
 * @param providerId - The ID of the provider
 * @returns The constructed URL
 */
const constructProviderDetailsUrl = (providerId: string): string => {
  return `${PROVIDER_API_URL.Printify.baseUrl}${PROVIDER_API_URL.Printify.providerByIdPath}`.replace(
    '{print_provider_id}',
    providerId
  )
}

/**
 * Fetches provider details and enhances the provider object with location information
 * @param provider - The provider object to enhance
 * @param apiToken - The API token for authentication
 * @returns Enhanced provider object with location details
 */
export const fetchProviderDetailsByProviderId = async (
  providerId: string | number,
  apiToken: string
): Promise<IPrintifyProvider | null> => {
  try {
    const providerDetailsUrl = constructProviderDetailsUrl(providerId.toString())
    const providerDetails = await fetchWithPrintify(providerDetailsUrl, apiToken)

    return {
      ...providerDetails,
      location: providerDetails?.location || {},
    }
  } catch (error) {
    console.error('Error fetching provider details:', {
      providerId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return null
  }
}

/**
 * Processes a chunk of providers with delay between chunks
 */
const processProviderChunk = async (
  providers: IPrintifyProvider[],
  apiToken: string,
  chunkIndex: number
): Promise<IPrintifyProvider[]> => {
  if (chunkIndex > 0) {
    await sleep(CONFIG.DELAY_BETWEEN_CHUNKS)
  }

  const chunkResults = await Promise.allSettled(
    providers.map(provider => fetchProviderDetailsByProviderId(provider.id, apiToken))
  )

  return chunkResults
    .filter((result): result is PromiseFulfilledResult<IPrintifyProvider | null> => result.status === 'fulfilled')
    .map(result => result.value)
    .filter(Boolean) as IPrintifyProvider[]
}

/**
 * Fetches all providers for a given blueprint and enhances them with location details
 * Uses chunking to prevent overwhelming the API
 * @param blueprintId - The ID of the blueprint to fetch providers for
 * @param apiToken - The API token for authentication
 * @returns Array of enhanced provider objects or null if the operation fails
 */
export const getBlueprintProviders = async (
  blueprintId: string,
  apiToken: string,
  containsLocation: boolean = true
): Promise<IPrintifyProvider[] | null> => {
  if (!blueprintId || !apiToken) {
    console.warn('Missing required parameters for getBlueprintProviders')
    return null
  }

  try {
    const providersUrl = constructProvidersUrl(blueprintId)
    const providers = await fetchWithPrintify(providersUrl, apiToken)

    if (!providers?.length) {
      return []
    }

    if (!containsLocation) {
      return providers
    }

    // Split providers into chunks
    const providerChunks = chunkArray(providers, CONFIG.CHUNK_SIZE)

    // Process chunks sequentially with delay
    const enhancedProviders: IPrintifyProvider[] = []
    for (let i = 0; i < providerChunks.length; i++) {
      const chunkResults = await processProviderChunk(providerChunks[i], apiToken, i)
      enhancedProviders.push(...chunkResults)
    }

    return enhancedProviders
  } catch (error) {
    console.error('Error fetching blueprint providers:', {
      blueprintId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return null
  }
}
