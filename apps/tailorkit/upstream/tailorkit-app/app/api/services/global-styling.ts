import { z } from 'zod'
import { Http } from '../core/httpClient'
import type { ApiResult } from '../types/common'
import type { GlobalStyling } from '~/types/global-styling'
import { createDefaultGlobalStyling } from '~/types/global-styling'
import { mergeDeep } from '~/utils/mergeDeep'

// Lenient Zod schemas - use .partial() to handle missing fields from old data
// Missing fields will be filled in with defaults via mergeDeep

const BoxStyleZ = z
  .object({
    backgroundEnabled: z.boolean(),
    backgroundColor: z.string(),
    borderEnabled: z.boolean(),
    borderColor: z.string(),
    borderStyle: z.enum(['solid', 'dashed']),
    borderWidth: z.number(),
    borderRadius: z.number(),
  })
  .partial()

const HeadingStyleZ = z
  .object({
    text: z.string(),
    fontSize: z.number(),
    color: z.string(),
    style: z.array(z.enum(['bold', 'italic', 'underline', 'normal'])),
  })
  .partial()

const DividerStyleZ = z
  .object({
    enabled: z.boolean(),
    color: z.string(),
    width: z.number(),
    style: z.enum(['solid', 'dashed']),
  })
  .partial()

const PersonalizationAreaStyleZ = z
  .object({
    enabled: z.boolean(),
    autoHideNameIfSingle: z.boolean(),
    color: z.string(),
    fontSize: z.number(),
    style: z.array(z.enum(['bold', 'italic', 'underline', 'normal'])),
    backgroundColor: z.string(),
    borderRadius: z.number(),
  })
  .partial()

const OptionSetLabelStyleZ = z
  .object({
    color: z.string(),
    size: z.number(),
    bold: z.boolean(),
    italic: z.boolean(),
    underline: z.boolean(),
  })
  .partial()

const OptionSetOptionStyleZ = z
  .object({
    borderActiveColor: z.string(),
    borderRadius: z.number(),
  })
  .partial()

const OptionSetStyleZ = z
  .object({
    label: OptionSetLabelStyleZ,
    option: OptionSetOptionStyleZ,
  })
  .partial()

const GlobalStylingZ = z
  .object({
    box: BoxStyleZ,
    heading: HeadingStyleZ,
    divider: DividerStyleZ,
    personalizationArea: PersonalizationAreaStyleZ,
    optionSet: OptionSetStyleZ,
  })
  .partial()

const GlobalStylingResponseZ = z.object({
  globalStyling: GlobalStylingZ.optional(),
})

const UpdateGlobalStylingResponseZ = z.object({
  success: z.boolean(),
  message: z.string().optional(),
})

/**
 * Service for interacting with Global Styling API.
 * Provides methods to get and update global styling configuration.
 */
export const GlobalStylingService = {
  /**
   * Get current global styling configuration.
   * Falls back to defaults if none exists.
   */
  async get(preferCache: boolean = false): Promise<GlobalStyling> {
    try {
      const res = await Http.post<unknown, { action: string }>(
        '/api/preferences',
        {
          action: 'GET_GLOBAL_STYLING',
        },
        { preferCache }
      )

      // Handle null/undefined response (e.g., from HTTP error handling)
      if (!res.ok || !res.data) {
        console.warn('Failed to fetch global styling (no data), using defaults')
        return createDefaultGlobalStyling()
      }

      // Parse with lenient schema - allows partial/missing fields
      const parseResult = GlobalStylingResponseZ.safeParse(res.data)
      if (!parseResult.success) {
        console.warn('Failed to parse global styling response, using defaults:', parseResult.error)
        return createDefaultGlobalStyling()
      }

      const partialStyling = parseResult.data.globalStyling
      if (!partialStyling) {
        return createDefaultGlobalStyling()
      }

      // Merge partial data with defaults to fill in any missing fields
      const defaults = createDefaultGlobalStyling()
      return mergeDeep(defaults, partialStyling) as GlobalStyling
    } catch (error) {
      console.warn('Failed to fetch global styling, using defaults:', error)
      return createDefaultGlobalStyling()
    }
  },

  /**
   * Update global styling configuration.
   * Persists to both database and Shopify metafields.
   */
  async update(styling: GlobalStyling): Promise<ApiResult<void>> {
    try {
      const res = await Http.post<unknown, { action: string; styling: GlobalStyling }>('/api/preferences', {
        action: 'UPDATE_GLOBAL_STYLING',
        styling,
      })

      // Handle null/undefined response
      if (!res.ok || !res.data) {
        return { success: false, message: 'Failed to update global styling' }
      }

      const parseResult = UpdateGlobalStylingResponseZ.safeParse(res.data)
      if (!parseResult.success) {
        console.warn('Failed to parse update response:', parseResult.error)
        return { success: false, message: 'Failed to update global styling' }
      }

      if (parseResult.data.success) {
        return { success: true, message: parseResult.data.message }
      }
      return { success: false, message: parseResult.data.message || 'Failed to update global styling' }
    } catch (error) {
      console.error('Error updating global styling:', error)
      return { success: false, message: 'Failed to update global styling' }
    }
  },

  /**
   * Reset global styling to defaults.
   */
  async reset(): Promise<ApiResult<void>> {
    const defaultStyling = createDefaultGlobalStyling()
    return this.update(defaultStyling)
  },

  /**
   * Get global styling from cached preferences (includes theme config).
   * This method uses the faster cached endpoint with themeConfig.
   */
  async getFromPreferences(): Promise<GlobalStyling> {
    try {
      const res = await Http.get<{
        appConfig?: { appMetafields?: { globalStyling?: GlobalStyling } }
      }>('/api/preferences?themeConfig=1', { preferCache: true })

      const globalStyling = res.data?.appConfig?.appMetafields?.globalStyling
      if (globalStyling) {
        // Validate with lenient schema - allows partial/missing fields
        const parseResult = GlobalStylingZ.safeParse(globalStyling)
        if (!parseResult.success) {
          console.warn('Failed to parse cached global styling, using defaults:', parseResult.error)
          return createDefaultGlobalStyling()
        }

        // Merge partial data with defaults to fill in any missing fields
        const defaults = createDefaultGlobalStyling()
        return mergeDeep(defaults, parseResult.data) as GlobalStyling
      }
      return createDefaultGlobalStyling()
    } catch (error) {
      console.warn('Failed to fetch cached global styling, using defaults:', error)
      return createDefaultGlobalStyling()
    }
  },
}
