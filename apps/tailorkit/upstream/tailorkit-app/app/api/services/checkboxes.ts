import { Http } from '../core/httpClient'
import type { ApiResult } from '../types/common'
import { CHECKBOX_ACTIONS } from '~/routes/api.checkboxes/constants'

/**
 * Service for interacting with Checkbox API.
 * Handles bulk actions for checkbox management.
 */
export const CheckboxService = {
  /**
   * Duplicate selected checkboxes
   */
  async duplicate(checkboxIds: string[]): Promise<ApiResult<Record<string, unknown>>> {
    const formData = new FormData()
    formData.append('action', CHECKBOX_ACTIONS.DUPLICATE)
    formData.append('checkboxIds', JSON.stringify(checkboxIds))

    const res = await Http.post<ApiResult<Record<string, unknown>>, FormData>('/api/checkboxes', formData)
    return (res.data || { success: false, message: 'unknown' }) as ApiResult<Record<string, unknown>>
  },

  /**
   * Delete selected checkboxes (soft delete)
   */
  async deleteMany(checkboxIds: string[]): Promise<ApiResult<Record<string, unknown>>> {
    const formData = new FormData()
    formData.append('action', CHECKBOX_ACTIONS.DELETE)
    formData.append('checkboxIds', JSON.stringify(checkboxIds))

    const res = await Http.post<ApiResult<Record<string, unknown>>, FormData>('/api/checkboxes', formData)
    return (res.data || { success: false, message: 'unknown' }) as ApiResult<Record<string, unknown>>
  },

  /**
   * Activate selected checkboxes
   */
  async activate(checkboxIds: string[]): Promise<ApiResult<Record<string, unknown>>> {
    const formData = new FormData()
    formData.append('action', CHECKBOX_ACTIONS.ACTIVATE)
    formData.append('checkboxIds', JSON.stringify(checkboxIds))

    const res = await Http.post<ApiResult<Record<string, unknown>>, FormData>('/api/checkboxes', formData)
    return (res.data || { success: false, message: 'unknown' }) as ApiResult<Record<string, unknown>>
  },

  /**
   * Deactivate selected checkboxes
   */
  async deactivate(checkboxIds: string[]): Promise<ApiResult<Record<string, unknown>>> {
    const formData = new FormData()
    formData.append('action', CHECKBOX_ACTIONS.DEACTIVATE)
    formData.append('checkboxIds', JSON.stringify(checkboxIds))

    const res = await Http.post<ApiResult<Record<string, unknown>>, FormData>('/api/checkboxes', formData)
    return (res.data || { success: false, message: 'unknown' }) as ApiResult<Record<string, unknown>>
  },
}
