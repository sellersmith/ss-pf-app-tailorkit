import type { ProductTemplate, Sku } from '@sellersmith/shineon-sdk'

export interface EngravingSlotConfig {
  /** Number of engraving lines supported (0-4) */
  lineCount: number
  /** Whether product supports custom artwork upload */
  supportsArtwork: boolean
  /** Whether product has size options (rings) */
  hasSizeOption: boolean
  /** Default max characters per engraving line */
  defaultMaxChars: number
  /** Known font options (defaults) */
  defaultFonts: string[]
}

/** Default character limit per engraving line (ShineOn doesn't enforce via API) */
const DEFAULT_MAX_CHARS = 20

/** Common ShineOn fonts (Tangerine is the default for most jewelry) */
const DEFAULT_FONTS = ['Tangerine', 'Dancing Script', 'Great Vibes', 'Pacifico']

/**
 * Determines engraving slot configuration from a ShineOn product template.
 * Falls back to sensible defaults when API data is incomplete.
 */
export function getEngravingSlots(template: ProductTemplate): EngravingSlotConfig {
  const hasEngravings = !!template.engraving_sibling_id
  const supportsArtwork = !!template.buyer_uploads
  const hasSizeOption = !!template.metafields?.size_option

  // Default to 2 engraving lines for products with engraving support
  // Most ShineOn jewelry products support 2 lines
  const lineCount = hasEngravings ? 2 : 0

  return {
    lineCount,
    supportsArtwork,
    hasSizeOption,
    defaultMaxChars: DEFAULT_MAX_CHARS,
    defaultFonts: [...DEFAULT_FONTS],
  }
}

/**
 * Determines engraving slot configuration from a ShineOn SKU.
 * SKU properties contain more detailed info than templates.
 */
export function getEngravingSlotsFromSku(sku: Sku): EngravingSlotConfig {
  const engravingCount = typeof sku.properties?.engravings === 'number' ? sku.properties.engravings : 0
  const supportsArtwork = (sku.properties?.buyer_uploads ?? 0) > 0
  const hasSizeOption = !!sku.properties?.size_option

  return {
    lineCount: engravingCount,
    supportsArtwork,
    hasSizeOption,
    defaultMaxChars: DEFAULT_MAX_CHARS,
    defaultFonts: [...DEFAULT_FONTS],
  }
}
