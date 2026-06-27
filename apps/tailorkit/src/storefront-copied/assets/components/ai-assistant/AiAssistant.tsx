/** @jsxImportSource preact */
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import { APP_PROXY_ORIGIN, APP_PROXY_PATH } from '../../constants'
import { STORE_FRONT_ACTION } from '../../constants/app-actions'
import { MAGIC_ICON, SEND_ICON, STOP_ICON } from '../../icons/editor-icons'
import { initializeTailorKitMCP } from '../../services/mcp/tailorkit-mcp-client'
import { getCookie } from '../../utils'
import Button from '../preact/commons/button'
import { LoadingDots } from '../preact/commons/loading/LoadingDots'
import MagicTextField from '../preact/commons/magic-textfield'
import Popover from '../preact/commons/popover'
import { CloseIcon } from './commons/Icon'
import { clearConversation, messagesSig } from './messageStore'
import { SafeMarkdown } from './SafeMarkdown'
import type { AiAssistantProps, ConversationMessage, Message } from './types'
import { Transmitter } from '../../libraries/transmitter'
import { fetchWithAdminContext } from '../../libraries/fetchWithAdminContext'

export function AiAssistant(props: AiAssistantProps) {
  const [input, setInput] = useState(props.preMadePrompt || '')
  const [loading, setLoading] = useState(false)

  const [lastUserMsgId, setLastUserMsgId] = useState<string | null>(null)
  const [scrolledToBottom, setScrolledToBottom] = useState(true)

  const [open, setOpen] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const bottomSpacerRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Placeholder for revert action
  const onRevert = () => {
    // TODO: Implement revert logic
    alert('Revert to original clicked!')
  }

  const getSessionId = useCallback(() => {
    return getCookie('_shopify_s')
  }, [])

  // Simple function to scroll the chat body to bottom
  const scrollToBottom = useCallback(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight
      setScrolledToBottom(true)
    }
  }, [])

  // Scroll to position the user message at the top with space below
  const scrollToPositionUserMessage = useCallback(
    (messageId: string) => {
      if (!messageId) return

      // Find the message element by ID
      const messageEl = document.getElementById(`message-${messageId}`)
      if (!messageEl) {
        scrollToBottom()
        return
      }

      // Calculate the position to scroll to (message at top with space below)
      if (bodyRef.current) {
        // Get the message position relative to the container
        const containerRect = bodyRef.current.getBoundingClientRect()
        const messageRect = messageEl.getBoundingClientRect()

        // Calculate top position - place message at the top of the visible area
        const scrollTop = bodyRef.current.scrollTop + (messageRect.top - containerRect.top)

        // Smooth scroll to position
        bodyRef.current.scrollTo({
          top: scrollTop,
          behavior: 'smooth',
        })

        setScrolledToBottom(false)
      }
    },
    [scrollToBottom]
  )

  // Handle scroll events to detect when user scrolls manually
  const handleScroll = useCallback(() => {
    if (!bodyRef.current) return

    const { scrollTop, scrollHeight, clientHeight } = bodyRef.current
    // Consider "scrolled to bottom" when within 20px of the bottom
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 20

    if (isAtBottom !== scrolledToBottom) {
      setScrolledToBottom(isAtBottom)
    }
  }, [scrolledToBottom])

  // Add scroll event listener
  useEffect(() => {
    const chatBody = bodyRef.current
    if (open && chatBody) {
      chatBody.addEventListener('scroll', handleScroll)
      return () => chatBody.removeEventListener('scroll', handleScroll)
    }
  }, [open, handleScroll])

  // Scroll to the last user message
  useEffect(() => {
    if (lastUserMsgId) {
      // Use a slight delay to ensure DOM is updated
      setTimeout(() => {
        scrollToPositionUserMessage(lastUserMsgId)
      }, 50)
    }
  }, [lastUserMsgId, scrollToPositionUserMessage])

  // Auto-scroll during loading if user hasn't manually scrolled up
  useEffect(() => {
    if (loading && scrolledToBottom && bottomSpacerRef.current) {
      const scrollInterval = setInterval(() => {
        if (scrolledToBottom) {
          scrollToBottom()
        }
      }, 500) // Check every 500ms during loading

      return () => clearInterval(scrollInterval)
    }
  }, [loading, scrolledToBottom, scrollToBottom])

  // Scroll to bottom when component opens
  useEffect(() => {
    if (open) {
      const shopifySessionId = getSessionId()

      if (shopifySessionId) {
        initializeTailorKitMCP(APP_PROXY_ORIGIN, APP_PROXY_PATH, shopifySessionId)
      } else {
        console.error('Failed to initialize TailorKit MCP due to missing shopify session id')
      }

      scrollToBottom()
    }
  }, [open, scrollToBottom, getSessionId])

  useEffect(() => {
    return () => {
      console.log('Component unmount')
    }
  }, [])

  // Function to stop the ongoing conversation
  const stopConversation = useCallback(() => {
    // Abort the fetch request if it's in progress
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setLoading(false)
  }, [])

  const sendPrompt = useCallback(async () => {
    const prompt = input.trim()
    if (!prompt) return

    setLoading(true)
    setScrolledToBottom(true) // Reset to auto-scroll for new messages

    // Create user message with unique ID
    const userMsgId = `user-${Date.now()}`
    const userMsg: Message = { id: userMsgId, role: 'user', content: prompt }

    // Update messages and reset input
    messagesSig.value = [...messagesSig.value, userMsg]
    setInput('')

    // Store the user message ID for scrolling
    setLastUserMsgId(userMsgId)

    // Prepare assistant placeholder
    const assistantId = `assistant-${Date.now()}`
    const assistantMsg: Message = { id: assistantId, role: 'assistant', content: '' }
    messagesSig.value = [...messagesSig.value, assistantMsg]

    // Format conversation history for the API
    const conversationHistory: ConversationMessage[] = messagesSig.value
      .filter(msg => msg.id !== assistantId) // exclude the placeholder we just added
      .map(msg => ({
        role: msg.role,
        content: msg.content,
      }))

    try {
      // Create a new AbortController for this request
      abortControllerRef.current = new AbortController()
      const signal = abortControllerRef.current.signal

      // The route.tsx requires action in FormData, not query params
      const formData = new FormData()
      formData.append('action', STORE_FRONT_ACTION.AI_ASSISTANT_CALL)
      formData.append(
        'jsonData',
        JSON.stringify({
          message: prompt,
          userMessageId: userMsgId,
          assistantMessageId: assistantId,
          conversationHistory: conversationHistory,
          conversationId: '', // Will be generated server-side if not provided
          stream: true,
          sessionId: getSessionId(),
        })
      )

      const res = await fetchWithAdminContext(`${APP_PROXY_PATH}/app_proxy/storefront`, {
        method: 'POST',
        body: formData,
        headers: {
          Accept: 'text/event-stream',
        },
        signal, // Pass the abort signal to the fetch request
      })

      if (!res.ok || !res.body) {
        throw new Error('Unable to connect to AI service')
      }

      const decoder = new TextDecoder()
      const reader = res.body.getReader()
      let buffer = ''

      // Process the stream
      while (true) {
        const { value, done } = await reader.read()

        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))

              // Append token to assistant message, preserving spaces
              messagesSig.value = messagesSig.value.map(m =>
                m.id === assistantId ? { ...m, content: m.content + data } : m
              )

              // Auto-scroll if user hasn't scrolled up manually
              if (scrolledToBottom) {
                scrollToBottom()
              }
            } catch (e) {
              console.error('Error parsing event data:', e, line)
            }
          }
        }
      }

      Transmitter.trigger('tailorkit-storefront-usage', { feature: 'AI_ASSISTANT' })
    } catch (err: any) {
      console.error(err)
      // Only show error if it's not an AbortError (which is expected when stopping)
      if (err.name !== 'AbortError') {
        messagesSig.value = messagesSig.value.map(m =>
          m.id === assistantId ? { ...m, content: `Error: ${err.message}` } : m
        )
      }
    } finally {
      setLoading(false)
      setLastUserMsgId(null) // Reset last user message ID
      abortControllerRef.current = null // Clear the abort controller
    }
  }, [input, getSessionId, scrolledToBottom, scrollToBottom])

  // Handle keyboard shortcut
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Send message on Enter (without shift key for new line)
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (input.trim() && !loading) {
          sendPrompt()
        }
      }
    },
    [input, loading, sendPrompt]
  )

  // Separate submit and cancel handlers
  const onSubmit = useCallback(
    (e: Event) => {
      e.preventDefault()
      if (input.trim() && !loading) {
        sendPrompt()
      }
    },
    [input, loading, sendPrompt]
  )

  const onCancel = useCallback(
    (e: Event) => {
      e.preventDefault()
      stopConversation()
    },
    [stopConversation]
  )

  // Handle button click based on current state
  const handleButtonClick = useCallback(
    (e: Event) => {
      e.preventDefault()
      if (loading) {
        onCancel(e)
      } else if (input.trim()) {
        onSubmit(e)
      }
    },
    [loading, input, onSubmit, onCancel]
  )

  return (
    <Popover
      activator={
        <div style={{ marginBottom: 'var(--emtlkit-space-150)' }}>
          <Button
            fullWidth
            icon={MAGIC_ICON}
            tone="super-magic"
            variant="primary"
            onClick={() => {
              setOpen(true)
            }}
          >
            Ask AI
          </Button>
        </div>
      }
      open={open}
      onClose={() => setOpen(false)}
      closeOnClickOutside
    >
      <div className="ai-assistant-modal">
        {/* Header */}
        <div className="ai-assistant-header">
          <span className="ai-assistant-title">AI Product Personalizer</span>
          <div className="ai-assistant-header-actions">
            <button
              style={{
                display: 'none',
              }}
              type="button"
              className="ai-assistant-clear"
              onClick={clearConversation}
              title="Clear conversation"
            >
              Clear Chat
            </button>
            <button type="button" className="ai-assistant-revert" onClick={onRevert}>
              Revert to original
            </button>
            <button type="button" className="ai-assistant-close" onClick={() => setOpen(false)} aria-label="Close">
              <CloseIcon width={20} height={20} color="#616161" />
            </button>
          </div>
        </div>
        {/* Chat body */}
        <div ref={bodyRef} className="ai-assistant-body" onScroll={handleScroll}>
          {messagesSig.value.map(msg => (
            <div
              key={msg.id}
              id={`message-${msg.id}`}
              className={`ai-assistant-message ai-assistant-message-${msg.role}`}
            >
              <div className="ai-assistant-message-content">
                {msg.content ? (
                  <SafeMarkdown
                    content={msg.content}
                    className={`ai-assistant-bubble ai-assistant-bubble-${msg.role}`}
                  />
                ) : (
                  <div className={`ai-assistant-bubble ai-assistant-bubble-${msg.role}`}>
                    {msg.role === 'assistant' && loading && <LoadingDots />}
                  </div>
                )}
              </div>
            </div>
          ))}
          {/* Spacer to ensure there's room at the bottom for incoming messages */}
          <div ref={bottomSpacerRef} className="ai-assistant-bottom-spacer"></div>
        </div>

        {/* Input area */}
        <form onSubmit={onSubmit} className="ai-assistant-input-row">
          <div className="ai-assistant-input-container">
            <MagicTextField
              key={open ? 'open' : 'closed'}
              id="ai-assistant-input"
              ariaLabel={'message'}
              placeholder={'Personalize the product for me'}
              autoFocus
              rows={1}
              suffix={
                <div className="ai-assistant-input-actions">
                  <Button
                    iconOnly
                    tone="success"
                    icon={loading ? STOP_ICON : SEND_ICON}
                    variant="plain"
                    onClick={handleButtonClick}
                    disabled={!input.trim() && !loading}
                    aria-label={loading ? 'Stop generating' : 'Send message'}
                  />
                </div>
              }
              value={input}
              onChange={val => setInput(val)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
          </div>
        </form>
      </div>
    </Popover>
  )
}
