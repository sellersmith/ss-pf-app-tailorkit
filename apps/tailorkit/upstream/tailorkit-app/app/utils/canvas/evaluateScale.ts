import type { Dimension } from '~/types/template'
import { getWidthHeightNumberOfDom } from './getWidthHeightNumberOfDom'
import { calculateOnInitTemplate } from './zoom'

export function evaluateScale(
  widthContainer: number | null,
  heightContainer: number | null,
  canvasWidth: number,
  canvasHeight: number
) {
  if (!widthContainer || !heightContainer) return null

  const scaleX = widthContainer > canvasWidth ? canvasWidth / widthContainer : widthContainer / canvasWidth
  const scaleY = heightContainer > canvasHeight ? canvasHeight / heightContainer : heightContainer / canvasHeight

  return Math.min(scaleX, scaleY)
}

export function evaluateLayerContainerScaleInPrintArea(
  container: { width: number; height: number },
  psd: { width: number; height: number }
) {
  return {
    scaleX: container.width / psd.width,
    scaleY: container.height / psd.height,
  }
}

/**
 * Evaluate the viewport of the stage when opening the template
 * @param selector
 * @param dimension
 * @param scaleUpStageViewPort
 * @param contentOffset - Optional offset if content doesn't start at (0, 0)
 * @returns
 */
export const evaluateStageViewPort = (
  selector: string,
  dimension: Dimension,
  scaleUpStageViewPort: boolean = false,
  contentOffset?: { offsetX: number; offsetY: number }
) => {
  // Calculate the viewport of the template when opening the template
  const canvasContainerElement = document.querySelector(`.${selector}`) as HTMLElement
  const { width = 0, height = 0 } = getWidthHeightNumberOfDom(canvasContainerElement) || {}

  const canvasWidth = width
  const canvasHeight = height

  const viewport = calculateOnInitTemplate(canvasWidth, canvasHeight, dimension, scaleUpStageViewPort, contentOffset)

  return viewport
}
