import type { OptionSet } from '~/types/psd'

type OptionPricing = {
  value: number // User input amount
  flatRate: number // USD equivalent for consistent pricing calculations
}

/** Overlay metadata for SVG overlays on image options */
type ImageOptionOverlayMetadata = {
  imageWidth: number
  imageHeight: number
  hasClipPaths: boolean
  hasFilters: boolean
  hasDrawnPaths: boolean
}

/** SVG overlay data for image options (created in VectorEditor) */
type ImageOptionOverlay = {
  overlaySvg?: string
  overlayMetadata?: ImageOptionOverlayMetadata
}

type ImageOptionSetData = {
  files: [
    {
      _id: string
      src: string
      name: string
      selecting: string
      additionalPricing?: OptionPricing // Comprehensive pricing object for image options

      // Optional transform data (template editor)
      width?: number
      height?: number
      left?: number
      top?: number
      rotate?: number

      // Optional SVG overlay data (VectorEditor)
      overlay?: ImageOptionOverlay

      // Pre-composited thumbnail URL (for web component rendering)
      compositedThumbnailSrc?: string
    },
  ]
}

type TextOptionSetData = {
  texts: [
    {
      _id: string
      name: string
      selecting: string
      additionalPricing?: OptionPricing // Comprehensive pricing object for text options
    },
  ]
}

type ColorOptionSetData = {
  colors: [
    {
      _id: string
      name: string
      value: string
      selecting: string
      additionalPricing?: OptionPricing // Comprehensive pricing object for color options
      // Optional descriptive copy shown under the swatch inside the Colour Guide modal
      // (e.g. "Heated leaf foil pressed into leather"). v1 locked decision 2026-05-18.
      colourGuideDescription?: string
    },
  ]
  // S3 URL of merchant-uploaded Colour Guide reference image. Falls back to
  // appConfig.appMetafields.colourGuide.defaultImageUrl at publish time when empty.
  colourGuideImageUrl?: string
  // Optional intro/description shown above the swatch list in the Colour Guide modal.
  // Falls back to appConfig.appMetafields.colourGuide.defaultDescription when empty.
  colourGuideDescription?: string
}

type FontOptionSetData = {
  fonts: [
    {
      _id: string
      name: string
      family: string
      src: string
      selecting: string
      additionalPricing?: OptionPricing // Comprehensive pricing object for font options
    },
  ]
}

type ImagelessOptionSetData = {
  values: [
    {
      _id: string
      name: string
      value: string
      selecting: string
      thumbnail: string
      additionalPricing?: OptionPricing // Comprehensive pricing object for imageless options
    },
  ]
}

type Layout = {
  _id: string
  name: string
  layerIds: string[]
  thumbnail: string
}

type MultiLayoutOptionSetData = {
  multi_layout: {
    _id: string
    layoutNumber: number
    layouts: Layout[]
    layoutSelected?: string
  }
}

export type EOptionSetEditingMode = 'sync' | 'individual'

export type OptionSetDocument = {
  _id: string
  type: OptionSet
  label: string
  values?: [unknown]
  createdAt: Date
  updatedAt: Date
  shopDomain: string
  labelOnStoreFront: string
  editingMode?: EOptionSetEditingMode
  /**
   * Toggle for the extra pricing feature on this option set.
   * When undefined, treat as auto-detected from item pricing data (legacy behavior).
   */
  additionalPricingEnabled?: boolean
  /** Original base layer state when entering individual mode (for image options) */
  originalBaseState?: {
    width: number
    height: number
    left: number
    top: number
    rotate: number
  }
  /** Original clipGroup state when entering individual mode (for image options) */
  originalClipGroup?: {
    absoluteX: number
    absoluteY: number
    absoluteWidth: number
    absoluteHeight: number
    rotation: number
  }
  data?:
    | ImageOptionSetData
    | TextOptionSetData
    | ColorOptionSetData
    | FontOptionSetData
    | ImagelessOptionSetData
    | MultiLayoutOptionSetData
}

// Export types for use in other modules
export type { OptionPricing, ImageOptionOverlay, ImageOptionOverlayMetadata }
