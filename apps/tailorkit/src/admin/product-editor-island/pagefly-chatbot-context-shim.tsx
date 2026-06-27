import React from 'react'

/**
 * PageFly seam for copied TailorKit `~/providers/ChatBotContext`.
 *
 * The copied ProductEditor reads `useChatBot()` for layout flags (`isOpen`,
 * `toggleChatBot`), but the PageFly host does not bundle the TailorKit AI
 * assistant/chat stack. This shim keeps the editor mounting without the chat
 * provider by reporting a permanently-closed, no-op chat. The exported
 * constants mirror upstream values so any copied module that imports them
 * (AIChat/ChatBotDrawer) still resolves at build time even when its UI is
 * pruned from the editor bundle.
 */
interface PageFlyChatBotContextValue {
  isOpen: boolean
  toggleChatBot(): void
}

const closedChatBot: PageFlyChatBotContextValue = {
  isOpen: false,
  toggleChatBot() {
    return undefined
  },
}

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

export function ChatBotProvider({ children }: { children: React.ReactNode }) {
  return React.createElement(React.Fragment, null, children)
}

export function useChatBot(): PageFlyChatBotContextValue {
  return closedChatBot
}

/** PageFly admin never auto-sends AI assistant messages; chat is disabled here. */
export function checkShouldAutoSend(_appConfig: unknown): boolean {
  return false
}
