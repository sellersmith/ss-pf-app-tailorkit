import { useCallback, useEffect, useState, useRef } from 'react'
import { authenticatedFetch } from '~/shopify/fns.client'
import { useChatBot } from '~/providers/ChatBotContext'
import { extractTemplateFromContent, normalizeTemplateId } from '~/utils/templateExtractor'
import type { TemplateData } from '~/libs/langchain/agents/templates/services/TemplateComposer'
import {
  DEFAULT_TEMPLATE_DIMENSION,
  TemplateEditorStore,
  getExtractedCompositeLayerStores,
} from '~/stores/modules/template'
import { useLocation } from '@remix-run/react'
import { isTemplateModalRoute } from '~/utils/shopify'

export interface TemplateMentionData extends Omit<TemplateData, 'layers' | 'metadata'> {
  cardId: string
  templateId: string
  /** Mark the template that is currently being edited in the Template Editor modal */
  isEditor?: boolean
  /** Layers parsed from conversation data or editor; undefined means unknown/not provided */
  layers?: Array<{ _id: string; label: string; type?: string }>
}

interface UseTemplateMentionResult {
  templates: TemplateMentionData[]
  loading: boolean
  error: string | null
  searchTemplates: (query: string) => void
  clearSearch: () => void
}

/**
 * Hook to search and filter templates from conversation messages for mention functionality
 * Templates are deduplicated by cardId with latest data taking precedence
 */
