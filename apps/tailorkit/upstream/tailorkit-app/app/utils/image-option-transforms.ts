import type { ImageOptionSet } from '~/types/psd'

/**
 * Base layer transform interface
 */
export interface BaseLayerTransform {
  width: number
  height: number
  left: number
  top: number
  rotate: number
}

/**
 * Computed transform result
 */
export interface ComputedTransform {
  width: number
  height: number
  left: number
  top: number
  rotate: number
}

/**
 * Scale factor for coordinate transformation
 */
export interface ScaleFactor {
  x: number
  y: number
}

/**
 * Image option with percentage-based transforms
 */
interface ImageOptionWithPercentages extends ImageOptionSet {
  widthPct?: number
  heightPct?: number
  leftPct?: number
  topPct?: number
  rotateDelta?: number
}

/**
 * Evaluates the transform of a selected image option, handling both percentage-based
 * and absolute transforms. This function is shared between client and server code
 * to ensure consistent evaluation logic.
 *
 * @param selectedOption - The image option data
 * @param baseLayerTransform - The base layer's current transform
 * @param scale - Optional scale factor for coordinate transformation
 * @returns The computed transform for the selected option
 */
export function evaluateImageOptionTransform(
  selectedOption: ImageOptionSet,
  baseLayerTransform: BaseLayerTransform,
  scale?: ScaleFactor
): ComputedTransform {
  const option = selectedOption as ImageOptionWithPercentages

  // Check if the option has percentage-based transforms
  const hasPercentageTransforms = [
    option.widthPct,
    option.heightPct,
    option.leftPct,
    option.topPct,
    option.rotateDelta,
  ].some(value => value !== undefined)

  let computedTransform: ComputedTransform

  if (hasPercentageTransforms && baseLayerTransform.width > 0 && baseLayerTransform.height > 0) {
    // Use percentage-based calculation
    computedTransform = {
      width:
        option.widthPct !== undefined
          ? option.widthPct * baseLayerTransform.width
          : (option.width ?? baseLayerTransform.width),
      height:
        option.heightPct !== undefined
          ? option.heightPct * baseLayerTransform.height
          : (option.height ?? baseLayerTransform.height),
      left:
        option.leftPct !== undefined
          ? baseLayerTransform.left + option.leftPct * baseLayerTransform.width
          : (option.left ?? baseLayerTransform.left),
      top:
        option.topPct !== undefined
          ? baseLayerTransform.top + option.topPct * baseLayerTransform.height
          : (option.top ?? baseLayerTransform.top),
      rotate:
        option.rotateDelta !== undefined
          ? baseLayerTransform.rotate + option.rotateDelta
          : (option.rotate ?? baseLayerTransform.rotate),
    }
  } else {
    // Use absolute transforms or fallback to base layer
    computedTransform = {
      width: option.width ?? baseLayerTransform.width,
      height: option.height ?? baseLayerTransform.height,
      left: option.left ?? baseLayerTransform.left,
      top: option.top ?? baseLayerTransform.top,
      rotate: option.rotate ?? baseLayerTransform.rotate,
    }
  }

  // Apply scale transformation if provided
  if (scale) {
    return {
      width: computedTransform.width * scale.x,
      height: computedTransform.height * scale.y,
      left: computedTransform.left * scale.x,
      top: computedTransform.top * scale.y,
      rotate: computedTransform.rotate, // Rotation doesn't scale
    }
  }

  return computedTransform
}

/**
 * Finds and evaluates the transform for a selected image option by source URL.
 * This is commonly used in order rendering where we need to find the option
 * that matches the selected image source.
 *
 * @param imageOptionSet - The image option set data
 * @param selectedSrc - The source URL of the selected image
 * @param baseLayerTransform - The base layer's current transform
 * @param scale - Optional scale factor for coordinate transformation
 * @returns The computed transform for the selected option, or null if not found
 */
export function evaluateSelectedImageOption(
  imageOptionSet: { data?: { files?: ImageOptionSet[] } | any } | undefined,
  selectedSrc: string,
  baseLayerTransform: BaseLayerTransform,
  scale?: ScaleFactor
): ComputedTransform | null {
  // Handle different data structure formats (files vs images)
  const files = imageOptionSet?.data?.files || imageOptionSet?.data?.images || []
  const selectedOption = files.find((f: ImageOptionSet) => f.src === selectedSrc)

  if (!selectedOption) {
    return null
  }

  return evaluateImageOptionTransform(selectedOption, baseLayerTransform, scale)
}

/**
 * Creates a design state object compatible with the existing API format.
 * This is used in server-side preparation functions.
 *
 * @param transform - The computed transform
 * @returns Design state object with w, h, l, t, r properties
 */
export function transformToDesignState(transform: ComputedTransform) {
  return {
    w: transform.width,
    h: transform.height,
    l: transform.left,
    t: transform.top,
    r: transform.rotate,
  }
}
