import { urlToFile } from '../handlers/event-handlers/image-editor/upload-service'
import type { TailorKitProductPersonalizer } from './product-personalizer'

/**
 * Handles canvas preview generation and file management.
 * Static fields are keyed per-instance so multiple product-personalizer WCs
 * on the same page have independent debounce timers and preview caches.
 *
 * DOM-free file handling (2026-04):
 *   The canvas preview File is cached in-memory (keyed by variantId) and
 *   injected into cart FormData by the fetch interceptor at submit time.
 *   We deliberately do NOT append `<input type="file">` to the ATC form
 *   because some themes' AJAX cart scripts (e.g. Modular 3.2.0) skip
 *   submission entirely when a file input is present:
 *     if (form.querySelector('[type="file"]')) return  // theme bails out
 *   Keeping the file out of the form DOM avoids triggering that bailout
 *   while still uploading the preview via interceptor-injected FormData.
 */
export class CanvasPreviewManager {
  /** Per-instance debounce timers — key is instanceId */
  private static debounceTimers = new Map<string, number>()
  /** Per-instance last-preview cache (base64) — key is instanceId */
  private static lastPreviews = new Map<string, string | null>()
  /**
   * Per-variant cached File object — key is variantId (stringified).
   * Bounded (LRU) to avoid unbounded growth when buyers browse many variants.
   * Map preserves insertion order, so the first key is the oldest.
   */
  private static cachedFiles = new Map<string, File>()
  private static readonly MAX_CACHED_FILES = 5

  /**
   * Debounced canvas preview generation to avoid performance issues.
   *
   * NOTE: Legacy file-input cleanup runs SYNCHRONOUSLY on every call (not inside
   * the debounced callback). This is critical for themes like Modular 3.2.0 whose
   * AJAX cart handler bails out when `form.querySelector('[type="file"]')` is truthy:
   * even if the buyer never edits the canvas (so no preview is ever generated and
   * the debounced callback never runs its own cleanup), server-rendered HTML from
   * an older app build may still contain `<input type="file" class="emtlkit--canvas-preview-input">`.
   * Clearing it up-front on mount/change guarantees the theme handler can proceed.
   *
   * @param instanceId - Unique identifier for the product-personalizer instance
   */
  static debouncedGenerateCanvasPreview(
    instanceId: string,
    productPersonalizer: TailorKitProductPersonalizer,
    addToCartForms: HTMLFormElement[]
  ) {
    // Eager, idempotent back-compat cleanup — runs every time (mount + option change).
    // See method JSDoc for the Modular-bailout rationale.
    for (const form of addToCartForms) {
      CanvasPreviewManager.clearLegacyFileInputs(form)
    }

    // Clear existing debounce timer for this instance
    const existing = CanvasPreviewManager.debounceTimers.get(instanceId)
    if (existing !== null && existing !== undefined) {
      clearTimeout(existing)
    }

    // Set new debounce timer
    const timerId = window.setTimeout(async () => {
      await CanvasPreviewManager.generateCanvasPreview(instanceId, productPersonalizer, addToCartForms)
    }, 300) // 300ms debounce delay

    CanvasPreviewManager.debounceTimers.set(instanceId, timerId)
  }

  /**
   * Generate canvas preview and update forms
   */
  private static async generateCanvasPreview(
    instanceId: string,
    productPersonalizer: TailorKitProductPersonalizer,
    addToCartForms: HTMLFormElement[]
  ) {
    try {
      if (productPersonalizer?.getCanvasPreviewDataURL) {
        const canvasPreviewBase64 = productPersonalizer.getCanvasPreviewDataURL()
        const lastPreview = CanvasPreviewManager.lastPreviews.get(instanceId) ?? null

        // Skip if the canvas preview hasn't changed
        if (canvasPreviewBase64 === lastPreview) {
          return
        }

        // Update forms with new canvas preview
        await CanvasPreviewManager.updateFormsWithCanvasPreview(canvasPreviewBase64, addToCartForms)

        // Only update cache after successful form updates
        CanvasPreviewManager.lastPreviews.set(instanceId, canvasPreviewBase64)
      }
    } catch (error) {
      console.warn('Failed to generate canvas preview:', error)
      // Cache remains unchanged on error, preventing redundant regeneration attempts
    }
  }

