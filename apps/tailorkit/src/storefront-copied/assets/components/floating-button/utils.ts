// Template and mockup utilities
import { APP_PROXY_PATH } from '../../constants'
import { fetchWithAdminContext } from '../../libraries/fetchWithAdminContext'

export const getMockupId = (): string | null => {
  const productPersonalizer = document.querySelector('tailorkit-product-personalizer')
  if (productPersonalizer) {
    const mockupData = productPersonalizer.getAttribute('data-mockup')
    if (mockupData) {
      try {
        // Decode HTML entities (&quot; -> ")
        const decodedData = mockupData.replace(/&quot;/g, '"').replace(/&amp;/g, '&')
        const parsedMockup = JSON.parse(decodedData)

        // Return the mockup ID
        const mockupId = parsedMockup?._id
        if (mockupId) {
          console.log('📍 Found mockup ID from data-mockup:', mockupId)
          return mockupId
        }
      } catch (error) {
        console.warn('⚠️ Failed to parse mockup data:', error)
      }
    }
  }
  return null
}

export const getTemplateIdFallback = (): string | null => {
  // Method 1: Try to get template ID from URL params
  const urlParams = new URLSearchParams(window.location.search)
  const templateId = urlParams.get('templateId') || urlParams.get('template_id')

  if (templateId) return templateId

  // Method 2: Try to get from global window object if available
  if ((window as any).__tailorkit__?.templateId) {
    return (window as any).__tailorkit__.templateId
  }

  // Method 3: Try to get from data attributes
  const templateElement = document.querySelector('[data-template-id]')
  if (templateElement) {
    return templateElement.getAttribute('data-template-id')
  }

  return null
}

export const extractTemplateIdFromMockup = async (mockupId: string): Promise<string | null> => {
  try {
    const mockupResponse = await fetchWithAdminContext(`${APP_PROXY_PATH}/app_proxy/mockups/${mockupId}`)
    if (mockupResponse.ok) {
      const mockupData = await mockupResponse.json()
      const templates = mockupData.denormalizedData?.templates || []
      if (templates.length > 0) {
        return templates[0]._id
      }
    }
  } catch (error) {
    console.warn('Could not extract template ID from mockup')
  }
  return null
}

// Message formatting utilities
export const formatSummaryMessage = (changes: string[]): string => {
  const changesList = changes.map(change => `• ${change.charAt(0).toUpperCase() + change.slice(1)}`).join('\n')

  return (
    `✨ **Personalization Complete!**\n\n`
    + `I've updated your design with:\n${changesList}\n\n`
    + `How does it look? Feel free to ask for any adjustments!`
  )
}

export const getChangesList = (recommendations: any[], textRecommendations: any[]): string[] => {
  const changes = []
  if (recommendations.some((r: any) => r.optionType === 'color_option')) changes.push('colors')
  if (recommendations.some((r: any) => r.optionType === 'font_option')) changes.push('fonts')
  if (recommendations.some((r: any) => r.optionType === 'image_option')) changes.push('images')
  if (recommendations.some((r: any) => r.optionType === 'text_option')) changes.push('text options')
  if (textRecommendations.length > 0) changes.push('text content')
  return changes
}
