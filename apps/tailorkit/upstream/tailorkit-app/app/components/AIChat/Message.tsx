import { Avatar, Box, Icon, InlineStack, Text, Tooltip, BlockStack } from '@shopify/polaris'
import ReactMarkdown from 'react-markdown'
import { COMMON_ICONS } from '~/constants/assets-url'
import { PersonFilledIcon, ThumbsUpIcon, ThumbsDownIcon } from '@shopify/polaris-icons'
import styles from './styles.module.css'
import { memo, useCallback, useState, useEffect, useMemo } from 'react'
import type { ConversationMessageDocument } from '~/models/ConversationMessage'
import { FeedbackType, ConversationRole } from '~/enums/conversationMessage'
import { useTranslation } from 'react-i18next'
import { CHAT_BOT_DRAWER_TOOLTIP_Z_INDEX } from '../ChatBotDrawer/constants'
import type { MessageBlock, StatusBlock, ProductRecommendationBlock, TemplateCreationBlock, EventBlock } from './fns'
import {
  isProductRecommendationBlock,
  isTemplateCreationBlock,
  isSkillResultBlock,
  isEventBlock,
  isTextBlock,
  isHumanSupportBlock,
} from './fns'
import CustomMarkdown from './CustomMarkdown'
import StatusMessage from './StatusMessage'
import ProductRecommendationCard from './ProductRecommendationCard'
import { TemplatePreviewCard } from './components/PreviewCards/Template'
import { OptionSetPreviewCard } from './components/PreviewCards/OptionSetPreview'
import { PlanPreviewCard } from './components/PreviewCards/PlanPreview'
import ActionCardRenderer from './ActionCardRenderer'
import { NeedHumanSupportCard } from './components/PreviewCards/NeedHumanSupportCard'

export interface MessageProps {
  message: ConversationMessageDocument & { streamingBlocks: MessageBlock[] }
  index: number
  onFeedback?: (messageId: string, feedback: FeedbackType | null) => Promise<void>
  currentStatus?: StatusBlock
  isLastMessage?: boolean
}

/**
 * The minimum height for the last message to prevent the chat box from jumping when the user sends a message
 */
const MIN_HEIGHT_FOR_LAST_MESSAGE = 'calc(var(--drawer-max-height) - var(--chat-box-container-height))'

/** Renders user message with /command styled as a distinct badge */
function UserMessageWithCommand({ content }: { content: string }) {
  const match = content.match(/^(\/\S+)\s*([\s\S]*)/)
  if (!match) return <Text as="p">{content}</Text>

  const [, command, rest] = match
  return (
    <BlockStack gap="100">
      <span
        style={{
          display: 'inline-block',
          background: 'var(--p-color-bg-fill-info)',
          color: 'var(--p-color-text-info-on-bg-fill)',
          borderRadius: 'var(--p-border-radius-100)',
          padding: '2px 8px',
          fontSize: '13px',
          fontWeight: 600,
          fontFamily: 'var(--p-font-family-mono)',
          width: 'fit-content',
        }}
      >
        {command}
      </span>
      {rest.trim() && <Text as="p">{rest.trim()}</Text>}
    </BlockStack>
  )
}

// Optimized block processor with better separation of concerns
class BlockProcessor {
  private productBlocks = new Map<string, ProductRecommendationBlock>()
  private templateBlocks = new Map<string, TemplateCreationBlock>()
  private processedEvents = new Set<string>()

  processBlocks(blocks: MessageBlock[]): {
    productBlocks: Map<string, ProductRecommendationBlock>
    templateBlocks: Map<string, TemplateCreationBlock>
    renderableBlocks: MessageBlock[]
  } {
    const renderableBlocks: MessageBlock[] = []

    for (const block of blocks) {
      if (isEventBlock(block)) {
        if (block.eventName === 'product_data_update') {
          this.processProductDataEvent(block)
          continue
        }
        if (block.eventName === 'template_data_update') {
          this.processTemplateDataEvent(block)
          continue
        }
        continue
      }

      // Keep human support blocks for rendering (CTA)
      if (isHumanSupportBlock(block)) {
        renderableBlocks.push(block)
        continue
      }

      if (isProductRecommendationBlock(block)) {
        this.registerProductBlock(block)
        renderableBlocks.push(block)
        continue
      }

      if (isTemplateCreationBlock(block)) {
        this.registerTemplateBlock(block)
        renderableBlocks.push(block)
        continue
      }

      if (isSkillResultBlock(block)) {
        renderableBlocks.push(block)
        continue
      }

      if (isTextBlock(block)) {
        renderableBlocks.push(block)
      }
    }

    return {
      productBlocks: new Map(this.productBlocks),
      templateBlocks: new Map(this.templateBlocks),
      renderableBlocks,
    }
  }

