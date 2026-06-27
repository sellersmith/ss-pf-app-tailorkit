import { Http } from '../core/httpClient'
import { PROVIDER_CONNECT_ACTION } from '~/routes/api.providers-connection.$id/constants'

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

interface GetProductTemplatesResponse {
  success: boolean
  productTemplates?: unknown[]
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Client-side service for fulfillment provider API calls.
 * Centralizes all provider-related HTTP requests using the Http client.
 */
export const FulfillmentProvidersService = {
  /**
   * Fetch ShineOn product templates for a given provider integration.
   *
   * @param providerId - The provider integration ID
   * @returns Array of raw product templates from ShineOn API
   */
  async getShineOnProductTemplates(providerId: string): Promise<{ productTemplates: unknown[] }> {
    try {
      const res = await Http.post<GetProductTemplatesResponse>('/api/providers', {
        action: PROVIDER_CONNECT_ACTION.ShineOn.GET_PRODUCT_TEMPLATES,
        providerId,
      })

      if (!res.ok || !res.data) {
        return { productTemplates: [] }
      }

      const { success, productTemplates } = res.data

      if (success && Array.isArray(productTemplates)) {
        return { productTemplates }
      }

      return { productTemplates: [] }
    } catch (error) {
      console.error('Error fetching ShineOn product templates:', error)
      return { productTemplates: [] }
    }
  },
}
