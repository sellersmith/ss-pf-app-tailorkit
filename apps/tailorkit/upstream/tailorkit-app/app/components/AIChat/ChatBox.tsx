import { Badge, Banner, BlockStack, Box, Card, Text, InlineStack, SkeletonBodyText, Button } from '@shopify/polaris'
import MessageList from './MessageList'
import { useTranslation } from 'react-i18next'
import type { ISuggestion } from './constants'
import { POST_RECOMMENDATION_SUGGESTIONS, SUGGESTIONS, TEMPLATE_EDITOR_SUGGESTIONS } from './constants'
import styles from './styles.module.css'
import { type FeedbackType } from '~/enums/conversationMessage'
import type { IMessageInput } from '~/routes/api.ai-assistant/constants'
import MessageInput from './components/MessageInput'
import SuggestionsList from './components/SuggestionsList'
import type { FileAttachment, MessageBlock, StatusBlock } from './fns'
import { useChatBot } from '~/providers/ChatBotContext'
import { useCallback, useMemo } from 'react'
import type { TemplateMentionData } from '~/hooks/useTemplateMention'
import { useAiCreditsStatus } from '~/hooks/useAiCreditsStatus'
import { MODAL_ID } from '~/constants/modal'
import { useModal } from '~/utils/hooks/useModal'
import { CUSTOM_AI_ASSISTANT_MARKDOWN_FORMAT } from '~/routes/api.ai-assistant/constants'

interface ChatBoxProps {
  currentConversationMessages: IMessageInput[]
  isConversationLoading: boolean
  isLoading: boolean
  streamingMessage: string
  streamingBlocks: MessageBlock[]
  currentStatus?: StatusBlock | null
  inputMessage: string
  suggestion: ISuggestion | null
  error: string | null
  onSuggestionClick: (suggestion: ISuggestion) => void
  handleKeyDown: (e: React.KeyboardEvent) => void
  handleInput: (value: string) => void
  handleSendFeedback: (messageId: string, feedback: FeedbackType | null) => Promise<void>
  renderSendButton: () => React.ReactNode
  onTemplateSelect?: (template: TemplateMentionData, allowMultiple?: boolean) => void
  onLayerSelect?: (payload: { layerId: string; layerName: string; templateId: string; cardId: string }) => void
  selectedTemplates?: TemplateMentionData[]
  onClearSelectedTemplate?: (cardId?: string) => void
  selectedLayer?: { templateId: string; layerId: string; layerName: string; cardId: string } | null
  onClearSelectedLayer?: () => void
  attachedFiles?: FileAttachment[]
  onFilesPick?: (files: File[]) => void
  onRemoveFile?: (url: string) => void
  isUploadingFiles?: boolean
  attachError?: string | null
  onClearAttachError?: () => void
  shopOwner?: string
}

