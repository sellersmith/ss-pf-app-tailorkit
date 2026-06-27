/**
 * Konva Loader Utility
 *
 * Provides a promise-based API to wait for the Konva module to load.
 * Used by product-personalizer, image-editor, and other components that depend on Konva.
 */

import type { KonvaCanvasManager as KonvaCanvasManagerType } from '../../shared/libraries/konva/core/konva-canvas-manager'
import type Konva from 'konva'
import type { TransformerConfig } from 'konva/lib/shapes/Transformer'
import type { KonvaEditor, KonvaEditorConfig } from '../handlers/event-handlers/image-editor/types/editor-types'

// Constants
const KONVA_LOAD_TIMEOUT = 15000 // 15 seconds
export const KONVA_READY_EVENT = 'tailorkit:konva-ready'

// Type for the initKonvaEditor function
export type InitKonvaEditorFn = (
  containerId: string,
  imageElement: HTMLImageElement,
  config: KonvaEditorConfig,
  transformerConfig?: Partial<TransformerConfig>
) => Promise<KonvaEditor>

export interface TailorKitKonvaModule {
  Konva: typeof Konva
  KonvaCanvasManager: typeof KonvaCanvasManagerType
  initKonvaEditor: InitKonvaEditorFn
  ready: boolean
}

// Simplified interface for global declaration to avoid duplicate type errors
// when the file is compiled from both extensions/ and app/shared/extensions/ paths.
// Classes with private properties from different paths are incompatible in TypeScript.
interface TailorKitKonvaGlobal {
  Konva: unknown
  KonvaCanvasManager: unknown
  initKonvaEditor: InitKonvaEditorFn
  ready: boolean
}

declare global {
  interface Window {
    TailorKitKonva?: TailorKitKonvaGlobal
    __tailorkit_konva_ready_callbacks__?: Array<(error?: Error) => void>
  }
}

let konvaReadyPromise: Promise<TailorKitKonvaModule> | null = null

/**
 * Returns a promise that resolves when the Konva module is loaded.
 * Safe to call multiple times - returns the same promise.
 *
 * @throws Error if the Konva module fails to load within the timeout period
 */
export function waitForKonva(): Promise<TailorKitKonvaModule> {
  if (konvaReadyPromise) {
    return konvaReadyPromise
  }

  konvaReadyPromise = new Promise<TailorKitKonvaModule>((resolve, reject) => {
    // Check if already loaded
    if (window.TailorKitKonva?.ready) {
      resolve(window.TailorKitKonva as TailorKitKonvaModule)
      return
    }

    let resolved = false

    // Set timeout for loading
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true
        const error = new Error(
          `Konva module failed to load within ${KONVA_LOAD_TIMEOUT / 1000} seconds. `
            + 'Check if tailorkit-konva.js is being blocked or failed to download.'
        )
        // Notify any pending callbacks about the error
        window.__tailorkit_konva_ready_callbacks__?.forEach(cb => cb(error))
        delete window.__tailorkit_konva_ready_callbacks__
        reject(error)
      }
    }, KONVA_LOAD_TIMEOUT)

    const resolveAndCleanup = (error?: Error) => {
      if (resolved) return
      resolved = true
      clearTimeout(timeoutId)

      if (error) {
        reject(error)
        return
      }

      if (window.TailorKitKonva) {
        resolve(window.TailorKitKonva as TailorKitKonvaModule)
      } else {
        reject(new Error('Konva module loaded but not properly initialized'))
      }
    }

    // Register callback for when Konva loads
    window.__tailorkit_konva_ready_callbacks__ = window.__tailorkit_konva_ready_callbacks__ || []
    window.__tailorkit_konva_ready_callbacks__.push(resolveAndCleanup)

    // Also listen for the event (belt and suspenders)
    document.addEventListener(KONVA_READY_EVENT, () => resolveAndCleanup(), { once: true })
  })

  return konvaReadyPromise
}

/**
 * Check if Konva is currently available (synchronous check)
 */
export function isKonvaReady(): boolean {
  return window.TailorKitKonva?.ready === true
}

/**
 * Get the Konva module if available, otherwise null
 */
export function getKonvaModule(): TailorKitKonvaModule | null {
  return window.TailorKitKonva?.ready ? (window.TailorKitKonva as TailorKitKonvaModule) : null
}

/**
 * Reset the Konva loader state to allow retry after a failed load.
 * Call this if waitForKonva() rejected and you want to retry loading.
 */
export function resetKonvaLoader(): void {
  konvaReadyPromise = null
}
