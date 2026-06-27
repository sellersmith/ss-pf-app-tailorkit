import type { BaseOptionItem, BaseOptionSetProps } from '../types'

/**
 * Image-specific option item interface
 */
export interface ImageOptionItem extends BaseOptionItem {
  // Image-specific properties
  v: string // image URL
  l: string // label/alt text
  s?: number // selection state (1 for selected, undefined for not selected)
  additionalPricing?: any // pricing data
  compositedThumbnailSrc?: string // Pre-composited thumbnail URL with overlay applied
  overlay?: {
    // SVG overlay data from VectorEditor
    overlaySvg: string
    overlayMetadata?: any
  }
}

/**
 * Image-specific option set props interface
 */
export interface ImageOptionSetProps extends BaseOptionSetProps {
  // Image-specific properties
  imageSize?: number // Optional image size in pixels
  displayStyle?: 'image_swatch' | 'image_dropdown_grid' // Display style for the image options
}