export function ChatBox(props: ChatBoxProps) {
  const {
    currentConversationMessages,
    isConversationLoading,
    isLoading,
    streamingMessage,
    suggestion,
    inputMessage,
    error,
    streamingBlocks,
    currentStatus,
    onSuggestionClick,
    handleKeyDown,
    handleInput,
    handleSendFeedback,
    renderSendButton,
    onTemplateSelect,
    shopOwner,
  } = props

  const { t } = useTranslation()
  const { dynamicSuggestions } = useChatBot()
  const { hasCredits } = useAiCreditsStatus()
  const { openModal } = useModal()

  const handleBuyCredits = useCallback(() => {
    openModal(MODAL_ID.BUY_AI_CREDITS_MODAL, { isOpen: true })
  }, [openModal])

  // Only show AI credit exhausted banner when conversation contains image generation
  const hasImageGeneration = useMemo(() => {
    const { GENERATING_IMAGE, GENERATED_IMAGE } = CUSTOM_AI_ASSISTANT_MARKDOWN_FORMAT
    if (streamingMessage.includes(GENERATING_IMAGE) || streamingMessage.includes(GENERATED_IMAGE)) {
      return true
    }
    return currentConversationMessages.some(
      msg => msg.content?.includes(GENERATING_IMAGE) || msg.content?.includes(GENERATED_IMAGE)
    )
  }, [streamingMessage, currentConversationMessages])

  // Function to determine if suggestions should be shown
  const shouldShowSuggestions = useCallback(() => {
    // Show suggestions if there are no messages
    if (currentConversationMessages.length === 0) return true

    // Show suggestions if only the welcome message exists
    if (currentConversationMessages.length === 1) {
      const firstMessage = currentConversationMessages[0]
      return firstMessage?.metadata?.type === 'welcome'
    }

    return false
  }, [currentConversationMessages])

  // Function to check if product recommendations have been shown in the streaming blocks
  const isContainingProductRecommendations = useMemo(() => {
    return streamingBlocks.some(block => block.type === 'product_recommendation')
  }, [streamingBlocks])

  // Function to check if product recommendations have been shown in the messages
  const isContainingProductRecommendationsInMessage = useMemo(() => {
    return currentConversationMessages.some(
      message => message.content?.includes('[PRODUCT_CARD:') || message.metadata?.hasProductRecommendations
    )
  }, [currentConversationMessages])

  // Function to check if product recommendations have been shown
  const hasProductRecommendations = useCallback(() => {
    return isContainingProductRecommendations || isContainingProductRecommendationsInMessage
  }, [isContainingProductRecommendations, isContainingProductRecommendationsInMessage])

  const renderSuggestions = useMemo(() => {
    const isEmptyInputMessage = inputMessage.trim() === ''
    const hasDynamicSuggestions = dynamicSuggestions.length > 0
    const canShowSuggestions = shouldShowSuggestions()
    const hasMessages = currentConversationMessages.length > 0

    const shouldRenderDynamicSuggestions
      = isEmptyInputMessage && hasDynamicSuggestions && canShowSuggestions && hasMessages

    const shouldRenderPostRecommendationSuggestions
      = isEmptyInputMessage && hasProductRecommendations() && !isLoading && hasMessages

    let postSuggestions: ISuggestion[] = []
    if (shouldRenderPostRecommendationSuggestions) {
      postSuggestions = POST_RECOMMENDATION_SUGGESTIONS(t)
    }

    return (
      ((shouldRenderDynamicSuggestions && dynamicSuggestions.length > 0)
        || (shouldRenderPostRecommendationSuggestions && postSuggestions.length > 0)) && (
        <Box paddingBlockStart="200">
          {shouldRenderDynamicSuggestions && (
            <InlineStack gap={'200'} wrap align="start">
              {dynamicSuggestions.map(suggestion => (
                <Button key={suggestion.id} onClick={() => onSuggestionClick(suggestion)}>
                  {suggestion.label}
                </Button>
              ))}
            </InlineStack>
          )}

          {/* Post-recommendation suggestions */}
          {shouldRenderPostRecommendationSuggestions && postSuggestions.length > 0 && (
            <Box>
              <InlineStack gap={'200'}>
                {postSuggestions.map(suggestion => (
                  <Button key={suggestion.id} onClick={() => onSuggestionClick(suggestion)}>
                    {suggestion.label}
                  </Button>
                ))}
              </InlineStack>
            </Box>
          )}
        </Box>
      )
    )
  }, [
    currentConversationMessages,
    dynamicSuggestions,
    hasProductRecommendations,
    inputMessage,
    isLoading,
    onSuggestionClick,
    shouldShowSuggestions,
    t,
  ])

  return (
    <>
      {isConversationLoading ? (
        <MessageListSkeleton />
      ) : (
        <>
          <MessageList
            shopOwner={shopOwner}
            onSuggestionClick={onSuggestionClick}
            messages={currentConversationMessages}
            isLoading={isLoading}
            streamingMessage={streamingMessage}
            streamingBlocks={streamingBlocks}
            currentStatus={currentStatus}
            onFeedback={handleSendFeedback}
            renderSuggestions={renderSuggestions}
          />

          {!hasCredits && hasImageGeneration && (
            <Box padding={'200'}>
              <BlockStack gap="200">
                <Text as="p" variant="bodyMd">
                  {t('ai-image-generation-is-unavailable-your-ai-credits-have-been-exhausted')}
                </Text>
                <Button fullWidth onClick={handleBuyCredits}>
                  {t('buy-ai-credits')}
                </Button>
              </BlockStack>
            </Box>
          )}
        </>
      )}
      <div className={styles.ChatBoxFooter}>
        {error && (
          <Box padding={'050'}>
            <Box padding={'200'}>
              <Card padding={'0'}>
                <Banner tone="critical">{t('tailorkit-assistant-disconnected')}</Banner>
              </Card>
            </Box>
          </Box>
        )}

        {props.attachError && (
          <Box padding={'050'}>
            <Box padding={'200'}>
              <Banner tone="warning" onDismiss={props.onClearAttachError}>
                {props.attachError}
              </Banner>
            </Box>
          </Box>
        )}

        <MessageInput
          handleKeyDown={handleKeyDown}
          value={inputMessage}
          onChange={handleInput}
          renderSendButton={renderSendButton}
          onSuggestionClick={onSuggestionClick}
          baseSuggestion={suggestion}
          onTemplateSelect={onTemplateSelect}
          onLayerSelect={props.onLayerSelect}
          selectedTemplates={props.selectedTemplates}
          onClearSelectedTemplate={props.onClearSelectedTemplate}
          selectedLayer={props.selectedLayer}
          onClearSelectedLayer={props.onClearSelectedLayer}
          attachedFiles={props.attachedFiles}
          onFilesPick={props.onFilesPick}
          onRemoveFile={props.onRemoveFile}
          isUploadingFiles={props.isUploadingFiles}
        />
        <p style={{ fontSize: '11px', color: 'var(--p-color-text-subdued)', textAlign: 'center', margin: '4px 0 0' }}>
          {t('ai-can-make-mistakes')}
        </p>
      </div>
    </>
  )
}

