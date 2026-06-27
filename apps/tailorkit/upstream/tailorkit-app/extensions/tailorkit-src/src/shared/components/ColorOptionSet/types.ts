import type { BaseOptionItem, BaseOptionSetProps } from '../types'

/**
 * Color-specific option item interface
 */
export interface ColorOptionItem extends BaseOptionItem {
  // Color-specific properties
  v: string // hex color value
  /** Per-colour description rendered under the swatch name in the Colour Guide modal */
  cgd?: string
}

/**
 * Color-specific option set props interface
 */
export interface ColorOptionSetProps extends BaseOptionSetProps {
  // Color-specific properties can be added here
  swatchSize?: number // Optional swatch size in pixels
}