  /**
   * Update per-variant file cache with canvas preview.
   *
   * Does NOT append `<input type="file">` to the form DOM — see class JSDoc
   * for the rationale. The cart fetch interceptor reads this cache at submit
   * time and injects the File into the outgoing FormData as
   * `properties[${CANVAS_PREVIEW_PROPERTY_KEY}]` so buyers still get the
   * preview attached to their cart item.
   *
   * Also removes any legacy file inputs that older builds may have left in
   * the form (back-compat / safety for themes that cached old HTML).
   */
  private static async updateFormsWithCanvasPreview(canvasPreviewBase64: string, addToCartForms: HTMLFormElement[]) {
    for (const addToCartForm of addToCartForms) {
      // Back-compat cleanup: remove any file input injected by older versions.
      CanvasPreviewManager.clearLegacyFileInputs(addToCartForm)

      const variantId = (addToCartForm.querySelector('input[name="id"]') as HTMLInputElement | null)?.value
      if (!variantId) continue

      try {
        const file = await urlToFile(canvasPreviewBase64, `tlk-canvas-preview-${Date.now()}`)
        CanvasPreviewManager.setCachedFile(variantId, file)
      } catch (error) {
        console.warn('Failed to build canvas preview File for cache:', error)
      }
    }
  }

  /**
   * LRU write: evicts the oldest entry when at capacity, then re-inserts the
   * given variant as most-recent. Prevents unbounded File accumulation when a
   * buyer browses many variants on a long session.
   */
  private static setCachedFile(variantId: string, file: File): void {
    // Touch: remove existing entry so the re-set marks it most-recent.
    CanvasPreviewManager.cachedFiles.delete(variantId)

    // Evict oldest if at capacity.
    if (CanvasPreviewManager.cachedFiles.size >= CanvasPreviewManager.MAX_CACHED_FILES) {
      const oldestKey = CanvasPreviewManager.cachedFiles.keys().next().value
      if (oldestKey !== undefined) {
        CanvasPreviewManager.cachedFiles.delete(oldestKey)
      }
    }

    CanvasPreviewManager.cachedFiles.set(variantId, file)
  }

  /**
   * Retrieve the cached canvas preview File for a variant. Consumed by the
   * cart fetch interceptor to inject the preview into outgoing FormData.
   *
   * LRU touch on read: moves the entry to the most-recent position so active
   * variants survive eviction longer than idle ones.
   */
  static getCachedFile(variantId: string | number | undefined | null): File | null {
    if (variantId === undefined || variantId === null || variantId === '') return null
    const key = String(variantId)
    const file = CanvasPreviewManager.cachedFiles.get(key)
    if (!file) return null
    // LRU touch.
    CanvasPreviewManager.cachedFiles.delete(key)
    CanvasPreviewManager.cachedFiles.set(key, file)
    return file
  }

  /**
   * Remove any file input elements that were appended to the form by older
   * builds of this class. Newer builds keep the File out of the DOM entirely.
   *
   * We simply remove the node — no `DataTransfer`-based files-reset, because
   * `new DataTransfer()` is unreliable on older mobile Safari versions and
   * redundant when the element is detached anyway.
   */
  private static clearLegacyFileInputs(addToCartForm: HTMLFormElement) {
    const existingCanvasInputs = addToCartForm.querySelectorAll('.emtlkit--canvas-preview-input')
    existingCanvasInputs.forEach(input => {
      input.parentNode?.removeChild(input)
    })
  }

  static cleanup(instanceId: string = 'default') {
    const timerId = CanvasPreviewManager.debounceTimers.get(instanceId)
    if (timerId !== null && timerId !== undefined) {
      clearTimeout(timerId)
      CanvasPreviewManager.debounceTimers.delete(instanceId)
    }
    CanvasPreviewManager.lastPreviews.delete(instanceId)
    // Note: cachedFiles are keyed by variantId (not instanceId), so they are
    // not cleared here — they may still be needed for in-flight cart adds
    // and get overwritten on the next preview generation for the same variant.
  }

  /**
   * Clean up all instances — for full teardown.
   */
  static cleanupAll() {
    CanvasPreviewManager.debounceTimers.forEach(timerId => clearTimeout(timerId))
    CanvasPreviewManager.debounceTimers.clear()
    CanvasPreviewManager.lastPreviews.clear()
    CanvasPreviewManager.cachedFiles.clear()
  }
}
