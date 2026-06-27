/** @jsxImportSource preact */
import { useState, useEffect, useRef } from 'preact/hooks'
import {
  getMockupId,
  getTemplateIdFallback,
  extractTemplateIdFromMockup,
  formatSummaryMessage,
  getChangesList,
} from './utils'
import {
  applyImageRecommendation,
  applyTextContentRecommendation,
  applyColorRecommendation,
  applyFontRecommendation,
  triggerProductUpdate,
} from './aiRecommendations'
import { applyTextRecommendation } from './textRecommendations'
import { APP_PROXY_PATH } from '../../constants'
import { fetchWithAdminContext } from '../../libraries/fetchWithAdminContext'

interface FloatingButtonProps {
  onClick?: () => void
}

// Inline styles to avoid CSS conflicts
const styles = {
  widget: {
    position: 'fixed' as const,
    bottom: '20px',
    right: '20px',
    zIndex: 9999,
  },
  button: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    border: 'none',
    borderRadius: '50px',
    color: 'white',
    padding: '12px 20px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    boxShadow: '0 4px 20px rgba(102, 126, 234, 0.4)',
    transition: 'all 0.3s ease',
  },
  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000,
  },
  chat: {
    background: 'white',
    borderRadius: '16px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
    width: '90%',
    maxWidth: '600px',
    height: '80vh',
    maxHeight: '700px',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #e5e7eb',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
  },
  headerTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '600',
  },
  closeButton: {
    background: 'rgba(255, 255, 255, 0.2)',
    border: 'none',
    fontSize: '20px',
    color: 'white',
    cursor: 'pointer',
    padding: '6px',
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    transition: 'all 0.2s',
  },
  messages: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '20px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    background: '#f8fafc',
  },
  message: {
    display: 'flex',
    flexDirection: 'column' as const,
    maxWidth: '85%',
  },
  messageUser: {
    alignSelf: 'flex-end' as const,
  },
  messageAI: {
    alignSelf: 'flex-start' as const,
  },
  messageContent: {
    padding: '12px 16px',
    borderRadius: '18px',
    fontSize: '14px',
    lineHeight: '1.4',
    wordWrap: 'break-word' as const,
  },
  messageContentUser: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    borderBottomRightRadius: '4px',
  },
  messageContentAI: {
    background: 'white',
    color: '#374151',
    border: '1px solid #e5e7eb',
    borderBottomLeftRadius: '4px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
  },
  messageTime: {
    fontSize: '11px',
    color: '#9ca3af',
    marginTop: '4px',
    padding: '0 4px',
  },
  messageTitle: {
    fontWeight: '600',
    marginBottom: '8px',
    color: '#1f2937',
  },
  bulletPoint: {
    margin: '4px 0',
    color: '#4b5563',
  },
  typing: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 0',
  },
  typingDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#9ca3af',
    animation: 'typingDot 1.5s infinite',
  },
  inputContainer: {
    borderTop: '1px solid #e5e7eb',
    padding: '16px 20px',
    background: 'white',
  },
  inputRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    border: '2px solid #e5e7eb',
    borderRadius: '24px',
    padding: '12px 16px',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s',
    fontFamily: 'inherit',
  },
  sendButton: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    border: 'none',
    color: 'white',
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    fontSize: '16px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  charCount: {
    marginTop: '8px',
    fontSize: '12px',
    color: '#6b7280',
    textAlign: 'right' as const,
  },
}

