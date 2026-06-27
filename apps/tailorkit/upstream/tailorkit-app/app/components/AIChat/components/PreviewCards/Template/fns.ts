import type { TemplateData } from '~/libs/langchain/agents/templates/services/TemplateComposer'

export const saveTemplateAiMessage = async (config: {
  templateData: TemplateData & { cardId: string }
  templateUrl: string
  messageContent: string
  aiMessageTemplateCreatedCount: number
  messageId: string
  saveAiMessage: (
    message: string,
    messageId: string,
    metadata?: Record<string, any>,
    isNewMessage?: boolean
  ) => Promise<void>
}) => {
  const { templateData, templateUrl, messageContent, saveAiMessage, aiMessageTemplateCreatedCount, messageId } = config
  const templateId = extractTemplateIdFromUrl(templateUrl)
  const _messageId = messageId || `template-created-${templateId}-${Date.now()}`

  await saveAiMessage(
    messageContent,
    _messageId,
    {
      type: 'template_created',
      templateData,
      clickCreateTemplateCount: aiMessageTemplateCreatedCount + 1,
    },
    aiMessageTemplateCreatedCount === 0
  )
}

/**
 * Extract integration ID from integration URL
 * URL format: /templates/{templateId}
 */
function extractTemplateIdFromUrl(url: string): string | null {
  try {
    // First try the modal format: /templates/{templateId}
    const match = url.match(/\/templates\/([^/?]+)/)
    if (match) {
      return match[1]
    }

    return null
  } catch (error) {
    console.warn('Failed to extract template ID from URL:', url, error)
    return null
  }
}
