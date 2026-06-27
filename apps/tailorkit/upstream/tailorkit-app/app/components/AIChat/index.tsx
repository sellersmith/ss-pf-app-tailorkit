import { Button, Icon, Tooltip } from '@shopify/polaris'
import { SendIcon, StopCircleIcon } from '@shopify/polaris-icons'
import { t } from 'i18next'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ShopDocument } from '~/models/Shop'
import { useChatBot } from '~/providers/ChatBotContext'
import { ChatBox } from './ChatBox'
import { ComponentErrorBoundary, ErrorBoundaryFallback } from '~/components/ErrorBoundary'
import type { ISuggestion, SUGGESTIONS } from './constants'
import styles from './styles.module.css'
import { authenticatedFetch } from '~/shopify/fns.client'
import type { FeedbackType } from '~/enums/conversationMessage'
import { ConversationRole } from '~/enums/conversationMessage'
import {
  createMessage,
  processStreamResponseWithStatus,
  sendAIRequest,
  validateInput,
  getMessageContent,
  parseBlocksFromRawString,
  type FileAttachment,
  type MessageBlock,
  type StatusBlock,
} from './fns'
import { validateImageFile } from '~/utils/image-validation'
import type { TemplateMentionData } from '~/hooks/useTemplateMention'
import { uuid } from '~/utils/uuid'
import { buildPrebuiltPrintAreas } from '~/modules/ProductEditor/utilities/prebuiltPrintAreas'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { GLOBAL_EVENTS_TRANSMITTER } from '~/constants/events-transmitter'
// import { NotificationViewing } from './components/NotificationViewing'
// ONE_SECOND_IN_MILLISECONDS removed — scrollToLatest eliminated
import { buildChatRequestContext } from './context/buildContext'
import { useTemplateMention } from '~/hooks/useTemplateMention'
import { useSyncSelectedMentions } from '~/components/AIChat/context/useSyncSelectedMentions'
import ProductSelector from '~/modules/ProductSelector'
import { useNavigate } from '@remix-run/react'
import { createCustomTextTemplate } from './fns/createCustomTextTemplate'
import { savePublishProductAiMessage } from '~/utils/integration/productIntegrationBuilder'
import { markAiOnboardingCompleted } from '~/modules/Onboarding/utilities/saveUserJourneyProgress'
import useInitIntegration from '~/modules/ProductEditor/hooks/useInitIntegration'
import { trackEventStartCreateProduct } from '~/routes/personalized-products._index/fns/eventTracking'
import type { IProduct, IVariant } from '~/types/shopify-product'
import { useFeatureTracking } from '~/hooks/useFeatureTracking'
import { useIsUnifiedEditor } from '~/hooks/useIsUnifiedEditor'
import { TemplateEditorStore } from '~/stores/modules/template'

interface AIChatProps {
  isOpen: boolean
  shopData: ShopDocument
}

// const DELAY_ANALYSIS_CONVERSATION = 200

// Optimized chat state management
interface ChatState {
  inputMessage: string
  error: string | null
  streamingMessage: string
  streamingBlocks: MessageBlock[]
  isLoading: boolean
  currentStatus: StatusBlock | null
  selectedTemplates: TemplateMentionData[]
  showProductSelector: boolean
  selectedLayer: { templateId: string; layerId: string; layerName: string; cardId: string } | null
  attachedFiles: FileAttachment[]
  isUploadingFiles: boolean
  attachError: string | null
}

const initialChatState: ChatState = {
  inputMessage: '',
  error: null,
  streamingMessage: '',
  streamingBlocks: [],
  isLoading: false,
  currentStatus: null,
  selectedTemplates: [],
  showProductSelector: false,
  selectedLayer: null,
  attachedFiles: [],
  isUploadingFiles: false,
  attachError: null,
}