  private registerProductBlock(block: ProductRecommendationBlock): void {
    if (!this.productBlocks.has(block.id)) {
      this.productBlocks.set(block.id, block)
    }
  }

  private registerTemplateBlock(block: TemplateCreationBlock): void {
    if (!this.templateBlocks.has(block.id)) {
      this.templateBlocks.set(block.id, block)
    }
  }

  private processTemplateDataEvent(block: EventBlock): void {
    if (block.eventName !== 'template_data_update') return

    const data = block.data
    if (!data?.cardId) return

    const eventKey = `${data.cardId}-${JSON.stringify(data)}`
    if (this.processedEvents.has(eventKey)) return

    const existingBlock = this.templateBlocks.get(data.cardId)
    if (!existingBlock) {
      console.log('[MESSAGE] No existing block found for cardId:', data.cardId)
      return
    }

    const updatedBlock: TemplateCreationBlock = {
      ...existingBlock,
      state: 'complete',
      data: {
        ...data,
      },
    }

    this.templateBlocks.set(data.cardId, updatedBlock)
    this.processedEvents.add(eventKey)
  }

  private processProductDataEvent(block: EventBlock): void {
    if (block.eventName !== 'product_data_update') return

    const data = block.data
    if (!data?.cardId) return

    const eventKey = `${data.cardId}-${JSON.stringify(data)}`
    if (this.processedEvents.has(eventKey)) return

    const existingBlock = this.productBlocks.get(data.cardId)
    if (!existingBlock) {
      console.log('[MESSAGE] No existing block found for cardId:', data.cardId)
      return
    }

    const updatedBlock: ProductRecommendationBlock = {
      ...existingBlock,
      state: 'complete',
      case: data.case || existingBlock.case,
      data: {
        ...data, // Spread all data fields automatically
        ...(data.case === 2 && {
          provider: data.provider,
          badge: data.badge,
        }),
      },
    }

    this.productBlocks.set(data.cardId, updatedBlock)
    this.processedEvents.add(eventKey)
  }

  reset(): void {
    this.processedEvents.clear()
  }
}

