import { showGenericErrorToast } from '../toastEvents'

/**
 * Clone a clipart template to the user's own account
 * @param templateId - The ID of the clipart template to clone
 * @returns Promise that resolves with the cloning result
 */
export async function duplicateClipartTemplate(templateId: string): Promise<{
  success: boolean
  data?: {
    templateId: string
    templateName: string
    isFirstTemplate: boolean
  }
  message?: string
}> {
  try {
    const response = await fetch('/api/templates?action=cloneClipartToTemplate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ clipartId: templateId }),
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.message || 'Failed to clone clipart template')
    }

    if (result.success && result.data) {
      return result
    }

    throw new Error('Unexpected response format')
  } catch (error) {
    console.error('Error cloning clipart template:', error)

    // Optional: Show error notification to user
    if (typeof window !== 'undefined' && window.shopify?.toast) {
      showGenericErrorToast()
    }

    throw error
  }
}
