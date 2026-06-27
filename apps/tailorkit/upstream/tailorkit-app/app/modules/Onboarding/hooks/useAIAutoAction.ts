import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { SUGGESTIONS } from '~/components/AIChat/constants'
import { ConversationRole } from '~/enums/conversationMessage'
import type { ShopDocument } from '~/models/Shop'
import { checkShouldAutoSend, ELVA_WELCOME_MESSAGE, useChatBot } from '~/providers/ChatBotContext'
import { uuid } from '~/utils/uuid'

type AIAutoActionOptions = {
  /** Whether to create a new conversation immediately */
  createConversation?: boolean
  /** Whether to add a welcome message immediately */
  addWelcomeMessage?: boolean
  /** Whether to allow auto-send logic */
  allowAutoSend?: boolean
}

export const useAIAutoAction = (
  appConfig: ShopDocument['appConfig'],
  options: AIAutoActionOptions = { createConversation: true, addWelcomeMessage: true, allowAutoSend: true }
) => {
  const { t } = useTranslation()
  const { addConversation, setDynamicSuggestions, setAutoSend, autoSend, addMessage } = useChatBot()

  const handleAIAutoAction = useCallback(() => {
    // Optionally create a new conversation
    if (options.createConversation) {
      addConversation()
    }

    // Optionally add welcome message
    if (options.addWelcomeMessage) {
      addMessage({
        id: uuid(),
        content: t(ELVA_WELCOME_MESSAGE),
        role: ConversationRole.ASSISTANT,
        feedback: null,
        timestamp: new Date(),
        metadata: {
          type: 'welcome',
        },
      })
    }

    // Build suggestions list depending on whether the merchant has completed onboarding
    const generatedSuggestions: (typeof SUGGESTIONS)[number][] = SUGGESTIONS.filter(s => s.onboarding)
    setDynamicSuggestions(generatedSuggestions)

    const shouldOpenAIOnboarding = checkShouldAutoSend(appConfig)

    // For new users who haven't seen AI onboarding ver 1 and have no messages,
    // automatically fill and send the sample prompt when they open the chat
    const shouldAutoSend
      = options.allowAutoSend && shouldOpenAIOnboarding && !autoSend && generatedSuggestions.length > 0

    if (shouldAutoSend) {
      setAutoSend(true)
    }
  }, [
    addConversation,
    addMessage,
    appConfig,
    autoSend,
    options.addWelcomeMessage,
    options.allowAutoSend,
    options.createConversation,
    setAutoSend,
    setDynamicSuggestions,
    t,
  ])

  return {
    handleAIAutoAction,
  }
}
