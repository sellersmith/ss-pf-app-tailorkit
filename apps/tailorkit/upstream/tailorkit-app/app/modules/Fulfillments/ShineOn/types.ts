/**
 * App-specific types for ShineOn integration.
 * API types (ProductTemplate, Sku, Order, etc.) are now imported from @sellersmith/shineon-sdk.
 */

// Normalized product format for import wizard
export interface ShineOnNormalizedProduct {
  productId: string
  title: string
  description: string
  images: string[]
  baseProfitMargin: number
  baseCost: number
  metalType?: string
  productType?: string
  hasEngravings: boolean
  buyerUploads: boolean
}

// Personalization mapping types
export interface ShineOnEngravingLineMapping {
  lineNumber: number
  layerId: string | null
  maxChars: number
}

export interface ShineOnFontMapping {
  layerId: string | null
  defaultFont: string
  allowedFonts: string[]
}

export interface ShineOnSizeMapping {
  layerId: string | null
  optionSetId: string | null
}

export interface ShineOnPrintUrlMapping {
  source: 'canvas-render'
  printAreaId: string | null
}

export interface ShineOnMapping {
  engravingLines: ShineOnEngravingLineMapping[]
  fontMapping: ShineOnFontMapping
  sizeMapping: ShineOnSizeMapping
  printUrl: ShineOnPrintUrlMapping
}
