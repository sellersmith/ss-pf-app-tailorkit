import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { authenticatedFetch } from '~/shopify/fns.client'
import { ConversationRole } from '~/enums/conversationMessage'
import { type IConversationInput, type IMessageInput, DEFAULT_CONVERSATION } from '~/routes/api.ai-assistant/constants'
import { uuid } from '~/utils/uuid'
import {
  AI_ASSISTANT_SUGGESTION_ACTION,
  type ConversationAnalysisResponse,
} from '~/routes/api.ai-assistant.suggestion/constants'
import type { SUGGESTIONS } from '~/components/AIChat/constants'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { GLOBAL_EVENTS_TRANSMITTER } from '~/constants/events-transmitter'
import type { MCPToolNotificationMessage } from '~/routes/api.mcp.$tool/constants'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import useWindowSize from '~/utils/hooks/useWindowSize'

/**
 * Represents the context type for the ChatBot, providing state and functions
 * to manage the chatbot's behavior and interactions.
 */
interface ChatBotContextType {
  /** Indicates whether the chatbot is open or closed. */
  isOpen: boolean

  /** The current conversation being managed by the chatbot. */
  currentConversation: IConversationInput

  /** The currently selected pre-made suggestion, if any. */
  selectedPreMadeSuggestion: (typeof SUGGESTIONS)[number] | null

  /** Options for suggestions, including a list of options and a title. */
  suggestOptions: {
    options: string[]
    title: string
  }

  /** Dynamically generated suggestions based on shop context */
  dynamicSuggestions: (typeof SUGGESTIONS)[number][]

  /** Auto-send flag */
  autoSend: boolean

  /**
   * Notifications for MCP tool executed events.
   */
  mcpToolExecutedNotifications: MCPToolNotificationMessage[]

  /**
   * Count of notifications for MCP tool executed events.
   */
  mcpToolExecutedNotificationsCount: number

  /**
   * Indicates whether the notification is being viewed.
   */
  isViewingNotification: boolean

  /**
   * The current notification viewed.
   */
  currentNotificationViewed: MCPToolNotificationMessage | null

  /**
   * Indicates whether the conversation is loading.
   */
  isConversationLoading: boolean

  /**
   * Indicates whether the chatbot is in compact mode.
   */
  isCompactMode: boolean

  /**
   * Toggles the notification viewing state.
   */
  toggleViewingNotification: () => void

  /**
   * Loads the notification viewed.
   */
  loadNotificationViewed: (notificationId: string) => Promise<void>

  /**
   * Sets the selected pre-made suggestion.
   * @param question - The suggestion to be selected.
   */
  setSelectedPreMadeSuggestion: (question: (typeof SUGGESTIONS)[number] | null) => void

  /** Toggles the open/closed state of the chatbot. */
  toggleChatBot: (open?: boolean, currentConversationId?: string) => void

  /** Closes the chatbot. */
  closeChatBot: () => void

  /**
   * Adds a new conversation or updates the current one.
   * @param conversation - The conversation to be added or updated.
   * @returns The ID of the new or updated conversation.
   */
  addConversation: (conversation?: IConversationInput) => string | undefined

  /**
   * Adds a message to the current conversation.
   * @param message - The message to be added.
   */
  addMessage: (message: IMessageInput) => void

  /**
   * Sets the dynamic suggestions.
   * @param suggestions - The suggestions to be set.
   */
  setDynamicSuggestions: (suggestions: (typeof SUGGESTIONS)[number][]) => void

  /**
   * Sets the auto-send flag.
   * @param autoSend - The auto-send flag to be set.
   */
  setAutoSend: (autoSend: boolean) => void

  /**
   * Analyzes the conversation messages and optionally uses a suggestion ID.
   * @param conversationMessages - The messages to be analyzed.
   * @param suggestionId - An optional suggestion ID for analysis.
   * @returns A promise that resolves when the analysis is complete.
   */
  analysisConversation: (conversationMessages: IMessageInput[], suggestionId?: string) => Promise<void>

  /**
   * Sets the suggestion options.
   * @param options - The options to be set, including a list of options and a title.
   */
  setSuggestOptions: (options: { options: string[]; title: string }) => void

  /**
   * Loads a conversation by its ID.
   * @param conversationId - The ID of the conversation to be loaded.
   * @returns A promise that resolves when the conversation is loaded.
   */
  loadConversationById: (conversationId: string) => Promise<void>