const MessageItem = memo(function MessageItem(props: MessageProps) {
  const { message, index, onFeedback, currentStatus, isLastMessage } = props

  const [feedback, setFeedback] = useState<FeedbackType | null>(message.feedback || null)
  const [blockProcessor] = useState(() => new BlockProcessor())

  const isUserMessage = message.role === ConversationRole.USER
  // isLoading reflects when the assistant/user content should be rendered.
  // If content is empty and no metadata, we are still loading.
  const isLoading = !!message.content || !!message.metadata?.url

  // Reset processor when message changes
  useEffect(() => {
    blockProcessor.reset()
  }, [message.id, blockProcessor])

  // Optimized block processing with memoization
  const { productBlocks, templateBlocks, renderableBlocks } = useMemo(() => {
    if (!message.streamingBlocks?.length) {
      return { productBlocks: new Map(), templateBlocks: new Map(), renderableBlocks: [] }
    }
    return blockProcessor.processBlocks(message.streamingBlocks)
  }, [message.streamingBlocks, blockProcessor])

  const handleFeedback = useCallback(
    async (newFeedback: FeedbackType) => {
      if (!onFeedback || !message.id) return

      try {
        const updatedFeedback = feedback === newFeedback ? null : newFeedback
        setFeedback(updatedFeedback)
        await onFeedback(message.id, updatedFeedback)
      } catch (error) {
        console.error('Error updating feedback:', error)
        setFeedback(message.feedback || null)
      }
    },
    [onFeedback, message.id, message.feedback, feedback]
  )

  // Simplified rendering logic
  const renderBlocks = useCallback(() => {
    const blocks: React.ReactNode[] = []
    let textChunks: string[] = []

    const flushText = () => {
      if (!textChunks.length) return
      const text = textChunks.join('\n').trim()
      if (text) {
        blocks.push(
          <Box key={`text-${blocks.length}`}>
            <CustomMarkdown>{text}</CustomMarkdown>
          </Box>
        )
      }
      textChunks = []
    }

    for (const block of renderableBlocks) {
      if (isTextBlock(block)) {
        textChunks.push(block.content)
        continue
      }

      flushText()

      // Render human support CTA block
      if (isHumanSupportBlock(block)) {
        blocks.push(<NeedHumanSupportCard />)
        continue
      }

      if (isProductRecommendationBlock(block)) {
        const currentBlock = productBlocks.get(block.id) || block
        blocks.push(
          <ProductRecommendationCard
            key={`product-${block.id}`}
            block={currentBlock}
            onUpdate={() => {}} // No longer needed with processor
          />
        )
        continue
      }

      if (isTemplateCreationBlock(block)) {
        const currentBlock = templateBlocks.get(block.id) || block
        blocks.push(
          <TemplatePreviewCard
            key={`template-${block.id}`}
            template={currentBlock.data}
            loading={currentBlock.state !== 'complete'}
          />
        )
        continue
      }

      if (isSkillResultBlock(block)) {
        if (block.data.plan) {
          blocks.push(
            <PlanPreviewCard
              key={`plan-result-${blocks.length}`}
              plan={block.data.plan}
              toolCallBatch={block.data.data?.toolCallBatch}
            />
          )
        } else {
          blocks.push(<OptionSetPreviewCard key={`skill-result-${blocks.length}`} skillResult={block.data} />)
        }
        continue
      }
    }

    flushText()

    // Fallback to direct content if no blocks
    if (blocks.length === 0 && message.content) {
      blocks.push(
        <Box key="content">
          <CustomMarkdown>{message.content}</CustomMarkdown>
        </Box>
      )
    }

    const metadataType = message.metadata?.type
    // Add action card if this message has action metadata
    if (metadataType && (metadataType === 'publish_product_action' || metadataType === 'view_live_action')) {
      blocks.push(<ActionCardRenderer key="action-card" message={message} />)
    }

    return blocks
  }, [message, renderableBlocks, productBlocks, templateBlocks])

  const renderMessageContent = useCallback(() => {
    // Apply min-height to last assistant message to prevent scroll jumping
    const shouldApplyMinHeight = isLastMessage && !isUserMessage
    const messageContentStyle = shouldApplyMinHeight ? { minHeight: MIN_HEIGHT_FOR_LAST_MESSAGE } : {}

    return (
      <div className={styles.chatMessage} style={messageContentStyle}>
        <Box
          as="div"
          {...(isUserMessage && {
            background: 'bg-surface-secondary',
            padding: '200',
          })}
          borderRadius="200"
          overflowX="hidden"
          overflowY="hidden"
          width="100%"
        >
          {message.role === ConversationRole.ASSISTANT ? (
            <BlockStack gap="300">{renderBlocks()}</BlockStack>
          ) : (
            <BlockStack gap="200">
              {/* Optional attachments: render selected template chips if present */}
              {Array.isArray((message as any)?.metadata?.attachments?.templates)
                && (message as any).metadata.attachments.templates.length > 0 && (
                  <InlineStack gap="150" align="start" wrap={false} blockAlign="center">
                    <Text as="span" variant="bodySm" tone="subdued">
                      ↪
                    </Text>
                    {(message as any).metadata.attachments.templates.map(
                      (tpl: { templateId: string; name: string }, idx: number) => (
                        <Box
                          key={`${tpl.templateId}-${idx}`}
                          background="bg-surface-secondary"
                          padding="050"
                          borderRadius="200"
                        >
                          <Text as="span" variant="bodySm" tone="subdued">
                            {tpl.name}
                          </Text>
                        </Box>
                      )
                    )}
                  </InlineStack>
                )}
              {/* User content — style /command prefix as a badge */}
              <div style={{ whiteSpace: 'pre-line' }}>
                {message.content?.startsWith('/') ? (
                  <UserMessageWithCommand content={message.content} />
                ) : (
                  <Text as="p">{message.content}</Text>
                )}
              </div>
            </BlockStack>
          )}
        </Box>
        {!isUserMessage && <FeedbackButtons feedback={feedback} onFeedback={handleFeedback} />}
      </div>
    )
  }, [isLastMessage, isUserMessage, message, renderBlocks, feedback, handleFeedback])

  // Render loading indicator while waiting for AI response
  if (message.id === 'loading') {
    const status: StatusBlock = currentStatus || {
      type: 'status',
      agent: '',
      message: 'understanding-your-request',
      timestamp: new Date(),
    }
    return (
      <InlineStack key={index} align="start" direction="row" gap="200">
        <InlineStack gap="050">
          <div className={styles.chatMessage}>
            <div style={{ minHeight: MIN_HEIGHT_FOR_LAST_MESSAGE }}>
              <StatusMessage status={status} />
            </div>
          </div>
        </InlineStack>
      </InlineStack>
    )
  }

  return (
    <InlineStack
      key={index}
      align={isUserMessage ? 'end' : 'start'}
      direction={isUserMessage ? 'row-reverse' : 'row'}
      gap="200"
    >
      <InlineStack gap="050">{!isLoading ? null : renderMessageContent()}</InlineStack>
    </InlineStack>
  )
})

