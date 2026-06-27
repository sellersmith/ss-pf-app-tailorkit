import type { Params } from '@remix-run/react'
import { NavMenuItems } from '~/bootstrap/app-config'
import { EActionType } from '~/constants/fetcher-keys'
import type { PrintArea } from '~/types/integration'
import { buildUrlWithParams } from '~/utils/buildUrlWithParams'
import { sendMessageToMainApp } from '~/utils/modalEvents'

/**
 * Get essential attributes of template for print area
 * @param template - The template to get the essential attributes from
 * @returns The essential attributes of the template
 */
export function getEssentialAttributesOfTemplateForPrintArea(template: PrintArea['template']) {
  if (!template || typeof template === 'string') {
    return null
  }

  return {
    _id: template._id,
    shopDomain: template.shopDomain,
    dimension: template.dimension,
    name: template.name,
    previewUrl: template.previewUrl,
    updatedAt: template.updatedAt,
  }
}

/**
 * Navigate to the template creation page in the max modal
 * @param searchParams - The search parameters from the URL
 * @param params - The parameters from the URL
 * @param templateId - The ID of the template to navigate to
 */
export function navigateToTemplateMaxModal(
  searchParams: URLSearchParams,
  params: Readonly<Params<string>>,
  templateId: string,
  printAreaId: string,
  autoOpenChatBot?: boolean,
  currentConversationId?: string,
  autoSelectFirstLayer?: boolean
) {
  const integrationId = params.id
  const mockupId = searchParams.get('mockup')
  const fallbackUrl = buildUrlWithParams(`${NavMenuItems.INTEGRATIONS}/${integrationId}`, {
    mockup: mockupId,
    printArea: printAreaId,
  })

  // Ignore autoOpenChatBot param to prevent auto-opening the chat
  const withCurrentConversationId = currentConversationId ? `&currentConversationId=${currentConversationId}` : ''
  const withAutoSelectFirstLayer = autoSelectFirstLayer ? `&autoSelectFirstLayer=${autoSelectFirstLayer}` : ''

  // Send message to main app to navigate to the template creation page
  sendMessageToMainApp(
    JSON.stringify({
      type: EActionType.NAVIGATE_MAX_MODAL,
      // eslint-disable-next-line max-len
      url: `/templates/${templateId}?source=form&content=${templateId}${withCurrentConversationId}${withAutoSelectFirstLayer}&fallback-url=${encodeURIComponent(fallbackUrl)}`,
    })
  )
}
