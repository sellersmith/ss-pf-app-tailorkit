import { MAX_ZOOM_SPEED, TEMPLATE_EDITOR_CANVAS_CONTAINER } from '~/constants/canvas'
import { getWidthHeightNumberOfDom } from '~/utils/canvas/getWidthHeightNumberOfDom'
import { calculateOnInitTemplate } from '~/utils/canvas/zoom'
import { lengthUnitToPixels } from '~/utils/lengthUnitToPixels'
import type { TemplateDimension as TemplateDimensionType } from '~/types/template'
import { DEFAULT_TEMPLATE_DIMENSION, TemplateEditorStore } from '~/stores/modules/template'
import { calculateEffectiveDimension } from '~/utils/canvas/calculateEffectiveDimension'

/**
 * Recalculate the canvas viewport based on the provided template dimension.
 */
export function revaluateCanvasViewPort(newDimension: TemplateDimensionType) {
  let { width: canvasWidth, height: canvasHeight } = DEFAULT_TEMPLATE_DIMENSION

  const canvasContainerElement = document.querySelector(`.${TEMPLATE_EDITOR_CANVAS_CONTAINER}`) as HTMLElement
  const { width = 0, height = 0 } = getWidthHeightNumberOfDom(canvasContainerElement) || {}

  canvasWidth = width - MAX_ZOOM_SPEED * 2
  canvasHeight = height - MAX_ZOOM_SPEED * 2

  const {
    width: dimensionWidth,
    height: dimensionHeight,
    measurementUnit = DEFAULT_TEMPLATE_DIMENSION.measurementUnit,
    resolution = DEFAULT_TEMPLATE_DIMENSION.resolution,
  } = newDimension

  const dimensionWidthPixels = lengthUnitToPixels(dimensionWidth, measurementUnit, resolution)
  const dimensionHeightPixels = lengthUnitToPixels(dimensionHeight, measurementUnit, resolution)

  // Calculate effective dimension accounting for preview product image
  const preview = TemplateEditorStore.getState().previewProductImage
  const { effectiveDimension, contentOffset } = calculateEffectiveDimension(
    { width: dimensionWidthPixels, height: dimensionHeightPixels },
    preview
  )

  const viewport = calculateOnInitTemplate(
    canvasWidth,
    canvasHeight,
    { ...newDimension, ...effectiveDimension },
    false,
    contentOffset
  )

  return viewport
}
