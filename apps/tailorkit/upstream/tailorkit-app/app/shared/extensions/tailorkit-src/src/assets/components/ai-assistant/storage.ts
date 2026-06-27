import type { Message } from './types'
import { localStorage } from '../../utils/localStorage'

// LocalStorage key for messages
const MESSAGES_STORAGE_KEY = 'ai-assistant-messages'

/**
 * Check if localStorage is available and accessible
 */
const isLocalStorageAvailable = (): boolean => {
  try {
    // Check if localStorage exists
    if (typeof localStorage === 'undefined') {
      return false
    }

    // Test if we can actually use it (some browsers allow access but throw on usage)
    const testKey = '__localStorage_test__'
    localStorage.setItem(testKey, 'test')
    localStorage.removeItem(testKey)
    return true
  } catch (error) {
    return false
  }
}

/**
 * Save messages to localStorage with error handling
 */
export const saveMessagesToStorage = (messages: Message[]): void => {
  if (!isLocalStorageAvailable()) {
    console.warn('localStorage is not available - messages will not be persisted')
    return
  }

  try {
    localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(messages))
  } catch (error) {
    console.warn('Failed to save messages to localStorage:', error)
  }
}

/**
 * Load messages from localStorage with validation
 */
export const loadMessagesFromStorage = (): Message[] | null => {
  if (!isLocalStorageAvailable()) {
    return null
  }

  try {
    const stored = localStorage.getItem(MESSAGES_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      const isArray = Array.isArray(parsed)
      const isEvery
        = isArray
        && parsed.every(
          msg => msg && typeof msg.id === 'string' && typeof msg.role === 'string' && typeof msg.content === 'string'
        )

      // Validate the structure
      if (isEvery) {
        return parsed
      }
    }
  } catch (error) {
    console.warn('Failed to load messages from localStorage:', error)
  }
  return null
}

/**
 * Clear messages from localStorage
 */
export const clearMessagesFromStorage = (): void => {
  if (!isLocalStorageAvailable()) {
    return
  }

  try {
    localStorage.removeItem(MESSAGES_STORAGE_KEY)
  } catch (error) {
    console.warn('Failed to clear messages from localStorage:', error)
  }
}

/**
 * Get initial messages - from storage or default welcome message
 */
export const getInitialMessages = (): Message[] => {
  const storedMessages = loadMessagesFromStorage()
  if (storedMessages && storedMessages.length > 0) {
    return storedMessages
  }
  return [
    {
      id: 'assistant-1',
      role: 'assistant',
      content: 'Hello, how can I help you today?',
    },
  ]
}

/**
 * Check if localStorage is available for external use
 */
export const isStorageAvailable = (): boolean => {
  return isLocalStorageAvailable()
}
