import { signal } from '@preact/signals'
import type { Message } from './types'
import { getInitialMessages, saveMessagesToStorage, clearMessagesFromStorage } from './storage'

// Global messages signal
export const messagesSig = signal<Message[]>(getInitialMessages())

// Save messages to localStorage whenever the signal changes
messagesSig.subscribe(messages => {
  saveMessagesToStorage(messages)
})

/**
 * Clear conversation and reset to initial state
 */
export const clearConversation = (): void => {
  const initialMessages: Message[] = [
    {
      id: 'assistant-1',
      role: 'assistant',
      content: 'Hello, how can I help you today?',
    },
  ]
  messagesSig.value = initialMessages
  clearMessagesFromStorage()
}
