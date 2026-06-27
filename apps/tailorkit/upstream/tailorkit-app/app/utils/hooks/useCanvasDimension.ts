import { CANVAS_HEIGHT, CANVAS_WIDTH } from '~/constants/canvas'
import { useStore } from '~/libs/external-store'
import { DEFAULT_TEMPLATE_DIMENSION, TemplateEditorStore } from '~/stores/modules/template'
import type { TemplateDimension } from '~/types/template'
import { lengthUnitToPixels } from '../lengthUnitToPixels'
import { useState, useEffect } from 'react'

/**
 * This function converts length unit to standard pixels
 * @returns { widthByPixels: number, heightByPixels: number } & TemplateDimension
 */

export default function useCanvasDimension(): {
  widthByPixels: number
  heightByPixels: number
} & TemplateDimension {
  const dimension = useStore(TemplateEditorStore, state => state.dimension)

  // State for canvas dimension
  const [canvasDimension, setCanvasDimension] = useState<
    {
      widthByPixels: number
      heightByPixels: number
    } & TemplateDimension
  >({
    ...DEFAULT_TEMPLATE_DIMENSION,
    widthByPixels: CANVAS_WIDTH,
    heightByPixels: CANVAS_HEIGHT,
  })

  useEffect(() => {
    if (!dimension) {
      setCanvasDimension({
        ...DEFAULT_TEMPLATE_DIMENSION,
        widthByPixels: CANVAS_WIDTH,
        heightByPixels: CANVAS_HEIGHT,
      })
      return
    }

    const {
      width,
      height,
      resolution = DEFAULT_TEMPLATE_DIMENSION.resolution,
      measurementUnit = DEFAULT_TEMPLATE_DIMENSION.measurementUnit,
    } = dimension

    const widthByPixels = lengthUnitToPixels(width, measurementUnit, resolution)
    const heightByPixels = lengthUnitToPixels(height, measurementUnit, resolution)

    setCanvasDimension({
      widthByPixels,
      heightByPixels,
      width,
      height,
      resolution,
      measurementUnit,
    })
  }, [dimension])

  return canvasDimension
}
