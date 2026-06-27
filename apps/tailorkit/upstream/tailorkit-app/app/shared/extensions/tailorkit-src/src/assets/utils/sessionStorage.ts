/**
 * sessionStorage utility with fallback support
 * Handles cases where sessionStorage is not available (SSR, disabled storage, etc.)
 * Used for image-related data that should not persist across browser sessions
 */

import type { StorageInterface } from './localStorage'
import { MemoryStorage } from './localStorage'

/**
 * Check if sessionStorage is available and functional
 */
function isSessionStorageAvailable(): boolean {
  try {
    if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') {
      return false
    }

    const testKey = '__sessionStorage_test__'
    const testValue = 'test'

    window.sessionStorage.setItem(testKey, testValue)
    const retrievedValue = window.sessionStorage.getItem(testKey)
    window.sessionStorage.removeItem(testKey)

    return retrievedValue === testValue
  } catch (error) {
    return false
  }
}

/**
 * Safe sessionStorage wrapper with fallback support
 */
class SafeSessionStorage {
  private storage: StorageInterface
  private isAvailable: boolean

  constructor() {
    this.isAvailable = isSessionStorageAvailable()
    this.storage = this.isAvailable ? window.sessionStorage : new MemoryStorage()
  }

  /**
   * Get an item from storage
   */
  getItem(key: string): string | null {
    try {
      return this.storage.getItem(key)
    } catch (error) {
      console.warn(`Failed to get item "${key}" from session storage:`, error)
      return null
    }
  }

  /**
   * Set an item in storage
   */
  setItem(key: string, value: string): boolean {
    try {
      this.storage.setItem(key, value)
      return true
    } catch (error) {
      console.warn(`Failed to set item "${key}" in session storage:`, error)
      return false
    }
  }

  /**
   * Remove an item from storage
   */
  removeItem(key: string): boolean {
    try {
      this.storage.removeItem(key)
      return true
    } catch (error) {
      console.warn(`Failed to remove item "${key}" from session storage:`, error)
      return false
    }
  }

  /**
   * Clear all items from storage
   */
  clear(): boolean {
    try {
      this.storage.clear()
      return true
    } catch (error) {
      console.warn('Failed to clear session storage:', error)
      return false
    }
  }

  /**
   * Get a key by index
   */
  key(index: number): string | null {
    try {
      return this.storage.key(index)
    } catch (error) {
      console.warn(`Failed to get key at index ${index}:`, error)
      return null
    }
  }

  /**
   * Get the number of items in storage
   */
  get length(): number {
    try {
      return this.storage.length
    } catch (error) {
      console.warn('Failed to get session storage length:', error)
      return 0
    }
  }

  /**
   * Check if sessionStorage is available
   */
  get isSessionStorageAvailable(): boolean {
    return this.isAvailable
  }

  /**
   * Get JSON data from storage
   */
  getJSON<T = unknown>(key: string): T | null {
    try {
      const item = this.getItem(key)
      return item ? JSON.parse(item) : null
    } catch (error) {
      console.warn(`Failed to parse JSON for key "${key}":`, error)
      return null
    }
  }

  /**
   * Set JSON data in storage
   */
  setJSON<T = unknown>(key: string, value: T): boolean {
    try {
      const jsonString = JSON.stringify(value)
      return this.setItem(key, jsonString)
    } catch (error) {
      console.warn(`Failed to stringify JSON for key "${key}":`, error)
      return false
    }
  }

  /**
   * Get all keys from storage
   */
  getAllKeys(): string[] {
    try {
      const keys: string[] = []
      for (let i = 0; i < this.length; i++) {
        const key = this.key(i)
        if (key) {
          keys.push(key)
        }
      }
      return keys
    } catch (error) {
      console.warn('Failed to get all keys:', error)
      return []
    }
  }

  /**
   * Check if a key exists in storage
   */
  hasKey(key: string): boolean {
    return this.getItem(key) !== null
  }
}

// Create and export singleton instance
export const sessionStorage = new SafeSessionStorage()

// Export class for external use
export { SafeSessionStorage, isSessionStorageAvailable }
