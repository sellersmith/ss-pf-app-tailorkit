/**
 * localStorage utility with fallback support
 * Handles cases where localStorage is not available (SSR, disabled storage, etc.)
 */

interface StorageInterface {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  clear(): void
  key(index: number): string | null
  readonly length: number
}

/**
 * In-memory storage fallback when localStorage is not available
 */
class MemoryStorage implements StorageInterface {
  private storage: Map<string, string> = new Map()

  getItem(key: string): string | null {
    return this.storage.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.storage.set(key, value)
  }

  removeItem(key: string): void {
    this.storage.delete(key)
  }

  clear(): void {
    this.storage.clear()
  }

  key(index: number): string | null {
    const keys = Array.from(this.storage.keys())
    return keys[index] ?? null
  }

  get length(): number {
    return this.storage.size
  }
}

/**
 * Check if localStorage is available and functional
 */
function isLocalStorageAvailable(): boolean {
  try {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
      return false
    }

    const testKey = '__localStorage_test__'
    const testValue = 'test'

    window.localStorage.setItem(testKey, testValue)
    const retrievedValue = window.localStorage.getItem(testKey)
    window.localStorage.removeItem(testKey)

    return retrievedValue === testValue
  } catch (error) {
    return false
  }
}

/**
 * Safe localStorage wrapper with fallback support
 */
class SafeLocalStorage {
  private storage: StorageInterface
  private isAvailable: boolean

  constructor() {
    this.isAvailable = isLocalStorageAvailable()
    this.storage = this.isAvailable ? window.localStorage : new MemoryStorage()
  }

  /**
   * Get an item from storage
   */
  getItem(key: string): string | null {
    try {
      return this.storage.getItem(key)
    } catch (error) {
      console.warn(`Failed to get item "${key}" from storage:`, error)
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
      console.warn(`Failed to set item "${key}" in storage:`, error)
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
      console.warn(`Failed to remove item "${key}" from storage:`, error)
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
      console.warn('Failed to clear storage:', error)
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
      console.warn('Failed to get storage length:', error)
      return 0
    }
  }

  /**
   * Check if localStorage is available
   */
  get isLocalStorageAvailable(): boolean {
    return this.isAvailable
  }

  /**
   * Get JSON data from storage
   */
  getJSON<T = any>(key: string): T | null {
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
  setJSON<T = any>(key: string, value: T): boolean {
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
export const localStorage = new SafeLocalStorage()

// Export types for external use
export type { StorageInterface }
export { SafeLocalStorage, MemoryStorage, isLocalStorageAvailable }
