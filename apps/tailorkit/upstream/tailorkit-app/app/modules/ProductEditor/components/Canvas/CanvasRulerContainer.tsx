import { useParams } from '@remix-run/react'
import type Konva from 'konva'
import type { RefObject } from 'react'
import { useMemo } from 'react'
import { useStore } from '~/libs/external-store'
import { useTools } from '~/modules/TemplateEditor/hooks/useTools'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import { useLocalStorage } from '~/utils/hooks/useLocalStorage'
import CanvasRuler from '../../../../components/canvas/Ruler/index.client'
import { TOOL_LAYER_IDS } from '~/constants/canvas'

const INITIAL_GUIDES = {
  horizontal: [],
  vertical: [],
}

export const CanvasRulerContainer = (props: { stageRef: RefObject<Konva.Stage> }) => {
  const { stageRef } = props

  const { isRulerModeVisible } = useTools()
  const { left, top, scale } = useStore(IntegrationStore, state => state.viewport)
  const { id } = useParams()

  const RULER_MODE_LOCAL_STORAGE_KEY = `ruler-mode-${id}`
  const [guides, setGuides] = useLocalStorage(RULER_MODE_LOCAL_STORAGE_KEY, INITIAL_GUIDES)

  const stagePos = useMemo(() => {
    return {
      x: left,
      y: top,
    }
  }, [left, top])

  const layerPos = useMemo(() => {
    // We need to transform the rulerPos to the root of the stage
    // Because the stage is wheeling and panning, so the rulerPos is not the left top of the canvas
    // We need to transform it to the root of the stage
    return {
      x: -stagePos.x / scale,
      y: -stagePos.y / scale,
    }
  }, [stagePos, scale])

  if (!isRulerModeVisible) return null

  return (
    <CanvasRuler
      id={TOOL_LAYER_IDS.RULER}
      layerPos={layerPos}
      stagePos={stagePos}
      scale={1 / scale}
      width={stageRef.current?.width() || 0}
      height={stageRef.current?.height() || 0}
      guides={guides}
      measurementUnit={'px'}
      resolution={300}
      setGuides={setGuides}
    />
  )
}
