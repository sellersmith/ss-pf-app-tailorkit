/**
 * Vanilla DOM Bridge for AI Image Generator Preact Component
 *
 * This approach avoids the React/Preact conflict by:
 * 1. Creating a standard Web Component
 * 2. Using Preact's render() directly into a DOM container
 * 3. Not involving React at all - pure Preact solution
 *
 * Based on: extensions/tailorkit-src/src/shared/components/ImageEditorModal/vanilla-bridge-modal.tsx
 */

import { render, h } from 'preact'
import { AIImageGenerator } from './AIImageGenerator'
import type {
  AIImageGeneratorConfig,
  AIImageGeneratorWebComponentProps,
  GeneratedImage,
  GenerateParams,
} from './types'

/**
 * Deep clone utility to avoid mutation issues
 */
function deepClone<T>(value: T): T {
  try {
    if (typeof structuredClone === 'function') return structuredClone(value)
  } catch {
    // structuredClone not available or failed
  }
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return value
  }
}

/**
 * Web Component element name
 */
export const ELEMENT_NAME = 'tailorkit-ai-image-generator'

/**
 * TailorkitAIImageGeneratorElement
 *
 * A web component wrapper for the AIImageGenerator Preact component.
 * This allows the component to be used in both React (admin preview) and
 * Preact (storefront) contexts without conflicts.
 *
 * @example
 * ```typescript
 * const element = document.createElement('tailorkit-ai-image-generator')
 * element.config = { layerId: '123', layerDimensions: { width: 500, height: 500 } }
 * element.onGenerate = async (params) => {
 *   const response = await fetch('/api/generate', { body: JSON.stringify(params) })
 *   return response.json()
 * }
 * element.onSelectImage = (image) => console.log('Selected:', image)
 * container.appendChild(element)
 * ```
 */
export class TailorkitAIImageGeneratorElement
  extends HTMLElement
  implements AIImageGeneratorWebComponentProps
{
  // Configuration (can be set via property or parsed from attribute)
  public config?: AIImageGeneratorConfig

  // Callback props (must be set via property)
  public onGenerate?: (params: GenerateParams) => Promise<GeneratedImage[]>
  public onSelectImage?: (image: GeneratedImage) => void
  public onUploadReferenceImage?: (file: File) => Promise<string>

  private preactContainer: HTMLDivElement | null = null
  private mounted = false

  /**
   * Called when the element is added to the DOM
   */
  connectedCallback() {
    if (this.mounted) return

    // Create a container for Preact to render into
    this.preactContainer = document.createElement('div')
    this.preactContainer.className = 'emtlkit--ai-image-generator-container'
    this.appendChild(this.preactContainer)

    this.renderPreactComponent()
    this.mounted = true
  }

  /**
   * Called when the element is removed from the DOM
   */
  disconnectedCallback() {
    // Clean up Preact when the Web Component is removed
    if (this.preactContainer) {
      render(null, this.preactContainer)
      this.preactContainer = null
    }
    this.mounted = false
  }

  /**
   * Called when an observed attribute changes
   */
  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (oldValue === newValue) return

    // Parse config from attribute if provided
    if (name === 'data-config' && newValue) {
      try {
        this.config = JSON.parse(newValue)
      } catch (e) {
        console.error('Failed to parse config attribute:', e)
      }
    }

    // Re-render if mounted
    if (this.preactContainer && this.mounted) {
      this.renderPreactComponent()
    }
  }

  /**
   * Force a re-render of the component
   */
  public update() {
    if (this.preactContainer && this.mounted) {
      this.renderPreactComponent()
    }
  }

  /**
   * Render the Preact component into the container
   */
  private renderPreactComponent() {
    if (!this.preactContainer) return

    // Validate required props
    if (!this.config) {
      console.warn('TailorkitAIImageGeneratorElement: config is required')
      return
    }

    if (!this.onGenerate) {
      console.warn('TailorkitAIImageGeneratorElement: onGenerate callback is required')
      return
    }

    if (!this.onSelectImage) {
      console.warn('TailorkitAIImageGeneratorElement: onSelectImage callback is required')
      return
    }

    // Create wrapper callbacks to ensure proper 'this' binding
    const onGenerate = (params: GenerateParams) => {
      if (this.onGenerate) {
        return this.onGenerate(deepClone(params))
      }
      return Promise.resolve([])
    }

    const onSelectImage = (image: GeneratedImage) => {
      if (this.onSelectImage) {
        this.onSelectImage(deepClone(image))
      }
    }

    const onUploadReferenceImage = this.onUploadReferenceImage
      ? (file: File) => this.onUploadReferenceImage!(file)
      : undefined

    // Create a wrapper component to avoid mutating the exported symbol
    const Bridge = (p: any) => h(AIImageGenerator, p)

    // Render the Preact component
    render(
      h(Bridge, {
        // Spread config props
        ...deepClone(this.config),
        // Callback props
        onGenerate,
        onSelectImage,
        onUploadReferenceImage,
      }),
      this.preactContainer
    )
  }

  /**
   * Define which attributes to observe for changes
   */
  static get observedAttributes() {
    return ['data-config']
  }
}

/**
 * Register the custom element
 */
export function registerAIImageGeneratorElement() {
  if (!customElements.get(ELEMENT_NAME)) {
    customElements.define(ELEMENT_NAME, TailorkitAIImageGeneratorElement)
  }
}

// Extend global HTMLElementTagNameMap for TypeScript support
declare global {
  interface HTMLElementTagNameMap {
    [ELEMENT_NAME]: TailorkitAIImageGeneratorElement
  }
}

