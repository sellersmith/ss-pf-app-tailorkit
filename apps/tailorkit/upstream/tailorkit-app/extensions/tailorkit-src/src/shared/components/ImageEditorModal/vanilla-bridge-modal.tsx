/** @jsxImportSource preact */
/**
 * Vanilla DOM Bridge for Preact Component
 *
 * This approach avoids the React/Preact conflict by:
 * 1. Creating a standard Web Component
 * 2. Using Preact's render() directly into a DOM container
 * 3. Not involving React at all - pure Preact solution
 *
 * Based on: https://stackoverflow.com/questions/60907068/how-to-include-preact-component-with-hooks-in-react-app
 * The key insight is to use Preact's render() function directly into a DOM node,
 * avoiding any React/Preact interop issues.
 */

import { render, h } from 'preact'
import { PreactImageEditorModal } from './preact-image-editor-modal'
import type {
  ImageEditorModalWebComponentProps,
  LayerDimensions,
  EditorState,
  MaskConfig,
  OnRemoveBackgroundContext,
} from './preact-image-editor-modal'
import type { TransformerConfig } from 'konva/lib/shapes/Transformer'

function deepClone<T>(value: T): T {
  try {
    // Prefer structuredClone when available
    // @ts-ignore
    if (typeof structuredClone === 'function') return structuredClone(value)
  } catch {}
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return value
  }
}

export class EmtlkitImageEditorModalElement extends HTMLElement implements ImageEditorModalWebComponentProps {
  // Props from the interface
  public objectUrl!: string
  public layerDimensions!: LayerDimensions
  public imageElement!: HTMLImageElement
  public initialState?: EditorState
  public transformerConfig?: Partial<TransformerConfig>
  public initialBackgroundRemoved?: boolean
  public maskConfig?: MaskConfig
  public onCancel?: () => void
  public onSubmit?: (state: EditorState, url: string, removedBackground?: boolean) => Promise<void> | void
  public onReplaceImage?: () => void
  public onRemoveBackground?: (ctx: OnRemoveBackgroundContext) => Promise<void> | void

  private preactContainer: HTMLDivElement | null = null

  connectedCallback() {
    // Create a container for Preact to render into
    this.preactContainer = document.createElement('div')
    this.appendChild(this.preactContainer)

    this.renderPreactComponent()
  }

  disconnectedCallback() {
    // Clean up Preact when the Web Component is removed
    if (this.preactContainer) {
      render(null, this.preactContainer)
      this.preactContainer = null
    }
  }

  // Re-render when attributes change
  attributeChangedCallback() {
    if (this.preactContainer) {
      this.renderPreactComponent()
    }
  }

  private renderPreactComponent() {
    if (!this.preactContainer) return

    const close = () => {
      // Remove this element from the DOM
      if (this.parentNode) {
        this.parentNode.removeChild(this)
      }
    }

    // Use Preact's render() with explicit props to ensure a fresh, extensible object each render
    // Wrap the exported component in a local function to avoid mutating the exported symbol
    const Bridge = (p: any) => h(PreactImageEditorModal, p)

    render(
      h(Bridge, {
        objectUrl: String(this.objectUrl ?? ''),
        layerDimensions: this.layerDimensions ? deepClone(this.layerDimensions) : undefined,
        imageElement: this.imageElement,
        initialState: this.initialState ? deepClone(this.initialState) : undefined,
        transformerConfig: this.transformerConfig ? deepClone(this.transformerConfig) : undefined,
        initialBackgroundRemoved: this.initialBackgroundRemoved,
        maskConfig: this.maskConfig ? deepClone(this.maskConfig) : undefined,
        onCancel: this.onCancel ? () => this.onCancel && this.onCancel() : undefined,
        onSubmit: this.onSubmit
          ? (state: EditorState, url: string, removedBg?: boolean) =>
              this.onSubmit && this.onSubmit(state, url, removedBg)
          : undefined,
        onReplaceImage: this.onReplaceImage ? () => this.onReplaceImage && this.onReplaceImage() : undefined,
        onRemoveBackground: this.onRemoveBackground
          ? (ctx: OnRemoveBackgroundContext) => this.onRemoveBackground && this.onRemoveBackground({ ...ctx })
          : undefined,
        close,
      }),
      this.preactContainer
    )
  }

  // Define which attributes to observe for changes
  static get observedAttributes() {
    return [
      'objectUrl',
      'layerDimensions',
      'imageElement',
      'initialState',
      'transformerConfig',
      'initialBackgroundRemoved',
      'maskConfig',
    ]
  }
}

// Register the custom element
export function registerImageEditorModalElement() {
  if (!customElements.get('tailorkit-image-editor-modal')) {
    customElements.define('tailorkit-image-editor-modal', EmtlkitImageEditorModalElement)
    console.log('Image editor modal registered via vanilla Preact bridge')
  }
}