export function useTemplateMention(): UseTemplateMentionResult {
  const [templates, setTemplates] = useState<TemplateMentionData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { currentConversation } = useChatBot()
  const location = useLocation()

  // Debouncing state
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  /**
   * Internal search function that performs the actual search
   */
  const performSearch = useCallback(
    async (query: string = '', abortSignal?: AbortSignal) => {
      if (!currentConversation.id) {
        setTemplates([])
        setError(null)
        setLoading(false)
        return
      }

      try {
        // Extract templates from current conversation messages (no cache)
        let baseTemplates: TemplateMentionData[] = []
        const currentTemplatesMap = new Map<string, TemplateMentionData>()

        // Process current conversation messages from newest to oldest without sorting to avoid O(n log n)
        const messages = currentConversation.messages ?? []
        for (let i = messages.length - 1; i >= 0; i--) {
          const message = messages[i]
          if (message.role === 'assistant' && message.content) {
            const parsed = extractTemplateFromContent(message.content)
            if (parsed?.data) {
              const templateRawId = String(parsed.data.cardId || parsed.data.templateId || parsed.cardId || '')
              const normalizedId = normalizeTemplateId(templateRawId)
              const mapKey = normalizedId

              if (mapKey && !currentTemplatesMap.has(mapKey)) {
                const cardId = templateRawId.startsWith('template_') ? templateRawId : `template_${normalizedId}`
                const templateData: TemplateMentionData = {
                  cardId,
                  templateId: normalizedId,
                  name: String(parsed.data.name || 'Untitled Template'),
                  dimension: parsed.data.dimension || { width: 0, height: 0, measurementUnit: 'px', resolution: 300 },
                  previewUrl: parsed.data.previewUrl || undefined,
                  layers: Array.isArray(parsed.data.layers)
                    ? parsed.data.layers
                        .map((l: any) => ({
                          _id: String(l?._id || l?.id || ''),
                          label: String(l?.label || ''),
                          type: l?.type,
                          image: l?.image,
                        }))
                        .filter((l: any) => l._id && l.label)
                    : undefined,
                }
                currentTemplatesMap.set(mapKey, templateData)
              }
            }
          }
        }
        baseTemplates = Array.from(currentTemplatesMap.values())

        // If Template Editor is active, append current editor template as a selectable option
        try {
          const isInEditor = isTemplateModalRoute(location.pathname)
          const editorState = TemplateEditorStore.getState() as any

          if (isInEditor && editorState?._id) {
            const normalizedId = normalizeTemplateId(String(editorState._id))
            const editorCardId = `template_${normalizedId}`
            const editorEntry: TemplateMentionData = {
              cardId: editorCardId,
              templateId: normalizedId,
              name: String(editorState.name || 'Untitled Template'),
              dimension: editorState.dimension || DEFAULT_TEMPLATE_DIMENSION,
              previewUrl: editorState.previewUrl || undefined,
              isEditor: true,
              layers: getExtractedCompositeLayerStores()
                .map((store): any => store?.getState())
                .filter(
                  (
                    layer
                  ): layer is {
                    _id?: string
                    label?: string
                    type?: string
                    image?: { src: string; imageName: string }
                  } => Boolean(layer)
                )
                .map(l => ({ _id: String(l?._id || ''), label: String(l?.label), type: l?.type, image: l?.image }))
                .filter(l => l._id && l.label),
            }
            // Prefer editor entry as the latest state by merging on top of baseTemplates
            const baseMap = new Map(
              (baseTemplates ?? []).map(t => [normalizeTemplateId(String(t.templateId || t.cardId)), t])
            )
            baseMap.set(normalizedId, editorEntry)
            baseTemplates = Array.from(baseMap.values())
          }
        } catch {
          // No-op: store might not be initialized outside editor context
        }

        // If we have a search query, also search broader conversation database
        let allTemplates = [...(baseTemplates ?? [])]

        if (query.trim()) {
          try {
            // Search broader conversation messages database
            const res = await authenticatedFetch('/api/ai-assistant/templates/search', {
              method: 'POST',
              body: JSON.stringify({
                conversationId: currentConversation.id,
                query: query.trim(),
              }),
              signal: abortSignal,
              preferCache: true,
            })

            if (res?.success && Array.isArray(res.templates)) {
              const searchResults: TemplateMentionData[] = res.templates

              // Merge search results with current conversation templates (current takes precedence)
              const mergedMap = new Map(
                (baseTemplates ?? []).map(t => [normalizeTemplateId(String(t.templateId || t.cardId)), t])
              )

              for (const template of searchResults) {
                const key = normalizeTemplateId(String(template.templateId || template.cardId || ''))
                if (key && !mergedMap.has(key)) {
                  mergedMap.set(key, template)
                }
              }

              allTemplates = Array.from(mergedMap.values())
            }
          } catch (searchError) {
            if (!abortSignal?.aborted) {
              console.warn('Failed to search broader conversation database:', searchError)
            }
            // Continue with current conversation templates only
          }
        }

        // Filter by query if provided
        if (query.trim()) {
          const searchTerm = query.toLowerCase()
          allTemplates = allTemplates.filter(template => template.name.toLowerCase().includes(searchTerm))
        }

        if (!abortSignal?.aborted) {
          setTemplates(allTemplates)
          setError(null)
        }
      } catch (err) {
        if (!abortSignal?.aborted) {
          console.error('Error searching templates:', err)
          setError(err instanceof Error ? err.message : 'Failed to search templates')
          setTemplates([])
        }
      } finally {
        if (!abortSignal?.aborted) {
          setLoading(false)
        }
      }
    },
    [currentConversation.id, currentConversation.messages, location.pathname]
  )

  /**
   * Debounced search function - delays API calls to avoid multiple requests
   */
  const searchTemplates = useCallback(
    (query: string = '') => {
      // Cancel any existing timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }

      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      // Set loading state immediately for better UX
      setLoading(true)
      setError(null)

      // Debounce the search with 300ms delay
      debounceTimeoutRef.current = setTimeout(() => {
        // Create new abort controller for this request
        abortControllerRef.current = new AbortController()
        performSearch(query, abortControllerRef.current.signal)
      }, 300)
    },
    [performSearch]
  )

  /**
   * Clear search results
   */
  const clearSearch = useCallback(() => {
    setTemplates([])
    setError(null)
    setLoading(false)
  }, [])

  // Auto-search when conversation changes to get available templates
  useEffect(() => {
    if (currentConversation.id) {
      searchTemplates('')
    } else {
      clearSearch()
    }
  }, [currentConversation.id, searchTemplates, clearSearch])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cancel any pending timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }

      // Abort any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return {
    templates,
    loading,
    error,
    searchTemplates,
    clearSearch,
  }
}