interface HeaderChatBoxProps {
  shop_owner: string
  onSuggestionClick?: (suggestion: (typeof SUGGESTIONS)[number]) => void
  hasMessages?: boolean
}

export function HeaderChatBox(props: HeaderChatBoxProps) {
  const { onSuggestionClick, shop_owner, hasMessages = false } = props

  const { dynamicSuggestions } = useChatBot()

  const { t } = useTranslation()
  // const [searchParams] = useSearchParams()
  // const isOnboardingRoute = useMemo(() => searchParams.get('onboarding') === 'true', [searchParams])

  // Temporary disable onboarding route because we no longer start onboarding with AI
  const isOnboardingRoute = false

  const suggestionsToRender = useMemo(() => {
    return dynamicSuggestions.length > 0 ? dynamicSuggestions : SUGGESTIONS
  }, [dynamicSuggestions])

  if (isOnboardingRoute && hasMessages) {
    return (
      <BlockStack gap="100">
        <Text as="p" variant="bodyMd">
          {t('chat-bot-greeting', { shop_owner })}
        </Text>
        <Text as="p" variant="bodyMd">
          {t('im-elva-your-ai-assistant')}
        </Text>
        <Text as="p" variant="bodyMd">
          {t('what-is-your-preferred-way-to-create-a-personalized-product')}
        </Text>

        {suggestionsToRender.length > 0 && (
          <SuggestionsList suggestions={suggestionsToRender} onSuggestionClick={onSuggestionClick} />
        )}
      </BlockStack>
    )
  }

  if (hasMessages) {
    return null
  }

  return (
    <div style={{ display: 'flex', minHeight: '100%', alignItems: 'center', justifyContent: 'center' }}>
      <div className={styles.magicText}>
        <BlockStack gap={'300'} align="center" inlineAlign="center">
          {isOnboardingRoute ? (
            <>
              <Text as="h1" variant="headingMd" alignment="center">
                {t('chat-bot-greeting', { shop_owner })}
              </Text>
              <Text as="p" variant="headingMd" alignment="center">
                {t('im-elva-your-ai-assistant')}
              </Text>
              <Text as="p" variant="headingLg" alignment="center">
                {t('what-is-your-preferred-way-to-create-a-personalized-product')}
              </Text>
            </>
          ) : (
            <>
              {/* TailorKit logo with pulse animation */}
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img
                  className={styles.elvaIconCircle}
                  src="https://cdn.shopify.com/app-store/listing_images/958e5ec4440b11eb378c3c27a7a4097d/icon/CKPAh-fW_YYDEAE=.png"
                  alt="Elva AI"
                />
                {/* Beta badge overlapping top-right */}
                <div style={{ position: 'absolute', top: '-4px', right: '-12px' }}>
                  <Badge tone="success">Beta</Badge>
                </div>
              </div>

              {/* Personalized greeting */}
              <Box paddingBlockStart="200">
                <Text as="h2" variant="headingLg" alignment="center">
                  {t('chat-bot-greeting', { shop_owner })}
                </Text>
              </Box>
              <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
                {t('im-elva-ai-companion')}
              </Text>

              {/* Suggestion cards */}
              <Box paddingBlockStart="400" width="100%">
                <SuggestionsList
                  suggestions={TEMPLATE_EDITOR_SUGGESTIONS}
                  onSuggestionClick={onSuggestionClick}
                  layout="vertical"
                />
              </Box>
            </>
          )}
        </BlockStack>
      </div>
    </div>
  )
}

function MessageListSkeleton() {
  return (
    <div className={styles.chatMessages}>
      <Box padding={'200'}>
        <BlockStack gap={'400'}>
          {Array.from({ length: 6 }).map((_, index) =>
            index % 2 === 0 ? (
              <Box key={index} width="100%" background="bg-surface-secondary" padding="200" borderRadius="200">
                <div style={{ width: '100%', height: '40px' }} />
              </Box>
            ) : (
              <Box key={index} width="100%" padding="200">
                <SkeletonBodyText key={index} />
              </Box>
            )
          )}
        </BlockStack>
      </Box>
    </div>
  )
}
