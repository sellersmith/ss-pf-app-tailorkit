import { BlockStack, Icon, useBreakpoints } from '@shopify/polaris'
import { useCallback, useMemo, useRef, useEffect, useState } from 'react'
import { type ConversationMessageDocument } from '~/models/ConversationMessage'
import MessageItem from './Message'
import styles from './styles.module.css'
import type { FeedbackType } from '~/enums/conversationMessage'
import { ConversationRole } from '~/enums/conversationMessage'
import type { IMessageInput } from '~/routes/api.ai-assistant/constants'
import { ChevronDownIcon } from '@shopify/polaris-icons'
import { parseBlocksFromRawString, type MessageBlock, type StatusBlock } from './fns'
import { HeaderChatBox } from './ChatBox'
import type { ISuggestion } from './constants'

interface MessageListProps {
  messages: IMessageInput[]
  isLoading: boolean
  streamingMessage: string
  streamingBlocks: MessageBlock[]
  currentStatus?: StatusBlock | null
  onFeedback?: (messageId: string, feedback: FeedbackType | null) => Promise<void>
  renderSuggestions?: React.ReactNode
  shopOwner?: string
  onSuggestionClick?: (suggestion: ISuggestion) => void
}

/**
 * MessageList component that displays a list of conversation messages with scroll-to-bottom functionality
 * @param props - Component props containing messages, loading state, and callbacks
 */
function MessageList(props: MessageListProps) {
  const {
    messages,
    isLoading,
    streamingMessage,
    streamingBlocks,
    currentStatus,
    onFeedback,
    renderSuggestions,
    shopOwner = 'Admin',
    onSuggestionClick,
  } = props
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const latestMessageRef = useRef<HTMLDivElement>(null)
  const chatMessagesRef = useRef<HTMLDivElement>(null)
  const [shouldShowScrollButton, setShouldShowScrollButton] = useState(false)

  /**
   * Scrolls the message container to the bottom
   */
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView?.({ behavior: 'smooth' })
    }
  }, [])

  /**
   * Scrolls to the latest message
   */
  // scrollToLatest is now handled via event-driven scrollToBottom calls from parent
  // No useEffect needed — parent calls scrollToBottom via ref or callback

  /**
   * Checks if the content height exceeds the container height and user is not at bottom
   */
  const checkScrollNeeded = useCallback(() => {
    if (chatMessagesRef.current) {
      const container = chatMessagesRef.current
      const { scrollHeight, clientHeight, scrollTop } = container

      // Check if content overflows
      const hasOverflow = scrollHeight > clientHeight

      // Check if user is at the bottom (with small tolerance for floating point precision)
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 5

      setShouldShowScrollButton(hasOverflow && !isAtBottom)
    } else {
      setShouldShowScrollButton(false)
    }
  }, [])

  // Check scroll needed when messages change or component mounts
  useEffect(() => {
    checkScrollNeeded()
  }, [messages.length, streamingMessage.length, isLoading, checkScrollNeeded])

  // Add scroll event listener to track scroll position
  useEffect(() => {
    const container = chatMessagesRef.current
    if (!container) return

    const handleScroll = () => {
      checkScrollNeeded()
    }

    container.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      container.removeEventListener('scroll', handleScroll)
    }
  }, [checkScrollNeeded])

  // Auto-scroll during streaming — only if already at bottom (don't interrupt manual scroll)
  useEffect(() => {
    if (!streamingMessage || !chatMessagesRef.current) return
    const container = chatMessagesRef.current
    const { scrollHeight, clientHeight, scrollTop } = container
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 50
    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' })
    }
  }, [streamingMessage])

  // Add resize observer to handle container size changes
  useEffect(() => {
    if (!chatMessagesRef.current) return

    const resizeObserver = new ResizeObserver(() => {
      checkScrollNeeded()
    })

    resizeObserver.observe(chatMessagesRef.current)

    return () => {
      resizeObserver.disconnect()
    }
  }, [checkScrollNeeded])

  // Merge messages when having streaming message or loading
  const allMessages = useMemo(() => {
    const result = [
      ...messages.map(message => ({
        ...message,
        streamingBlocks: parseBlocksFromRawString(message.content),
      })),
    ]

    if (isLoading && !streamingMessage) {
      result.push({
        id: 'loading',
        content: '',
        streamingBlocks: [],
        role: ConversationRole.ASSISTANT,
        timestamp: new Date(),
        feedback: null,
      })
    }

    if (streamingMessage) {
      result.push({
        id: 'streaming',
        content: streamingMessage,
        streamingBlocks,
        role: ConversationRole.ASSISTANT,
        timestamp: new Date(),
        feedback: null,
      })
    }

    return result
  }, [messages, streamingMessage, isLoading, streamingBlocks])

  const { smDown } = useBreakpoints()
  // const [searchParams] = useSearchParams()
  // const isOnboardingRoute = useMemo(() => searchParams.get('onboarding') === 'true', [searchParams])
  const isOnboardingRoute = false

  return (
    <>
      <div
        ref={chatMessagesRef}
        className={styles.chatMessages}
        style={{ height: `calc(100vh - ${isOnboardingRoute ? (smDown ? 267 : 291) : 214}px)` }}
      >
        <HeaderChatBox
          shop_owner={shopOwner}
          hasMessages={allMessages.length > 0}
          onSuggestionClick={onSuggestionClick}
        />
        <BlockStack gap="400">
          {allMessages.map((message, index) => {
            const isLastMessage = index === allMessages.length - 1
            const isAssistantMessage = message.role === ConversationRole.ASSISTANT
            // Show status on the last assistant message if there's an active status
            const showStatus = isLastMessage && isAssistantMessage && currentStatus

            return (
              <div key={message.id} ref={isLastMessage ? latestMessageRef : null}>
                <MessageItem
                  message={message as ConversationMessageDocument & { streamingBlocks: MessageBlock[] }}
                  index={index}
                  onFeedback={onFeedback}
                  currentStatus={showStatus ? currentStatus : undefined}
                  isLastMessage={isLastMessage}
                />
              </div>
            )
          })}
        </BlockStack>
        {/* Invisible div for scrolling reference */}
        <div ref={messagesEndRef} />

        {renderSuggestions && renderSuggestions}
      </div>

      <div
        style={{
          position: 'sticky',
          bottom: 4,
          border: '1px solid #E0E0E0',
          borderRadius: '50%',
          width: 24,
          height: 24,
          left: '50%',
          right: '50%',
          zIndex: 1000,
          cursor: 'pointer',
          backgroundColor: 'white',
          visibility: shouldShowScrollButton ? 'visible' : 'hidden',
        }}
        onClick={scrollToBottom}
      >
        <Icon source={ChevronDownIcon} />
      </div>
    </>
  )
}

export default MessageList