export default MessageItem

export const StreamMessage = memo(function StreamMessage(props: { streamingMessage: string }) {
  const { streamingMessage } = props
  return (
    <div className={styles.chatMessage}>
      <Box as="div" padding="300" background="bg-surface-secondary" borderRadius="200">
        <ReactMarkdown>{streamingMessage}</ReactMarkdown>
      </Box>
    </div>
  )
})

export const UserAvatar = memo(function UserAvatar() {
  return <Icon source={PersonFilledIcon} tone="success" />
})

export const AssistantAvatar = memo(function AssistantAvatar() {
  return (
    <div className={styles.avatarImage}>
      <Avatar source={COMMON_ICONS.TAILORKIT_CHAT_BOT_ICON} />
    </div>
  )
})

interface LoadingDotsProps {
  style?: React.CSSProperties
}

export const LoadingDots = memo(function LoadingDots(props: LoadingDotsProps) {
  return (
    <Box data-testid="loading-dots">
      <div className={styles.loadingDots}>
        <div className={styles.loadingDot} style={props?.style} />
        <div className={styles.loadingDot} style={props?.style} />
        <div className={styles.loadingDot} style={props?.style} />
      </div>
    </Box>
  )
})

interface FeedbackButtonsProps {
  feedback: FeedbackType | null
  onFeedback: (feedback: FeedbackType) => Promise<void>
  disabled?: boolean
}

const FeedbackButtons = memo(function FeedbackButtons({ feedback, onFeedback, disabled }: FeedbackButtonsProps) {
  const { t } = useTranslation()

  const handleLike = useCallback(() => onFeedback(FeedbackType.HELPFUL), [onFeedback])
  const handleDislike = useCallback(() => onFeedback(FeedbackType.UNHELPFUL), [onFeedback])

  return (
    <Box>
      <InlineStack align="center">
        <Tooltip zIndexOverride={CHAT_BOT_DRAWER_TOOLTIP_Z_INDEX} content={t('helpful')}>
          <button
            className={`${styles.feedbackButton} ${styles.thumbsUp}`}
            onClick={handleLike}
            aria-label={t('helpful')}
            disabled={disabled}
          >
            <Icon source={ThumbsUpIcon} tone={feedback === FeedbackType.HELPFUL ? 'success' : 'subdued'} />
          </button>
        </Tooltip>
        <Tooltip zIndexOverride={CHAT_BOT_DRAWER_TOOLTIP_Z_INDEX} content={t('unhelpful')}>
          <button
            className={`${styles.feedbackButton} ${styles.thumbsDown}`}
            onClick={handleDislike}
            aria-label={t('unhelpful')}
            disabled={disabled}
          >
            <Icon source={ThumbsDownIcon} tone={feedback === FeedbackType.UNHELPFUL ? 'critical' : 'subdued'} />
          </button>
        </Tooltip>
      </InlineStack>
    </Box>
  )
})
