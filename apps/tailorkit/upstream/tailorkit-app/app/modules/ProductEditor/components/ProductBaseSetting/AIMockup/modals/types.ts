import type { AllowedAspectRatio } from '~/routes/api.ai-assistant.suggestion/constants'

export interface Scene {
  scene: string
  suggestPrompt: string
  tags: string[]
  thumbnailUrl?: string
}

export interface GeneratedMockup {
  url: string
  id: string
  aspectRatio: AllowedAspectRatio
}

export interface ReferenceImage {
  url: string
  width: number
  height: number
  altText?: string
}