  /**
   * Loads conversations with optional query parameters.
   * @param args - Optional query parameters for loading conversations.
   * @returns A promise that resolves with the loaded conversations and pagination info.
   */
  loadConversations: (args?: { query?: string; page?: number; limit?: number }) => Promise<{
    conversations: IConversationInput[]
    pagination: {
      page: number
      limit: number
      total: number
      pages: number
    }
  }>

  /**
   * Auto-fills the input field with a template message.
   * @param template - The template text to fill in the input field.
   */
  autoFillTemplate: (template: string) => void

  /**
   * Saves an AI message to the database.
   * @param message - The AI message content
   * @param messageId - The unique ID for the message
   * @param metadata - Optional metadata for the message
   */
  saveAiMessage: (message: string, messageId: string, metadata?: Record<string, any>) => Promise<void>
}

export const DEFAULT_CONVERSATION_PAGINATION = {
  page: 1,
  limit: 10,
  total: 0,
  pages: 1,
}

// Template for personalized product creation
export const PERSONALIZED_PRODUCT_TEMPLATE = 'personalized-product-template-message'
export const PERSONALIZED_PRODUCT_TEMPLATE_2 = 'personalized-product-template-message-2'
export const ELVA_WELCOME_MESSAGE = 'elva-ai-assistant-welcome-message'

// Template for template creation
export const TEMPLATE_TEMPLATE = 'template-template-message'

const ChatBotContext = createContext<ChatBotContextType | undefined>(undefined)

