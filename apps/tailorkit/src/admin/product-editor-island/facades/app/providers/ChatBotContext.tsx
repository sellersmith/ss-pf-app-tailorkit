import React from 'react'

const ADAPTER_MARKER = 'app-platform-chatbot-context-adapter'

export const DEFAULT_CONVERSATION_PAGINATION = {
  page: 1,
  limit: 10,
  total: 0,
  pages: 1,
}

export const PERSONALIZED_PRODUCT_TEMPLATE = 'personalized-product-template-message'
export const PERSONALIZED_PRODUCT_TEMPLATE_2 = 'personalized-product-template-message-2'
export const ELVA_WELCOME_MESSAGE = 'elva-ai-assistant-welcome-message'
export const TEMPLATE_TEMPLATE = 'template-template-message'

export function useChatBot() {
  return {
    isOpen: false,
    isCompactMode: false,
    toggleChatBot() {
      void ADAPTER_MARKER
    },
    closeChatBot() {
      void ADAPTER_MARKER
    },
  }
}

export function ChatBotProvider({ children }: { children?: React.ReactNode }) {
  return <>{children}</>
}
