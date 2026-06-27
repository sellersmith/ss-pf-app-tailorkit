// Default to vanilla Preact bridge to avoid React/Preact interop issues
export { TailorkitAIImageGeneratorElement, registerAIImageGeneratorElement } from './vanilla-bridge'
export { PreactAIImageGenerator } from './preact-ai-generator'
export type {
  AIImageGeneratorProps,
  AIImageGeneratorWebComponentProps,
  GenerateImageData,
  GenerativeOptions,
  LayerDimensions,
} from './types'




