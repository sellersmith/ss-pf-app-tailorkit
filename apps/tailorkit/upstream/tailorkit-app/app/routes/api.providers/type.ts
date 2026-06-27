import type { PrintArea as PrintifyPrintArea } from '~/modules/Fulfillments/Printify/orders/submit'

/**
 * Configuration for a single image in a Printify print area
 */
export type PrintifyImageConfig = {
  /** URL of the image source */
  src: string
  /** Scale factor to apply to the image (between 0 and 1) */
  scale: number
  /** Horizontal position (0 to 1, where 0.5 is center) */
  x: number
  /** Vertical position (0 to 1, where 0.5 is center) */
  y: number
  /** Rotation angle in degrees */
  angle: number
}

/**
 * Represents a print area format that can be either:
 * - A legacy string format (direct URL)
 * - An array of image configurations with positioning and scaling
 */
export type PrintifyFormattedArea = string | PrintifyImageConfig[]

/**
 * Response from submitting an order to Printify
 */
export interface PrintifyOrderResponse {
  id: string
  status: string
  [key: string]: any
}

export type { PrintifyPrintArea }
