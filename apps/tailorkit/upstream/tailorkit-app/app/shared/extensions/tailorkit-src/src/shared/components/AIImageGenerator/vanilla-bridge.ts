/**
 * Vanilla DOM Bridge for AIImageGenerator Preact Component
 *
 * This approach avoids the React/Preact conflict by:
 * 1. Creating a standard Web Component
 * 2. Using Preact's render() directly into a DOM container
 * 3. Not involving React at all - pure Preact solution
 */

import { render, h } from 'preact'
import { PreactAIImageGenerator } from './preact-ai-generator'
import type {
  AIImageGeneratorWebComponentProps,
  LayerDimensions,
  GenerativeOptions,
  GenerateImageData,
} from './types'

function deepClone<T>(value: T): T {
  try {
    if (typeof structuredClone === 'function') return structuredClone(value)
  } catch {
    // Fall through to JSON approach
  }
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return value
  }
}

export class TailorkitAIImageGeneratorElement extends HTMLElement implements AIImageGeneratorWebComponentProps {
  // Required props
  public layerId!: string
  public layerDimensions!: LayerDimensions

  // Optional configuration
  public generativeOptions?: GenerativeOptions
  public allowCustomerToUseReferenceImage?: boolean
  public enabledQuickPrompts?: string[]
  public enabledTemplateTypes?: string[]
  public enabledVisualStyles?: string[]
  public enabledContentThemes?: string[]
  public allowCustomerToUseQuickPrompts?: boolean
  public allowCustomerToUseTemplateTypes?: boolean
  public allowCustomerToUseVisualStyles?: boolean
  public allowCustomerToUseContentThemes?: boolean
  public disabledGenerate?: boolean
  public disabledGenerateMessage?: string
  public showTitle?: boolean

  // Callbacks - injected by parent for business logic
  public onGenerate!: (data: GenerateImageData) => Promise<void> | void
  public onGenerateStart?: () => void
  public onGenerateComplete?: () => void
  public onGenerateError?: (error: Error) => void

  private preactContainer: HTMLDivElement | null = null

  connectedCallback() {
    // Create a container for Preact to render into
    this.preactContainer = document.createElement('div')
    this.appendChild(this.preactContainer)

    // Don't render immediately - wait for props to be set via update()
    // This prevents rendering with empty/undefined props
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

  // Public method to trigger re-render from outside
  public update() {
    if (this.preactContainer) {
      this.renderPreactComponent()
    }
  }

  private renderPreactComponent() {
    if (!this.preactContainer) return

    const close = () => {
      if (this.parentNode) {
        this.parentNode.removeChild(this)
      }
    }

    // Use Preact's render() with explicit props
    const Bridge = (p: AIImageGeneratorWebComponentProps) => h(PreactAIImageGenerator, p)

    render(
      h(Bridge, {
        layerId: String(this.layerId ?? ''),
        layerDimensions: this.layerDimensions ? deepClone(this.layerDimensions) : { width: 500, height: 500 },
        generativeOptions: this.generativeOptions ? deepClone(this.generativeOptions) : undefined,
        allowCustomerToUseReferenceImage: this.allowCustomerToUseReferenceImage,
        enabledQuickPrompts: this.enabledQuickPrompts ? [...this.enabledQuickPrompts] : undefined,
        enabledTemplateTypes: this.enabledTemplateTypes ? [...this.enabledTemplateTypes] : undefined,
        enabledVisualStyles: this.enabledVisualStyles ? [...this.enabledVisualStyles] : undefined,
        enabledContentThemes: this.enabledContentThemes ? [...this.enabledContentThemes] : undefined,
        allowCustomerToUseQuickPrompts: this.allowCustomerToUseQuickPrompts,
        allowCustomerToUseTemplateTypes: this.allowCustomerToUseTemplateTypes,
        allowCustomerToUseVisualStyles: this.allowCustomerToUseVisualStyles,
        allowCustomerToUseContentThemes: this.allowCustomerToUseContentThemes,
        disabledGenerate: this.disabledGenerate,
        disabledGenerateMessage: this.disabledGenerateMessage,
        showTitle: this.showTitle,
        onGenerate: this.onGenerate
          ? (data: GenerateImageData) => this.onGenerate && this.onGenerate(deepClone(data))
          : async () => {},
        onGenerateStart: this.onGenerateStart ? () => this.onGenerateStart?.() : undefined,
        onGenerateComplete: this.onGenerateComplete ? () => this.onGenerateComplete?.() : undefined,
        onGenerateError: this.onGenerateError ? (error: Error) => this.onGenerateError?.(error) : undefined,
        close,
      }),
      this.preactContainer
    )
  }

  // Define which attributes to observe for changes
  static get observedAttributes() {
    return [
      'layerId',
      'layerDimensions',
      'generativeOptions',
      'allowCustomerToUseReferenceImage',
      'enabledQuickPrompts',
      'enabledTemplateTypes',
      'enabledVisualStyles',
      'enabledContentThemes',
      'allowCustomerToUseQuickPrompts',
      'allowCustomerToUseTemplateTypes',
      'allowCustomerToUseVisualStyles',
      'allowCustomerToUseContentThemes',
      'disabledGenerate',
      'disabledGenerateMessage',
      'showTitle',
    ]
  }
}

// Register the custom element
export function registerAIImageGeneratorElement() {
  if (!customElements.get('tailorkit-ai-image-generator')) {
    customElements.define('tailorkit-ai-image-generator', TailorkitAIImageGeneratorElement)
    console.log('AI Image Generator registered via vanilla Preact bridge')
  }
}



