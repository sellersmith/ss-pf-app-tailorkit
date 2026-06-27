import { EPROVIDER } from '~/constants/fulfillment-providers'
import type { IFulfillmentOrderData } from '~/models/Order'
import type { PrintArea as PrintifyPrintArea } from '~/modules/Fulfillments/Printify/orders/submit'
import type { PrintifyFormattedArea } from './type'

/**
 * Computes the scale factor required to resize an image so that it fits within a given placeholder area,
 * while preserving the image's original aspect ratio.
 *
 * The scale factor is determined by comparing the ratio of the placeholder dimensions to the image dimensions.
 * It returns the smaller ratio to ensure that both the width and height of the image are scaled appropriately,
 * preventing any dimension from exceeding the placeholder size. If any dimension is zero or undefined, the function
 * defaults to a scale factor of 1 (i.e., no scaling).
 *
 * @param {number} imageWidth - The original width of the image.
 * @param {number} imageHeight - The original height of the image.
 * @param {number} placeholderWidth - The width of the area in which the image must fit.
 * @param {number} placeholderHeight - The height of the area in which the image must fit.
 * @returns {number} The computed scale factor (a value between 0 and 1) to apply to the image dimensions.
 */
function calculateImageScale(
  imageWidth: number,
  imageHeight: number,
  placeholderWidth: number,
  placeholderHeight: number
): number {
  // If no dimensions provided, return default scale of 1
  if (!imageWidth || !imageHeight || !placeholderWidth || !placeholderHeight) {
    return 1
  }

  // Calculate scale ratios
  const widthRatio = placeholderWidth / imageWidth
  const heightRatio = placeholderHeight / imageHeight

  // Use the smaller ratio to ensure image fits in both dimensions
  // If ratios are > 1, it means image is smaller than placeholder, so keep original size
  const scale = Math.min(1, widthRatio, heightRatio)

  return scale
}

/**
 * Formats a single print area for Printify
 */
function formatPrintifyArea(printAreaConfig: any): PrintifyFormattedArea {
  // Handle legacy string format
  if (typeof printAreaConfig === 'string') {
    return printAreaConfig
  }

  const scale = calculateImageScale(
    printAreaConfig.width,
    printAreaConfig.height,
    printAreaConfig.placeholder?.width,
    printAreaConfig.placeholder?.height
  )

  // Return formatted print area configuration
  return [
    {
      src: printAreaConfig.src,
      scale,
      x: 0.5,
      y: 0.5,
      angle: 0,
    },
  ]
}

/**
 * Formats print areas specifically for Printify
 */
function formatPrintifyPrintAreas(print_areas: IFulfillmentOrderData['print_areas']): PrintifyPrintArea {
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

/**
 * Transforms and formats print areas for the given fulfillment provider.
 *
 * This function processes the provided print areas based on the vendor type.
 * For Printify, it handles both legacy string format and detailed object format with scaling.
 *
 * @param print_areas - An array of print area definitions
 * @param vendor - The fulfillment provider (e.g., EPROVIDER.PRINTIFY)
 * @returns Formatted print areas according to the vendor's requirements
 * @throws Error if vendor is invalid
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
    default:
      return print_areas
  }
}