export const FloatingButton = ({ onClick }: FloatingButtonProps) => {
  const [isPopupOpen, setIsPopupOpen] = useState(false)
  const [userPrompt, setUserPrompt] = useState('')
  const [messages, setMessages] = useState<
    Array<{
      id: string
      text: string
      type: 'user' | 'ai'
      timestamp: Date
    }>
  >([])
  const [isProcessing, setIsProcessing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isProcessing])

  const handleClick = () => {
    setIsPopupOpen(true)
    setMessages([
      {
        id: Date.now().toString(),
        text: "Hi! I'm your AI design assistant. Tell me how you'd like to personalize this product and I'll help you create the perfect design! 🎨",
        type: 'ai',
        timestamp: new Date(),
      },
    ])
    if (onClick) onClick()
  }

  const addMessage = (text: string, type: 'user' | 'ai') => {
    const newMessage = {
      id: Date.now().toString() + Math.random(),
      text,
      type,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, newMessage])
    return newMessage
  }

  const handleSubmitPrompt = async () => {
    if (!userPrompt.trim() || isProcessing) {
      return
    }

    // Add user message
    addMessage(userPrompt, 'user')
    const currentPrompt = userPrompt
    setUserPrompt('')
    setIsProcessing(true)

    try {
      // Get template ID for AI processing
      const mockupId = getMockupId()
      let templateId = null

      if (mockupId) {
        templateId = await extractTemplateIdFromMockup(mockupId)
      } else {
        templateId = getTemplateIdFallback()
      }

      if (!templateId) {
        addMessage("Sorry, I couldn't find the product template. Please try again.", 'ai')
        setIsProcessing(false)
        return
      }

      // Process with AI
      await processAIPersonalizationWithProgress(templateId, currentPrompt)
    } catch (error) {
      addMessage('Oops! Something went wrong. Please try again.', 'ai')
      setIsProcessing(false)
    }
  }

  const processAIPersonalizationWithProgress = async (templateId: string, userMessage: string) => {
    try {
      const response = await fetchWithAdminContext(`${APP_PROXY_PATH}/app_proxy/ai-product-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          templateId: templateId,
          useAgent: true,
          testMode: false,
        }),
      })

      if (!response.ok) {
        throw new Error('AI request failed')
      }

      const data = await response.json()

      if (data.agentMode && data.response) {
        const { recommendations = [], textRecommendations = [] } = data.response

        if (recommendations.length > 0 || textRecommendations.length > 0) {
          // Get list of changes being applied
          const changes = getChangesList(recommendations, textRecommendations)

          // Apply the changes
          await applyAIRecommendations(recommendations, textRecommendations)

          // Summary message
          const summaryMessage = formatSummaryMessage(changes)
          addMessage(summaryMessage, 'ai')
        } else {
          const noOptionsMessage
            = `I analyzed your request but couldn't find suitable `
            + `personalization options for this product. Could you try describing what `
            + `you'd like differently?`
          addMessage(noOptionsMessage, 'ai')
        }
      } else {
        const errorMessage = `I had trouble understanding your request. Could you try rephrasing what you'd like me to personalize?`
        addMessage(errorMessage, 'ai')
      }
    } catch (error) {
      console.error('AI processing error:', error)
      addMessage('Sorry, I encountered an issue while processing your request. Please try again!', 'ai')
    } finally {
      setIsProcessing(false)
    }
  }

  // Function to apply AI recommendations to the DOM
  const applyAIRecommendations = async (recommendations: any[], textRecommendations: any[] = []) => {
    console.log('🎯 Applying AI Recommendations to Product Customizer')
    console.log('='.repeat(50))

    // Apply option set recommendations
    for (const [index, rec] of recommendations.entries()) {
      console.log(`📝 Applying recommendation ${index + 1}: ${rec.optionType}`)

      switch (rec.optionType) {
        case 'text_option':
          applyTextRecommendation(rec)
          break
        case 'color_option':
          applyColorRecommendation(rec)
          break
        case 'font_option':
          applyFontRecommendation(rec)
          break
        case 'image_option':
          await applyImageRecommendation(rec)
          break
        default:
          console.warn(`⚠️ Unknown option type: ${rec.optionType}`)
      }
    }

    // Apply text content recommendations
    textRecommendations.forEach((textRec: any, index: number) => {
      console.log(`📝 Applying text recommendation ${index + 1} for layer: ${textRec.layerId}`)
      applyTextContentRecommendation(textRec)
    })

    // Trigger product updates
    triggerProductUpdate()

    console.log('✅ All AI recommendations applied successfully!')
    console.log('='.repeat(50))
  }

  return (
    <div style={styles.widget}>
      <button style={styles.button} onClick={handleClick}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 0L9.176 4.824L14 6L9.176 7.176L8 12L6.824 7.176L2 6L6.824 4.824L8 0Z" fill="white" />
          <path d="M12 2L12.5 3.5L14 4L12.5 4.5L12 6L11.5 4.5L10 4L11.5 3.5L12 2Z" fill="white" />
        </svg>
        Ask AI
      </button>

      {isPopupOpen && (
        <div style={styles.overlay} onClick={() => setIsPopupOpen(false)}>
          <div style={styles.chat} onClick={e => e.stopPropagation()}>
            <div style={styles.header}>
              <h3 style={styles.headerTitle}>🎨 AI Design Assistant</h3>
              <button style={styles.closeButton} onClick={() => setIsPopupOpen(false)} title="Close">
                ×
              </button>
            </div>

            <div style={styles.messages}>
              {messages.map(message => (
                <div
                  key={message.id}
                  style={{
                    ...styles.message,
                    ...(message.type === 'user' ? styles.messageUser : styles.messageAI),
                  }}
                >
                  <div
                    style={{
                      ...styles.messageContent,
                      ...(message.type === 'user' ? styles.messageContentUser : styles.messageContentAI),
                    }}
                  >
                    {message.text.split('\n').map((line, index) => (
                      <div key={index}>
                        {line.startsWith('•') ? (
                          <div style={styles.bulletPoint}>{line}</div>
                        ) : line.startsWith('**') && line.endsWith('**') ? (
                          <div style={styles.messageTitle}>{line.replace(/\*\*/g, '')}</div>
                        ) : (
                          line
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={styles.messageTime}>
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}

              {isProcessing && (
                <div style={{ ...styles.message, ...styles.messageAI }}>
                  <div style={styles.messageContentAI}>
                    <div style={styles.typing}>
                      <span style={styles.typingDot}></span>
                      <span style={{ ...styles.typingDot, animationDelay: '0.2s' }}></span>
                      <span style={{ ...styles.typingDot, animationDelay: '0.4s' }}></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div style={styles.inputContainer}>
              <div style={styles.inputRow}>
                <input
                  type="text"
                  style={{
                    ...styles.input,
                    borderColor: userPrompt ? '#667eea' : '#e5e7eb',
                    backgroundColor: isProcessing ? '#f9fafb' : 'white',
                    color: isProcessing ? '#9ca3af' : 'inherit',
                  }}
                  value={userPrompt}
                  onChange={e => setUserPrompt(e.target.value)}
                  onKeyPress={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSubmitPrompt()
                    }
                  }}
                  placeholder="Tell me how you'd like to personalize this product..."
                  maxLength={500}
                  disabled={isProcessing}
                />
                <button
                  style={{
                    ...styles.sendButton,
                    opacity: !userPrompt.trim() || isProcessing ? 0.5 : 1,
                    cursor: !userPrompt.trim() || isProcessing ? 'not-allowed' : 'pointer',
                  }}
                  onClick={handleSubmitPrompt}
                  disabled={!userPrompt.trim() || isProcessing}
                  title="Send message"
                >
                  {isProcessing ? '⏳' : '➤'}
                </button>
              </div>
              <div style={styles.charCount}>{userPrompt.length}/500</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
