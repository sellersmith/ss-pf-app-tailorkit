import type Konva from 'konva'
import type { RefObject } from 'react'
import CanvasGrid from '~/components/canvas/Grid/index.client'
import { useStore } from '~/libs/external-store'
import { TemplateEditorStore } from '~/stores/modules/template'
import useCanvasDimension from '~/utils/hooks/useCanvasDimension'
import { useTools } from '../../hooks/useTools'
import type { RESOLUTION } from '~/constants/resolution'
import { TOOL_LAYER_IDS } from '~/constants/canvas'

export const CanvasGridContainer = (props: { stageRef: RefObject<Konva.Stage> }) => {
  const { stageRef } = props

  const { isGridModeVisible } = useTools()

  const { widthByPixels, heightByPixels, measurementUnit, resolution } = useCanvasDimension()
  const { left, top, scale } = useStore(TemplateEditorStore, state => state.viewport)

  if (!isGridModeVisible) return null

  return (
    <CanvasGrid
      id={TOOL_LAYER_IDS.GRID}
      stageRef={stageRef}
      width={widthByPixels}
      height={heightByPixels}
      stagePos={{ x: left, y: top }}
      scale={scale}
      measurementUnit={measurementUnit}
      resolution={resolution as RESOLUTION}
    />
  )
}
