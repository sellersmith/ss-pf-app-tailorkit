import { EPROVIDER } from '~/constants/fulfillment-providers'
import type { IFulfillmentOrderData } from '~/models/Order'
import type { PrintArea as PrintifyPrintArea } from '~/modules/Fulfillments/Printify/orders/submit'
import { formatPrintifyPrintAreas } from './printify/print-areas'

/**
 * @deprecated Use adapter.transformForSubmission() instead. Will be removed in a future version.
 *
 * Transforms and formats print areas for the given fulfillment provider.
 * This function routes the print area formatting to the appropriate provider-specific handler.
 *
 * For Printify:
 * - Handles both legacy string format and modern object format
 * - Scales images to fit within placeholder dimensions
 * - Centers images in the print area
 *
 * @param print_areas - Array of print area definitions
 * @param vendor - The fulfillment provider (e.g., EPROVIDER.PRINTIFY)
 * @returns Formatted print areas according to the vendor's requirements
 *
 * @example
 * ```ts
 * const print_areas = [{
 *   front: { src: '...', width: 200, height: 200, placeholder: { width: 100, height: 100 } }
 * }]
 * const formatted = preparePrintAreasFulfillmentProvider(print_areas, EPROVIDER.PRINTIFY)
 * ```
 */
export function preparePrintAreasFulfillmentProvider(
  print_areas: IFulfillmentOrderData['print_areas'],
  vendor: EPROVIDER
): PrintifyPrintArea | IFulfillmentOrderData['print_areas'] {
  // Early return if print_areas is falsy
  if (!print_areas) {
    return {}
  }

  // Return print_areas if vendor is not supported
  if (!Object.values(EPROVIDER).includes(vendor)) {
    return print_areas
  }

  switch (vendor) {
    case EPROVIDER.PRINTIFY:
      return formatPrintifyPrintAreas(print_areas)
    case EPROVIDER.SHINEON:
      // ShineOn uses flat properties, no print area transformation needed
      return print_areas
    default:
      return print_areas
  }
}
