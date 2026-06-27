export interface PromptPresetDocument {
  _id: string
  name: string
  alias?: string
  ordering: number
  imported?: boolean
  thumbnail?: string[]
  instruction: string
  shopDomain?: string
  createdAt?: Date | string
  updatedAt?: Date | string
  type?: 'quick_prompt' | 'template_type' | 'visual_style' | 'content_theme'
  hot?: boolean
  category?: 'engraved' | 'illustrative' | 'festive' | null
  presetVersion?: number
}
