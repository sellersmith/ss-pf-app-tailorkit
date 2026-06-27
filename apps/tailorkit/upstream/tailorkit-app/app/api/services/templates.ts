import { z } from 'zod'
import type { HttpRequestOptions } from '../core/httpClient'
import { Http } from '../core/httpClient'
import { parseWithZod } from '../core/validation'
import type { Pagination, ApiResult } from '../types/common'
import type { Template } from '~/types/psd'
import { buildUrlWithParams } from '~/utils/buildUrlWithParams'
import { TEMPLATES_ACTIONS } from '~/routes/api.templates/constants'
import { AI_ASSISTANT_SUGGESTION_ACTION } from '~/routes/api.ai-assistant.suggestion/constants'

// Minimal Template schema (accepts extra fields); aligns with usages in UI
const DimensionSchema = z
  .object({ width: z.number(), height: z.number(), measurementUnit: z.any(), resolution: z.number() })
  .partial()

const TemplateZ = z
  .object({
    _id: z.string(),
    name: z.string().optional(),
    previewUrl: z.string().optional(),
    thumbnailUrl: z.string().optional(),
    previewProductImage: z.unknown().optional(),
    category: z
      .string()
      .nullish()
      .transform(v => v ?? undefined),
    shopDomain: z.string().optional(),
    dimension: DimensionSchema.optional(),
    createdAt: z.union([z.string(), z.date()]).optional(),
    updatedAt: z.union([z.string(), z.date()]).optional(),
    activeVariantIntegration: z.array(z.unknown()).optional(),
    layers: z.array(z.unknown()).optional(),
    metadata: z.unknown().optional(),
  })
  .passthrough()

const TemplateListSchema = z.object({
  success: z.boolean().optional(),
  items: z.array(TemplateZ).optional(),
  templates: z.array(TemplateZ).optional(),
  total: z.number().optional(),
  page: z.number().optional(),
  limit: z.number().optional(),
})

const TemplateDetailResponseSchema = z.object({
  data: TemplateZ.nullable(),
})

const TemplatesByIdsResponseSchema = z.object({
  success: z.boolean().optional(),
  templates: z.array(TemplateZ).default([]),
})

export type TemplateListResponse = {
  items: Template[]
  total?: number
  page?: number
  limit?: number
}

/**
 * Service for interacting with TailorKit Templates API.
 * Provides a single source of truth for all templates-related requests.
 */
