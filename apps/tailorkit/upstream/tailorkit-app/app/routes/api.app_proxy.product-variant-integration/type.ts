interface ProductMetafield {
  value: unknown
}

export interface AppBlockInstallationSettings {
  personalized_design_title: string
  featured_image_container_selector: string
  /** 1-based position of the product image to render preview on (1 = first). */
  featured_image_position: number
  /** Auto-navigate gallery to featured_image_position when customer focuses personalizer input. */
  auto_navigate_on_focus: boolean
  always_render_live_preview: boolean
  layout_type: 'customizer'
}

interface TailorkitCustomizerArgs {
  settings?: AppBlockInstallationSettings
  productOnProductPage: Record<string, unknown>
  variantId: string | number
  productAppMetafield: unknown
  locale?: string
  appSettings?: Record<string, unknown> | null
  globalStyling?: Record<string, unknown> | null
}

export type { ProductMetafield, TailorkitCustomizerArgs }
