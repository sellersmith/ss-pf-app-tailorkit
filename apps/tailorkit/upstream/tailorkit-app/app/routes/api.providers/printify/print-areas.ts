import type { IFulfillmentOrderData } from '~/models/Order'
import type { PrintArea as PrintifyPrintArea } from '~/modules/Fulfillments/Printify/orders/submit'
import type { PrintifyFormattedArea } from '../type'

/**
 * Formats a single print area for Printify's API requirements.
 * Handles both legacy string format and modern object format with dimensions.
 *
 * @param printAreaConfig - The print area configuration, either a URL string or an object with dimensions
 * @returns Formatted print area configuration for Printify
 *
 * @example
 * ```ts
 * // Legacy format
 * const legacy = formatPrintifyArea('https://example.com/image.jpg')
 * console.log(legacy) // 'https://example.com/image.jpg'
 *
 * // Modern format
 * const modern = formatPrintifyArea({
 *   src: 'https://example.com/image.jpg',
 *   width: 200,
 *   height: 200,
 *   placeholder: { width: 100, height: 100 }
 * })
 * console.log(modern) // [{ src: '...', scale: 0.5, x: 0.5, y: 0.5, angle: 0 }]
 * ```
 */
export function formatPrintifyArea(printAreaConfig: any): PrintifyFormattedArea {
  // Handle legacy string format
  if (typeof printAreaConfig === 'string') {
    return printAreaConfig
  }

  // Return formatted print area configuration
  return [
    {
      // We already resize/crop the print image to fit the print area dimensions so just send it as is.
      src: printAreaConfig.src,
      // As we send the print image as is, always specify 1 for scale level.
      scale: 1,
      // Always centralize the print image in the print area without rotation.
      x: 0.5,
      y: 0.5,
      angle: 0,
    },
  ]
}

/**
 * Formats print areas specifically for Printify's API requirements.
 * Processes each print area position (front, back, etc.) and formats them accordingly.
 *
 * @param print_areas - Array of print area definitions from the fulfillment order data
 * @returns Object mapping positions to their formatted print area configurations
 *
 * @example
 * ```ts
 * const print_areas = [{
 *   front: { src: '...', width: 200, height: 200, placeholder: { width: 100, height: 100 } },
 *   back: 'https://example.com/back.jpg'
 * }]
 * const formatted = formatPrintifyPrintAreas(print_areas)
 * ```
 */
export function formatPrintifyPrintAreas(print_areas: IFulfillmentOrderData['print_areas']): PrintifyPrintArea {
  if (!print_areas) {
    return {}
  }

  const formattedAreas: PrintifyPrintArea = {}

  print_areas.forEach(print_area => {
    Object.entries(print_area).forEach(([position, printAreaConfig]) => {
      formattedAreas[position as keyof PrintifyPrintArea] = formatPrintifyArea(printAreaConfig)
    })
  })

  return formattedAreas
}
