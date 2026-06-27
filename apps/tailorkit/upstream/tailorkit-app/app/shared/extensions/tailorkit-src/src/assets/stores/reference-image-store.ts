/**
 * Simple store for AI reference images.
 * This allows file references to survive DOM cloning in modal mode.
 */

interface ReferenceImageData {
  file: File
  previewUrl: string
}

const store = new Map<string, ReferenceImageData>()

export const ReferenceImageStore = {
  /**
   * Set a reference image for a layer
   */
  set(layerId: string, file: File): string {
    // Clean up old preview URL if exists
    const existing = store.get(layerId)
    if (existing?.previewUrl) {
      URL.revokeObjectURL(existing.previewUrl)
    }

    const previewUrl = URL.createObjectURL(file)
    store.set(layerId, { file, previewUrl })
    return previewUrl
  },

  /**
   * Get reference image data for a layer
   */
  get(layerId: string): ReferenceImageData | undefined {
    return store.get(layerId)
  },

  /**
   * Get only the file for a layer
   */
  getFile(layerId: string): File | undefined {
    return store.get(layerId)?.file
  },

  /**
   * Clear reference image for a layer
   */
  clear(layerId: string): void {
    const existing = store.get(layerId)
    if (existing?.previewUrl) {
      URL.revokeObjectURL(existing.previewUrl)
    }
    store.delete(layerId)
  },

  /**
   * Check if a layer has a reference image
   */
  has(layerId: string): boolean {
    return store.has(layerId)
  },
}

