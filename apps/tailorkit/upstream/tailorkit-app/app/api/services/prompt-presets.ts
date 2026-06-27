import { z } from 'zod'
import { Http } from '../core/httpClient'
import { parseWithZod } from '../core/validation'

// Zod schema for PromptPresetItem
const PromptPresetItemZ = z.object({
  id: z.string().optional(),
  name: z.string(),
  type: z.string(),
  category: z.string().nullable().optional(),
  thumbnail: z.array(z.string()).optional(),
  description: z.unknown().optional(),
  instruction: z.string().optional(),
  hot: z.boolean().optional(),
})

const PromptPresetListZ = z.object({
  items: z.array(PromptPresetItemZ).default([]),
})

export type PromptPresetItem = z.infer<typeof PromptPresetItemZ>
export type PromptPresetType = 'quick_prompt' | 'visual_style' | 'content_theme' | 'template_type'

/**
 * Service for interacting with Prompt Presets API.
 * Provides methods to fetch prompt presets with caching support.
 */
export const PromptPresetsService = {
  /**
   * List all prompt presets (all types).
   * @param preferCache - Whether to use cached response if available
   */
  async list(preferCache: boolean = true): Promise<PromptPresetItem[]> {
    try {
      const res = await Http.get<unknown>('/api/prompt-presets', { preferCache })
      const parsed = parseWithZod(PromptPresetListZ, res.data, 'prompt-presets-list')
      return parsed.items
    } catch (error) {
      console.error('Failed to fetch prompt presets:', error)
      return []
    }
  },

  /**
   * List prompt presets by type.
   * @param type - The type of presets to fetch (quick_prompt, visual_style, content_theme, template_type)
   * @param preferCache - Whether to use cached response if available (defaults to true)
   */
  async listByType(type: PromptPresetType, preferCache: boolean = true): Promise<PromptPresetItem[]> {
    try {
      const res = await Http.get<unknown>(`/api/prompt-presets?type=${type}`, { preferCache })
      const parsed = parseWithZod(PromptPresetListZ, res.data, `prompt-presets-${type}`)
      return parsed.items
    } catch (error) {
      console.error(`Failed to fetch ${type} presets:`, error)
      return []
    }
  },

  /**
   * Get all visual style names.
   * Convenience method for fetching visual styles and extracting names.
   * @param preferCache - Whether to use cached response if available (defaults to true)
   */
  async getVisualStyleNames(preferCache: boolean = true): Promise<string[]> {
    const items = await this.listByType('visual_style', preferCache)
    return items.map(item => item.name)
  },

  /**
   * Get all quick prompt names.
   * Convenience method for fetching quick prompts and extracting names.
   * @param preferCache - Whether to use cached response if available (defaults to true)
   */
  async getQuickPromptNames(preferCache: boolean = true): Promise<string[]> {
    const items = await this.listByType('quick_prompt', preferCache)
    return items.map(item => item.name)
  },

  /**
   * Get all template type names.
   * Convenience method for fetching template types and extracting names.
   * @param preferCache - Whether to use cached response if available (defaults to true)
   */
  async getTemplateTypeNames(preferCache: boolean = true): Promise<string[]> {
    const items = await this.listByType('template_type', preferCache)
    return items.map(item => item.name)
  },

  /**
   * Get all content theme names.
   * Convenience method for fetching content themes and extracting names.
   * @param preferCache - Whether to use cached response if available (defaults to true)
   */
  async getContentThemeNames(preferCache: boolean = true): Promise<string[]> {
    const items = await this.listByType('content_theme', preferCache)
    return items.map(item => item.name)
  },
}