export function AIChat(props: AIChatProps) {
  const { isOpen, shopData } = props
  const shop_owner = shopData.shopConfig.shop_owner

  const {
    selectedPreMadeSuggestion,
    currentConversation,
    isConversationLoading,
    addMessage,
    saveAiMessage,
    // analysisConversation,
  } = useChatBot()

  // Consolidated state management
  const [chatState, setChatState] = useState<ChatState>(initialChatState)
  const abortControllerRef = useRef<AbortController | null>(null)
  const { trackEvent } = useEventsTracking()
  const elvaTracking = useFeatureTracking('ai_assistant')
  const elvaAiTracking = useFeatureTracking('elva_ai')
  const { templates: mentionTemplates } = useTemplateMention()
  const navigate = useNavigate()
  const { prepareVariantsSelected } = useInitIntegration()
  const isUnifiedEditor = useIsUnifiedEditor()

  // Optimized state updaters
  const updateChatState = useCallback((updates: Partial<ChatState>) => {
    setChatState(prev => ({ ...prev, ...updates }))
  }, [])

  // Memoized computed values
  const conversationId = useMemo(() => currentConversation?.id || '', [currentConversation?.id])
  const currentConversationMessages = useMemo(
    () => currentConversation?.messages || [],
    [currentConversation?.messages]
  )
  const isValidInput = useMemo(
    () => chatState.inputMessage.trim() || selectedPreMadeSuggestion?.id,
    [chatState.inputMessage, selectedPreMadeSuggestion]
  )

  // Auto-inject current editor template as implicit context (no @mention needed)
  useEffect(() => {
    if (!isUnifiedEditor) return
    if (chatState.selectedTemplates.length > 0) return
    const editorState = TemplateEditorStore.getState() as { _id?: string; name?: string; previewUrl?: string }
    if (!editorState?._id) return
    updateChatState({
      selectedTemplates: [
        {
          templateId: editorState._id,
          name: editorState.name || 'Current template',
          cardId: `editor-${editorState._id}`,
          isEditor: true,
          previewUrl: editorState.previewUrl,
        } as TemplateMentionData,
      ],
    })
  }, [isUnifiedEditor, updateChatState]) // eslint-disable-line react-hooks/exhaustive-deps

  // Compute request context from selections
  const requestContext = useMemo(
    () =>
      buildChatRequestContext({
        selectedTemplates: chatState.selectedTemplates,
        selectedLayer: chatState.selectedLayer
          ? { templateId: String(chatState.selectedLayer.templateId), layerId: String(chatState.selectedLayer.layerId) }
          : undefined,
      }),
    [chatState.selectedTemplates, chatState.selectedLayer]
  )

  /**
   * Optimized message sending logic
   */
  const handleSendMessage = useCallback(
    async (suggestionSelected?: (typeof SUGGESTIONS)[number] | null) => {
      // Validate input
      const _suggestion = suggestionSelected || selectedPreMadeSuggestion
      const trimmedMessage = chatState.inputMessage.trim()
      const _inputMessage = getMessageContent(_suggestion, trimmedMessage)

      if (!validateInput(chatState.isLoading, _inputMessage, _suggestion)) return

      updateChatState({
        error: null,
        isLoading: true,
        inputMessage: '',
      })

      try {
        const userMessageId = uuid()
        const assistantMessageId = uuid()

        // Add user message if exists
        if (_inputMessage) {
          const userMessage = createMessage({
            id: userMessageId,
            content: _inputMessage,
            role: ConversationRole.USER,
            timestamp: new Date(),
            feedback: null,
            // Attach lightweight metadata so UI can render selected template chips like ChatGPT attachments
            metadata: {
              attachments: {
                templates: chatState.selectedTemplates.map(t => ({
                  templateId: String(t.templateId),
                  name: String(t.name || ''),
                })),
              },
            },
          })
          addMessage(userMessage)
        }

        // Setup request
        abortControllerRef.current = new AbortController()

        // Send request with normalized context built by context enrichers
        const enrichedContext = requestContext

        const response = await sendAIRequest({
          message: _inputMessage,
          conversationHistory: currentConversationMessages,
          conversationId,
          suggestionId: _suggestion?.id || '',
          userMessageId,
          assistantMessageId,
          context: enrichedContext,
          userMetadata: {
            attachments: {
              templates: chatState.selectedTemplates.map(t => ({
                templateId: String(t.templateId),
                name: String(t.name || ''),
                previewUrl: t.previewUrl || undefined,
                isEditor: Boolean(t.isEditor),
              })),
              layers: chatState.selectedLayer
                ? [
                    {
                      templateId: String(chatState.selectedLayer.templateId),
                      layerId: String(chatState.selectedLayer.layerId),
                      layerName: String(chatState.selectedLayer.layerName),
                      cardId: String(chatState.selectedLayer.cardId),
                    },
                  ]
                : [],
              // Images uploaded via paperclip — server injects as UIMessage file parts for vision.
              files: chatState.attachedFiles.map(f => ({ url: f.url, mediaType: f.mediaType, name: f.name })),
            },
          },
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          throw new Error('Failed to get AI response')
        }

        // Handle stream response
        const reader = response.body?.getReader()
        if (!reader) throw new Error('No response stream available')

        // Clear previous status
        updateChatState({ currentStatus: null })

        const accumulatedContent = await processStreamResponseWithStatus(
          reader,
          streamingMessage => {
            // Parse streaming content into blocks to filter out PRODUCT_DATA lines
            const parsedBlocks = parseBlocksFromRawString(streamingMessage)
            updateChatState({
              streamingMessage,
              streamingBlocks: parsedBlocks,
            })
          },
          status => {
            // Clear status if it's a completion marker or empty message
            if (status.agent === 'complete' || status.message === '') {
              updateChatState({ currentStatus: null })
            } else {
              updateChatState({ currentStatus: status })
            }
          }
        )

        // Clear status when done
        updateChatState({ currentStatus: null })

        // Temporary disabled analysis conversation
        // setTimeout(() => {
        //   // Analyze conversation
        //   const assistantMessage = createMessage({
        //     id: assistantMessageId,
        //     content: accumulatedContent,
        //     role: ConversationRole.ASSISTANT,
        //     timestamp: new Date(),
        //     feedback: null,
        //   })
        //   analysisConversation([assistantMessage])
        // }, DELAY_ANALYSIS_CONVERSATION)

        // Add final message
        const assistantMessage = createMessage({
          id: assistantMessageId,
          content: accumulatedContent,
          role: ConversationRole.ASSISTANT,
          timestamp: new Date(),
          feedback: null,
        })

        addMessage(assistantMessage)
        updateChatState({
          streamingMessage: '',
          streamingBlocks: [],
          attachedFiles: [],
        })
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('Request was cancelled')
        } else {
          console.error('Error sending message:', error)
          const message = error instanceof Error ? error.message : 'Failed to get AI response'
          updateChatState({ error: message })
        }
      } finally {
        updateChatState({
          isLoading: false,
          currentStatus: null,
        })
        abortControllerRef.current = null
      }
    },
    [
      selectedPreMadeSuggestion,
      chatState.inputMessage,
      chatState.isLoading,
      chatState.selectedTemplates,
      chatState.selectedLayer,
      chatState.attachedFiles,
      updateChatState,
      currentConversationMessages,
      requestContext,
      conversationId,
      addMessage,
    ]
  )

  /** Upload picked images to S3, surface as attachment chips. */
  const handleFilesPick = useCallback(
    async (files: File[]) => {
      const valid: File[] = []
      const invalidMessages: string[] = []
      for (const f of files) {
        const v = validateImageFile(f)
        if (!v.valid) {
          invalidMessages.push(v.errorMessage || `${f.name}: invalid image`)
          continue
        }
        valid.push(f)
      }
      if (invalidMessages.length > 0) {
        updateChatState({ attachError: invalidMessages.join(' · ') })
      }
      if (valid.length === 0) return
      updateChatState({ isUploadingFiles: true })
      try {
        const fd = new FormData()
        valid.forEach(f => fd.append('files', f))
        // authenticatedFetch returns already-parsed JSON (or null), not a Response.
        const data = await authenticatedFetch('/api/ai-assistant', { method: 'POST', body: fd })
        if (!data?.success || !Array.isArray(data.urls)) {
          throw new Error(data?.error || 'Upload failed')
        }
        const uploaded: FileAttachment[] = data.urls.map((url: string, i: number) => ({
          url,
          mediaType: valid[i]?.type || 'image/png',
          name: valid[i]?.name || 'image',
        }))
        setChatState(prev => ({ ...prev, attachedFiles: [...prev.attachedFiles, ...uploaded], attachError: null }))
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Image upload failed'
        updateChatState({ attachError: message })
      } finally {
        updateChatState({ isUploadingFiles: false })
      }
    },
    [updateChatState]
  )

  const handleClearAttachError = useCallback(() => updateChatState({ attachError: null }), [updateChatState])

  const handleRemoveFile = useCallback((url: string) => {
    setChatState(prev => ({ ...prev, attachedFiles: prev.attachedFiles.filter(f => f.url !== url) }))
  }, [])

  /**
   * Optimized input handling
   */
  const handleInput = useCallback(
    (value: string) => {
      updateChatState({ inputMessage: value })
    },
    [updateChatState]
  )

  /**
   * Handle key events
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSendMessage()

        // Track the send message event
        trackEvent(EVENTS_TRACKING.AI_CHAT_SEND_MESSAGE, {
          message: chatState.inputMessage,
        })
      }
    },
    [chatState.inputMessage, handleSendMessage, trackEvent]
  )

  /**
   * Cancel current request
   */
  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      updateChatState({
        isLoading: false,
        currentStatus: null,
      })
    }
  }, [updateChatState])

  /**
   * Handle suggestion clicks
   */
  const onSuggestionClick = useCallback(
    (_suggestion: ISuggestion) => {
      // Check if this is a special action suggestion
      if (_suggestion.action === 'open_product_selector_with_custom_text') {
        // Track the suggestion click event
        trackEvent(EVENTS_TRACKING.AI_CHAT_SUGGESTION_CLICK, {
          suggestion: _suggestion.label,
        })

        // Open the product selector modal with custom text template creation
        updateChatState({ showProductSelector: true })
        return
      }

      const inputMessage = t(_suggestion.content)
      // Track the suggestion click event
      trackEvent(EVENTS_TRACKING.AI_CHAT_SUGGESTION_CLICK, {
        suggestion: inputMessage,
      })
      elvaTracking.trackAction('suggestion_clicked', { suggestion_id: _suggestion.id })

      updateChatState({ inputMessage })
    },
    [trackEvent, updateChatState, elvaTracking]
  )

  /**
   * Handle template selection from mention functionality
   */
  const handleTemplateSelect = useCallback(
    (template: TemplateMentionData, allowMultiple?: boolean) => {
      setChatState(prev => {
        const exists = prev.selectedTemplates.some(t => t.cardId === template.cardId)

        if (exists) {
          return prev // Template already selected
        }

        if (allowMultiple === false) {
          // Replace existing template with the new one (single mode)
          return { ...prev, selectedTemplates: [template] }
        }

        // Add to existing templates (multiple mode, default)
        return { ...prev, selectedTemplates: [...prev.selectedTemplates, template] }
      })

      // Track the template selection event
      trackEvent(EVENTS_TRACKING.AI_CHAT_SEND_MESSAGE, {
        templateId: template.templateId,
        templateName: template.name,
      })
    },
    [trackEvent]
  )

  const handleClearSelectedTemplate = useCallback((cardId?: string) => {
    if (!cardId) {
      setChatState(prev => ({ ...prev, selectedTemplates: [], selectedLayer: null }))
      return
    }
    setChatState(prev => ({
      ...prev,
      selectedTemplates: prev.selectedTemplates.filter(t => t.cardId !== cardId),
      selectedLayer: prev.selectedLayer && prev.selectedLayer.cardId === cardId ? null : prev.selectedLayer,
    }))
  }, [])

  /**
   * Handle ProductSelector modal close
   */
  const handleCloseProductSelector = useCallback(() => {
    updateChatState({ showProductSelector: false })
  }, [updateChatState])

  /**
   * Handle product selection and create integration
   */
  const handleProductSelection = useCallback(
    async (_products: IProduct[], selectedVariants: IVariant[]) => {
      try {
        // Mark AI onboarding completed and then navigate out of onboarding
        await markAiOnboardingCompleted()

        updateChatState({ showProductSelector: false })

        // Track the start create product event
        trackEventStartCreateProduct(trackEvent)

        // Create custom text template data for the integration
        const templateData = await createCustomTextTemplate()

        // Prepare variants with template using the proper integration mechanism
        const integrationId = uuid()

        // Build prebuilt print areas map for stable IDs in URL and generator
        const { prebuiltPrintAreasByVariantId, selectedPrintAreaId } = buildPrebuiltPrintAreas(selectedVariants as any)

        const integrationUrl = await prepareVariantsSelected({
          variants: selectedVariants,
          integrationId,
          template: templateData,
          prebuiltPrintAreasByVariantId,
          selectedPrintAreaId,
        })

        // Save AI message for this integration
        await savePublishProductAiMessage({
          integrationUrl,
          productTitle: selectedVariants[0]?.product?.title || 'Custom Text Product',
          templateTitle: templateData.name || 'Custom Text Template',
          messageContent: t('ai-chat-product-recommendation-card-success-message'),
          saveAiMessage,
        })

        // Navigate to the integration
        navigate(integrationUrl)
      } catch (error) {
        console.error('Error creating custom text product integration:', error)
        updateChatState({ error: 'Failed to create custom text product. Please try again.' })
      }
    },
    [updateChatState, navigate, saveAiMessage, trackEvent, prepareVariantsSelected]
  )

  // Generic syncing for selected mentions using registered resolvers (templates here, extensible for others)
  const templateResolver = useMemo(() => {
    const byId = new Map<string, (typeof mentionTemplates)[number]>()
    for (const tpl of mentionTemplates) byId.set(String(tpl.templateId), tpl)
    return (sel: any) => {
      const latest = byId.get(String((sel as any)?.templateId))
      if (!latest) return undefined
      return {
        name: latest.name,
        previewUrl: latest.previewUrl,
        isEditor: latest.isEditor,
      }
    }
  }, [mentionTemplates])

  useSyncSelectedMentions<{
    cardId: string
    name: string
    previewUrl?: string
    isEditor?: boolean
    templateId: string
  }>({
    selected: chatState.selectedTemplates as any,
    setSelected: (next: any[]) => setChatState(prev => ({ ...prev, selectedTemplates: next as any })),
    resolvers: [templateResolver],
  })

  /**
   * Optimized feedback handling
   */
  const handleSendFeedback = useCallback(
    async (messageId: string, feedback: FeedbackType | null) => {
      if (!messageId) return

      await authenticatedFetch(`/api/ai-assistant/${messageId}/feedback`, {
        method: 'POST',
        body: JSON.stringify({ feedback }),
      })

      // Send event to mixpanel
      trackEvent(EVENTS_TRACKING.AI_CHAT_FEEDBACK, {
        type: feedback,
        message: currentConversationMessages.find(message => message.id === messageId)?.content,
      })
    },
    [trackEvent, currentConversationMessages]
  )

  // Set up event listeners
  useEffect(() => {
    const onSetChatBotInputMessage = (eventObject: any) => {
      const prompt = eventObject.data.prompt

      updateChatState({ inputMessage: prompt })
    }

    Transmitter.listen(GLOBAL_EVENTS_TRANSMITTER.SET_CHAT_BOT_INPUT_MESSAGE, onSetChatBotInputMessage)

    return () => {
      Transmitter.remove(GLOBAL_EVENTS_TRANSMITTER.SET_CHAT_BOT_INPUT_MESSAGE, onSetChatBotInputMessage)
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [updateChatState])

  // Auto-submit event listener for new user onboarding
  useEffect(() => {
    const handleAutoSubmit = (event: CustomEvent) => {
      const { content } = event.detail
      if (content && !chatState.isLoading) {
        // Track the auto-send event
        trackEvent(EVENTS_TRACKING.AI_ONBOARDING_AUTO_SEND_PROMPT)

        // Submit the message
        handleSendMessage().catch(console.error)
      }
    }

    document.addEventListener('autoSubmitChatPrompt', handleAutoSubmit as EventListener)

    return () => {
      document.removeEventListener('autoSubmitChatPrompt', handleAutoSubmit as EventListener)
    }
  }, [handleSendMessage, chatState.isLoading, trackEvent])

  // Scroll to bottom on chat open or when conversation changes
  useEffect(() => {
    if (isOpen) {
      elvaTracking.trackAction('chat_opened')
      elvaAiTracking.trackStarted()
    }
  }, [isOpen, currentConversation.id, updateChatState, elvaTracking, elvaAiTracking])

  const renderSendButton = () => {
    return (
      <div id="ai-onboarding-send-message" className={isValidInput ? styles.SendButtonContainerActive : ''}>
        {chatState.isLoading ? (
          <Tooltip content={t('stop-generating')}>
            <Button variant="plain" icon={<Icon source={StopCircleIcon} tone="success" />} onClick={handleCancel} />
          </Tooltip>
        ) : (
          <Tooltip content={t('send')}>
            <Button
              variant="plain"
              icon={<Icon source={SendIcon} tone="success" />}
              onClick={handleSendMessage}
              disabled={!isValidInput}
            />
          </Tooltip>
        )}
      </div>
    )
  }

  // if (!isOpen) return null

  return (
    <div className={styles.ChatBoxContainer}>
      <ComponentErrorBoundary fallback={<ErrorBoundaryFallback />}>
        <ChatBox
          shopOwner={shop_owner}
          suggestion={selectedPreMadeSuggestion}
          currentConversationMessages={currentConversationMessages}
          isConversationLoading={isConversationLoading}
          isLoading={chatState.isLoading}
          streamingMessage={chatState.streamingMessage}
          streamingBlocks={chatState.streamingBlocks}
          currentStatus={chatState.currentStatus}
          inputMessage={chatState.inputMessage}
          error={chatState.error}
          onSuggestionClick={onSuggestionClick}
          handleKeyDown={handleKeyDown}
          handleInput={handleInput}
          handleSendFeedback={handleSendFeedback}
          renderSendButton={renderSendButton}
          onTemplateSelect={handleTemplateSelect}
          onLayerSelect={payload => setChatState(prev => ({ ...prev, selectedLayer: payload }))}
          selectedTemplates={chatState.selectedTemplates}
          onClearSelectedTemplate={handleClearSelectedTemplate}
          selectedLayer={chatState.selectedLayer}
          onClearSelectedLayer={() => setChatState(prev => ({ ...prev, selectedLayer: null }))}
          attachedFiles={chatState.attachedFiles}
          onFilesPick={handleFilesPick}
          onRemoveFile={handleRemoveFile}
          isUploadingFiles={chatState.isUploadingFiles}
          attachError={chatState.attachError}
          onClearAttachError={handleClearAttachError}
        />
      </ComponentErrorBoundary>

      {/* ProductSelector Modal for Custom Text Product */}
      <ProductSelector
        open={chatState.showProductSelector}
        onClose={handleCloseProductSelector}
        onSelect={handleProductSelection}
        multiple={false}
        defaultSource="existing"
      />
    </div>
  )
}
