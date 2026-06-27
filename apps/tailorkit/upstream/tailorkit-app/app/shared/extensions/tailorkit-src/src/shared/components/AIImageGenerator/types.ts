/**
 * Types for AIImageGenerator Web Component
 */

export interface LayerDimensions {
  width: number
  height: number
}

export interface GenerativeOptions {
  prompt?: string
  templateType?: string
  visualStyle?: string
  contentTheme?: string
  aspectRatio?: string
}

export interface GenerateImageData {
  prompt: string
  referenceFiles: File[]
  aspectRatio: string
  templateType?: string
  visualStyle?: string
  contentTheme?: string
}

export interface AIImageGeneratorProps {
  layerId: string
  layerDimensions: LayerDimensions
  generativeOptions?: GenerativeOptions
  // Feature toggles
  allowCustomerToUseReferenceImage?: boolean
  enabledQuickPrompts?: string[]
  enabledTemplateTypes?: string[]
  enabledVisualStyles?: string[]
  enabledContentThemes?: string[]
  allowCustomerToUseQuickPrompts?: boolean
  allowCustomerToUseTemplateTypes?: boolean
  allowCustomerToUseVisualStyles?: boolean
  allowCustomerToUseContentThemes?: boolean
  // UI options
  disabledGenerate?: boolean
  disabledGenerateMessage?: string
  showTitle?: boolean
  // Callbacks - injected by parent for business logic
  onGenerate: (data: GenerateImageData) => Promise<void> | void
  onGenerateStart?: () => void
  onGenerateComplete?: () => void
  onGenerateError?: (error: Error) => void
}

export interface AIImageGeneratorWebComponentProps extends AIImageGeneratorProps {
  // Additional props for web component usage
  close?: () => void
}




