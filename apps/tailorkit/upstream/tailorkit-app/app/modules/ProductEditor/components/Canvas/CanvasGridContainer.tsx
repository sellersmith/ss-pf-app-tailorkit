import type Konva from 'konva'
import type { RefObject } from 'react'
import CanvasGrid from '~/components/canvas/Grid/index.client'
import { TOOL_LAYER_IDS } from '~/constants/canvas'
import { useStore } from '~/libs/external-store'
import { useTools } from '~/modules/TemplateEditor/hooks/useTools'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import type { Dimension } from '~/types/template'

export const CanvasGridContainer = (props: { stageRef: RefObject<Konva.Stage>; dimension: Dimension }) => {
  const { stageRef, dimension } = props

  const { isGridModeVisible } = useTools()

  const { left, top, scale } = useStore(IntegrationStore, state => state.viewport)

  if (!isGridModeVisible) return null

  return (
    <CanvasGrid
      id={TOOL_LAYER_IDS.GRID}
      stageRef={stageRef}
      width={dimension.width}
      height={dimension.height}
      stagePos={{ x: left, y: top }}
      scale={scale}
    />
  )
}