export function ChatBotProvider({ children }: { children: ReactNode }) {
  // const mcpToolExecutedNotificationsGrouped = useSocketNotifications(Object.values(MCP_TOOLS))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const mcpToolExecutedNotifications: MCPToolNotificationMessage[] = []
  //   Object.values(
  //   mcpToolExecutedNotificationsGrouped
  // ).flat() as unknown as MCPToolNotificationMessage[]
  const mcpToolExecutedNotificationsCount = 0 //mcpToolExecutedNotifications.length

  const [isOpen, setIsOpen] = useState(false)
  const [isConversationLoading, setIsConversationLoading] = useState(false)
  const [currentConversation, setCurrentConversation] = useState<IConversationInput>(DEFAULT_CONVERSATION)

  const { width } = useWindowSize()
  /** With our app 1370 is ideal width for the chatbot to be compact */
  const isUnder1370 = width < 1370
  const isCompactMode = isUnder1370 || isOpen

  const [selectedPreMadeSuggestion, setSelectedPreMadeSuggestion] = useState<(typeof SUGGESTIONS)[number] | null>(null)
  const [suggestOptions, setSuggestOptions] = useState<{
    options: string[]
    title: string
  }>({
    options: [],
    title: '',
  })

  const { trackEvent } = useEventsTracking()

  // Dynamically generated suggestions based on the shop context
  const [dynamicSuggestions, setDynamicSuggestions] = useState<(typeof SUGGESTIONS)[number][]>([])

  // Flag to prevent multiple auto-sends in the same session
  const [autoSend, setAutoSend] = useState(false)

  const [isViewingNotification, setIsViewingNotification] = useState(false)
  const [currentNotificationViewed, setCurrentNotificationViewed] = useState<MCPToolNotificationMessage | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const loadConversationById = useCallback(async (conversationId: string) => {
    setIsConversationLoading(true)
    // refreshCurrentData()
    try {
      const res = await authenticatedFetch(`/api/ai-assistant?conversationId=${conversationId}`)

      if (res?.success) {
        setCurrentConversation(res.conversation)
      }
    } catch (error) {
      console.error(error)
      setCurrentConversation(DEFAULT_CONVERSATION)
    } finally {
      setIsConversationLoading(false)
    }
  }, [])

  const toggleChatBot = useCallback(
    (open?: boolean, currentConversationId?: string) => {
      setIsOpen(prev => open ?? !prev)
      trackEvent(EVENTS_TRACKING.TOGGLE_CHAT_BOT)
      if (currentConversationId) {
        loadConversationById(currentConversationId)
      }
    },
    [trackEvent, loadConversationById]
  )

  const closeChatBot = useCallback(() => {
    setIsOpen(false)
    trackEvent(EVENTS_TRACKING.CLOSE_CHAT_BOT)
  }, [trackEvent])

  const toggleViewingNotification = useCallback(() => {
    setIsViewingNotification(prev => !prev)
  }, [])

  const refreshCurrentData = useCallback(() => {
    setIsViewingNotification(false)
    setCurrentNotificationViewed(null)
    setCurrentConversation(DEFAULT_CONVERSATION)
  }, [])

  const loadNotificationViewed = useCallback(
    async (notificationId: string) => {
      refreshCurrentData()
      try {
        const notification = mcpToolExecutedNotifications.find(notification => notification._id === notificationId)
        if (notification) {
          setIsViewingNotification(true)
          setCurrentNotificationViewed(notification as unknown as MCPToolNotificationMessage)
        }
      } catch (error) {
        console.error(error)
      }
    },
    [mcpToolExecutedNotifications, refreshCurrentData]
  )

  const addConversation = useCallback((conversation?: IConversationInput) => {
    // Clear notification state without resetting conversation
    setIsViewingNotification(false)
    setCurrentNotificationViewed(null)
    setIsConversationLoading(true)

    const newId = uuid()
    const newConversation = { ...(conversation || DEFAULT_CONVERSATION), id: newId }
    setCurrentConversation(newConversation)

    // Clear the selected pre-made suggestion
    setSelectedPreMadeSuggestion(null)
    setIsConversationLoading(false)

    return newId
  }, [])

  const analysisConversation = useCallback(async (conversationHistory: IMessageInput[], suggestionId?: string) => {
    try {
      // Clear the timer if it exists before fetching new suggestion
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }

      const res = await authenticatedFetch(`/api/ai-assistant/suggestion`, {
        method: 'POST',
        body: JSON.stringify({
          action: AI_ASSISTANT_SUGGESTION_ACTION.ANALYZE_CONVERSATION,
          conversationHistory,
          suggestionId,
        }),
      })

      if (res?.success && res?.analysisConversation) {
        const {
          suggestionsOptions,
          questionGainDeeper,
          defer = 0,
        } = (res.analysisConversation as ConversationAnalysisResponse) || {}

        timerRef.current = setTimeout(() => {
          setSuggestOptions({
            options: suggestionsOptions,
            title: questionGainDeeper || '',
          })
        }, defer)
      }
    } catch (error) {
      console.error(error)
    }
  }, [])

  const addMessage = useCallback((message: IMessageInput) => {
    setCurrentConversation(prev => ({
      ...prev,
      messages: [...prev.messages, message],
      lastUpdated: new Date(),
    }))
  }, [])

  const loadConversations = useCallback(async (args?: { query?: string; page?: number; limit?: number }) => {
    try {
      const { query, page = 1, limit = 10 } = args || {}

      const queryParams = new URLSearchParams()
      if (query) queryParams.set('query', query)
      if (page) queryParams.set('page', page.toString())
      if (limit) queryParams.set('limit', limit.toString())

      const res = await authenticatedFetch(`/api/ai-assistant?${queryParams.toString()}`)

      if (res?.success) {
        return res
      }

      return {
        conversations: [],
        pagination: DEFAULT_CONVERSATION_PAGINATION,
      }
    } catch (error) {
      console.error(error)
      return {
        conversations: [],
        pagination: DEFAULT_CONVERSATION_PAGINATION,
      }
    }
  }, [])

  const autoFillTemplate = useCallback((template: string) => {
    // Use the transmitter to set the input message
    Transmitter.trigger(GLOBAL_EVENTS_TRANSMITTER.SET_CHAT_BOT_INPUT_MESSAGE, { prompt: template })
  }, [])

  const saveAiMessage = useCallback(
    async (message: string, messageId: string, metadata?: Record<string, any>, isNewMessage?: boolean) => {
      try {
        await authenticatedFetch('/api/ai-assistant', {
          method: 'POST',
          body: JSON.stringify({
            action: 'save-message',
            conversationId: currentConversation.id,
            message,
            messageId,
            metadata,
            isNewMessage,
          }),
        })

        const _isNewMessage = isNewMessage ?? true

        const existingMessage = _isNewMessage
          ? null
          : (currentConversation.messages.find(message => message.id === messageId) as IMessageInput)
        // Optimistically update local state so message appears immediately
        setCurrentConversation(prev => {
          // Build new message object matching IMessageInput shape
          const newMessage = (
            existingMessage
              ? {
                  ...existingMessage,
                  content: message,
                  metadata,
                }
              : {
                  id: messageId,
                  content: message,
                  role: ConversationRole.ASSISTANT,
                  feedback: null,
                  metadata,
                  timestamp: new Date(),
                  lastUpdated: new Date(),
                }
          ) as IMessageInput

          return {
            ...prev,
            messages: existingMessage
              ? prev.messages.map(message => (message.id === messageId ? newMessage : message))
              : [...prev.messages, newMessage],
            lastUpdated: new Date(),
          }
        })
      } catch (error) {
        console.error('Failed to save AI message:', error)
      }
    },
    [currentConversation.id, currentConversation.messages]
  )

  // // Load the latest conversation on mount
  // useEffect(() => {
  //   ;(async () => {
  //     try {
  //       const res = await loadConversations({ limit: 1, page: 1 })
  //       if (res?.conversations?.length) {
  //         setCurrentConversation(res.conversations[0])
  //       }
  //     } catch (error) {
  //       console.error('Failed to load latest conversation', error)
  //     }
  //   })()
  // }, [loadConversations])

  useEffect(() => {
    const onToggleChatBot = (eventObject: any) => {
      setIsOpen(true)
      Transmitter.trigger(GLOBAL_EVENTS_TRANSMITTER.SET_CHAT_BOT_INPUT_MESSAGE, { ...eventObject.data })
    }

    Transmitter.listen(GLOBAL_EVENTS_TRANSMITTER.OPEN_CHAT_BOT, onToggleChatBot)

    return () => {
      Transmitter.remove(GLOBAL_EVENTS_TRANSMITTER.OPEN_CHAT_BOT, onToggleChatBot)
    }
  }, [])

  return (
    <ChatBotContext.Provider
      value={{
        isOpen,
        isConversationLoading,
        currentConversation,
        selectedPreMadeSuggestion,
        suggestOptions,
        mcpToolExecutedNotifications,
        mcpToolExecutedNotificationsCount,
        isViewingNotification,
        currentNotificationViewed,
        loadNotificationViewed,
        toggleViewingNotification,
        setSelectedPreMadeSuggestion,
        setSuggestOptions,
        toggleChatBot,
        closeChatBot,
        addConversation,
        addMessage,
        loadConversationById,
        loadConversations,
        analysisConversation,
        dynamicSuggestions,
        setDynamicSuggestions,
        autoSend,
        setAutoSend,
        autoFillTemplate,
        saveAiMessage,
        isCompactMode,
      }}
    >
      {children}
    </ChatBotContext.Provider>
  )
}

