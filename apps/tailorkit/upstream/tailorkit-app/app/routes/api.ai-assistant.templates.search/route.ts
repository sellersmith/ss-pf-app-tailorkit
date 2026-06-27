import type { ActionFunctionArgs } from '@remix-run/node'
import { authenticate } from '~/shopify/app.server'
import { json } from '~/bootstrap/fns/fetch.server'
import { catchAsync } from '~/utils/catchAsync'
import ConversationMessage from '~/models/ConversationMessage.server'
import { ConversationRole } from '~/enums/conversationMessage'
import { extractTemplateFromContent, normalizeTemplateId } from '~/utils/templateExtractor'

export const action = catchAsync(async ({ request }: ActionFunctionArgs) => {
  try {
    // Authenticate the request
    const {
      session: { shop },
    } = await authenticate.admin(request)

    const payload = await request.json()
    const { conversationId, query } = payload

    // Validate required fields
    if (!conversationId) {
      return json({ success: false, error: 'Missing required field: conversationId' }, { status: 400 })
    }

    // Search conversation messages for templates
    const searchResults = await ConversationMessage.searchByContent({
      shopDomain: shop,
      conversationId,
      query: query || 'TEMPLATE_DATA',
      role: ConversationRole.ASSISTANT,
      limit: 50, // Get more results to ensure we have enough templates after deduplication
    })

    const templates = [] as Array<{
      cardId: string
      templateId: string
      name: string
      dimension: { width: number; height: number; measurementUnit: string; resolution: number }
      previewUrl?: string
      layers?: Array<{ _id: string; label: string; type?: string }>
    }>
    const seenCardIds = new Set<string>()

    if (searchResults.messages) {
      // Process messages from newest to oldest
      const sortedMessages = searchResults.messages.sort(
        (a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
      )

      for (const message of sortedMessages) {
        const content = String(message.content || '')
        const parsed = extractTemplateFromContent(content)

        if (parsed?.data) {
          const templateRawId = String(parsed.data.cardId || parsed.data.templateId || parsed.cardId || '')
          const normalizedId = normalizeTemplateId(templateRawId)
          // Use templateRawId as cardId if it already has template_ prefix, otherwise add it
          const cardId = templateRawId.startsWith('template_') ? templateRawId : `template_${normalizedId}`

          // Only add if we haven't seen this cardId and it matches the search query
          if (normalizedId && !seenCardIds.has(cardId)) {
            const templateName = String(parsed.data.name || 'Untitled Template')

            // If query is provided, filter by name
            if (!query || templateName.toLowerCase().includes(query.toLowerCase())) {
              seenCardIds.add(cardId)
              const rawLayers: unknown[] = Array.isArray(parsed.data.layers) ? parsed.data.layers : []
              const layers = rawLayers
                .map((l: unknown) => {
                  const layer = l as { _id?: string; id?: string; label?: string; name?: string; type?: string }
                  const _id = String(layer?._id || layer?.id || '')
                  const label = String(layer?.label || layer?.name || '')
                  const type = layer?.type
                  return { _id, label, type }
                })
                .filter(l => l._id && l.label)
              templates.push({
                cardId,
                templateId: normalizedId,
                name: templateName,
                dimension: parsed.data.dimension || { width: 0, height: 0, measurementUnit: 'px', resolution: 300 },
                previewUrl: parsed.data.previewUrl || parsed.data.preview || undefined,
                layers,
              })
            }
          }
        }
      }
    }

    return json({ success: true, templates })
  } catch (error: any) {
    console.error('Error searching templates:', error)
    return json(
      {
        success: false,
        error: error?.message || 'Failed to search templates',
      },
      { status: 500 }
    )
  }
})
