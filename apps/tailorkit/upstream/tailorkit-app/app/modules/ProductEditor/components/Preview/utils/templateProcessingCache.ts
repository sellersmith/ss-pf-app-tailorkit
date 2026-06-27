import type { Template } from '~/types/psd'

interface CacheEntry {
  processedTemplate: Template
  timestamp: number
}

/**
 * Cache for processed templates to avoid reprocessing
 * Key format: `${templateId}-${printAreaId}`
 */
class TemplateProcessingCache {
  private cache = new Map<string, CacheEntry>()
  private readonly TTL = 5 * 60 * 1000 // 5 minutes TTL

  /**
   * Get cached processed template
   */
  get(templateId: string, printAreaId: string): Template | null {
    const key = `${templateId}-${printAreaId}`
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    // Check if entry is expired
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(key)
      return null
    }

    return entry.processedTemplate
  }

  /**
   * Set cached processed template
   */
  set(templateId: string, printAreaId: string, processedTemplate: Template): void {
    const key = `${templateId}-${printAreaId}`
    this.cache.set(key, {
      processedTemplate,
      timestamp: Date.now(),
    })
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Clear cached entry for specific template and print area
   */
  clearEntry(templateId: string, printAreaId: string): void {
    const key = `${templateId}-${printAreaId}`
    this.cache.delete(key)
  }

  /**
   * Clear all entries for a specific template
   */
  clearTemplate(templateId: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${templateId}-`)) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    }
  }
}

export const templateProcessingCache = new TemplateProcessingCache()