export function useChatBot() {
  const context = useContext(ChatBotContext)
  if (context === undefined) {
    // In development, HMR can temporarily render components outside providers.
    // Provide a safe no-op fallback instead of crashing the render tree.
    if (process.env.NODE_ENV !== 'production') {
      const devFallback: ChatBotContextType = {
        isOpen: false,
        isConversationLoading: false,
        currentConversation: DEFAULT_CONVERSATION,
        selectedPreMadeSuggestion: null,
        suggestOptions: { options: [], title: '' },
        mcpToolExecutedNotifications: [],
        mcpToolExecutedNotificationsCount: 0,
        isViewingNotification: false,
        currentNotificationViewed: null,
        toggleViewingNotification: () => {},
        loadNotificationViewed: async () => {},
        setSelectedPreMadeSuggestion: () => {},
        toggleChatBot: () => {},
        closeChatBot: () => {},
        addConversation: () => undefined,
        addMessage: () => {},
        analysisConversation: async () => {},
        setSuggestOptions: () => {},
        loadConversationById: async () => {},
        loadConversations: async () => ({
          conversations: [],
          pagination: DEFAULT_CONVERSATION_PAGINATION,
        }),
        dynamicSuggestions: [],
        setDynamicSuggestions: () => {},
        autoFillTemplate: () => {},
        saveAiMessage: async () => {},
        autoSend: false,
        setAutoSend: () => {},
        isCompactMode: false,
      }
      if (typeof window !== 'undefined') {
        const flag = '__chatbot_provider_missing_warned__'
        if (!(window as any)[flag]) {
          ;(window as any)[flag] = true
          console.warn('useChatBot: Provider missing during HMR. Using dev no-op context.')
        }
      }
      return devFallback
    }
    throw new Error('useChatBot must be used within a ChatBotProvider')
  }
  return context
}

/**
 * Checks if the merchant should be automatically sent the AI onboarding
 * @param appConfig - The app config
 * @returns True if the merchant should be automatically sent the AI onboarding, false otherwise
 */
export function checkShouldAutoSend(appConfig: any) {
  // If the merchant has not completed onboarding
  const aiOnboardingCompletedVer1 = appConfig?.occurredEvents?.ai_onboarding_completed_ver_1
  // If the merchant has not completed onboarding
  const publishedFirstIntegration = appConfig?.occurredEvents?.published_first_integration

  // If the merchant has not published first integration
  return !aiOnboardingCompletedVer1 && !publishedFirstIntegration
}