export const TemplatesService = {
  async list(
    params: Pagination & { filter__name?: string } = {},
    requestOptions: HttpRequestOptions = {}
  ): Promise<TemplateListResponse> {
    const url = buildUrlWithParams('/api/templates', params as Record<string, string | number | undefined>)
    const res = await Http.get<unknown>(url, { preferCache: true, ...requestOptions })
    const parsed = parseWithZod(TemplateListSchema, res.data, 'templates-list')
    const items = (parsed.items || parsed.templates || []) as Template[]
    return { items, total: parsed.total, page: parsed.page, limit: parsed.limit }
  },

  /**
   * List TailorKit clipart/premade templates via action endpoint.
   */
  async listCliparts(
    params: Pagination & { filter__name?: string; filter__type?: string; filter__categories?: string } = {}
  ) {
    const baseUrl = buildUrlWithParams('/api/templates', {
      action: TEMPLATES_ACTIONS.GET_CLIPARTS_LIST,
      page: params.page,
      limit: params.limit,
      sort: params.sort ?? 'createdAt_desc',
    })
    let url = baseUrl
    if (params.filter__name) {
      url += `&filter__name=string__has__${encodeURIComponent(params.filter__name)}`
    }
    if (params.filter__type) {
      url += `&filter__type=${encodeURIComponent(params.filter__type)}`
    }
    if (params.filter__categories) {
      url += `&filter__categories=${encodeURIComponent(params.filter__categories)}`
    }
    // Debug URL for verification of filters
    // removed debug log
    const res = await Http.post<unknown, undefined>(url)
    const parsed = res.data as TemplateListResponse
    const items = (parsed.items || []) as Template[]
    return { items, total: parsed.total || items.length, page: parsed.page, limit: parsed.limit }
  },

  /**
   * Fetch unique public clipart/premade categories from index.
   */
  async listClipartCategories(
    generateDefaultCategories = false,
    withUserCliparts = true
  ): Promise<{ categories: string[]; suggestedCategory: string }> {
    const url = buildUrlWithParams('/api/templates', { action: TEMPLATES_ACTIONS.GET_CLIPARTS_CATEGORIES })
    const res = await Http.post<{ success?: boolean; items?: string[] }, undefined>(url)
    const categories = res.data?.items || []
    let suggestedCategory = ''

    if (withUserCliparts) {
      categories.push('your cliparts')
    }

    if (generateDefaultCategories) {
      const { category: suggested } = await TemplatesService.suggestClipartCategory(categories)
      if (typeof suggested === 'string' && suggested) {
        suggestedCategory = suggested
      }
    }

    return { categories, suggestedCategory }
  },

  async getById(id: string): Promise<Template | null> {
    const res = await Http.get<unknown>(`/api/templates/${id}`)
    const parsed = parseWithZod(TemplateDetailResponseSchema, res.data, 'template-detail')
    return (parsed.data as Template | null) || null
  },

  /**
   * Create or save a template by id with multipart FormData.
   * The backend reads action from the form field `type`.
   */
  async create(id: string, body: FormData): Promise<ApiResult<{ previewUrl?: string; showConfetti?: boolean }>> {
    const url = `/api/templates/${id}`
    const res = await Http.post<ApiResult<{ previewUrl?: string; showConfetti?: boolean }>, FormData>(url, body)
    return (res.data || { success: false, message: 'unknown' }) as ApiResult<{
      previewUrl?: string
      showConfetti?: boolean
    }>
  },

  async update(id: string, body: Record<string, unknown>): Promise<ApiResult<Record<string, unknown>>> {
    const res = await Http.post<ApiResult<Record<string, unknown>>, Record<string, unknown>>(
      `/api/templates/${id}`,
      body
    )
    return (res.data || { success: false, message: 'unknown' }) as ApiResult<Record<string, unknown>>
  },

  async duplicate(selectedResources: string[]): Promise<ApiResult<Record<string, unknown>>> {
    const url = `/api/templates?action=${TEMPLATES_ACTIONS.DUPLICATE}`
    const res = await Http.post<ApiResult<Record<string, unknown>>, { selectedResources: string[] }>(url, {
      selectedResources,
    })
    return (res.data || { success: false, message: 'unknown' }) as ApiResult<Record<string, unknown>>
  },

  async deleteMany(selectedResources: string[]): Promise<ApiResult<Record<string, unknown>>> {
    const url = `/api/templates?action=${TEMPLATES_ACTIONS.DELETE_TEMPLATES}`
    const res = await Http.delete<ApiResult<Record<string, unknown>>, { selectedResources: string[] }>(url, {
      selectedResources,
    })
    return (res.data || { success: false, message: 'unknown' }) as ApiResult<Record<string, unknown>>
  },

  /**
   * Export templates as a single JSON (one) or a ZIP (multiple).
   * Uses raw fetch to handle binary response and attaches Authorization header.
   */
  async export(templateIds: string[]): Promise<Response> {
    const url = `/api/templates?action=${TEMPLATES_ACTIONS.EXPORT_TEMPLATES}`
    // Use native fetch to keep binary response; add Authorization header manually
    const formData = new FormData()
    formData.append('templateIds', JSON.stringify(templateIds))
    const shopify = (window as any).opener?.shopify ?? (window as any).shopify
    const idToken = await shopify.idToken()
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
      body: formData,
    })
    return response
  },

  async getByIds(templateIds: string[]): Promise<Template[]> {
    const url = `/api/templates?action=${TEMPLATES_ACTIONS.GET_TEMPLATES_BY_IDS}`
    const formData = new FormData()
    formData.append('templateIds', JSON.stringify(templateIds))
    const res = await Http.post<unknown, FormData>(url, formData)
    const parsed = parseWithZod(TemplatesByIdsResponseSchema, res.data, 'templates-by-ids')
    return parsed.templates as Template[]
  },

  async getClipartsDetails(clipartsSelected: { _id: string; type: string }[]): Promise<Template[]> {
    const url = `/api/templates?action=${TEMPLATES_ACTIONS.GET_CLIPARTS_DETAILS}`
    const res = await Http.post<unknown, { clipartsSelected: { _id: string; type: string }[] }>(url, {
      clipartsSelected,
    })
    const parsed = parseWithZod(TemplatesByIdsResponseSchema, res.data, 'cliparts-details')
    return parsed.templates as Template[]
  },

  /**
   * Suggest best clipart category based on shop metadata and provided category list.
   */
  async suggestClipartCategory(categories: string[]): Promise<{ category: string; reason?: string }> {
    const url = `/api/ai-assistant/suggestion`
    const res = await Http.post<{ success?: boolean; category?: string; reason?: string }, any>(url, {
      action: AI_ASSISTANT_SUGGESTION_ACTION.SUGGEST_CLIPART_CATEGORY,
      categories,
    })
    const data = res.data || {}
    return { category: data.category || '', reason: data.reason }
  },

  /**
   * Fetch click counts for clipart IDs
   * @param clipartIds - Array of clipart IDs
   * @returns Promise with clickCounts map (formula: 100 + actual clicks)
   */
  async getClipartClickCounts(clipartIds: string[]): Promise<Record<string, number>> {
    if (clipartIds.length === 0) {
      return {}
    }

    try {
      // Use consolidated cliparts endpoint with action pattern
      const url = `/api/cliparts?action=get_click_counts&assetIds=${clipartIds.join(',')}&assetType=clipart`
      const res = await Http.get<{ clickCounts?: Record<string, number> }>(url)
      return res.data?.clickCounts || {}
    } catch (error) {
      console.error('[TemplatesService] Failed to fetch click counts:', error)
      return {}
    }
  },

  /**
   * Fetch click counts for assets (generalized)
   * @param assetIds - Array of asset IDs
   * @param assetType - The type of asset (default: 'clipart')
   * @returns Promise with clickCounts map (formula: 100 + actual clicks)
   */
  async getAssetClickCounts(assetIds: string[], assetType: string = 'clipart'): Promise<Record<string, number>> {
    if (assetIds.length === 0) {
      return {}
    }

    try {
      const url = `/api/cliparts?action=get_click_counts&assetIds=${assetIds.join(',')}&assetType=${assetType}`
      const res = await Http.get<{ clickCounts?: Record<string, number> }>(url, { preferCache: true })
      return res.data?.clickCounts || {}
    } catch (error) {
      console.error('[TemplatesService] Failed to fetch asset click counts:', error)
      return {}
    }
  },
}
