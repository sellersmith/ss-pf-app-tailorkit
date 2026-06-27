import type Konva from 'konva'
import { createRef, Fragment, memo, useCallback, useEffect, useMemo } from 'react'
import CanvasEditor, { type ICanvasEditorProps } from '~/components/canvas/CanvasEditor.client'
import { Box, InlineStack } from '@shopify/polaris'
import styles from '~/components/canvas/ToolBar/styles.module.css'
import { useStore } from '~/libs/external-store'
import type { TLayerStore } from '~/stores/modules/layer'
import { TemplateEditorStore } from '~/stores/modules/template'
import { ProgressStore } from '~/stores/canvas/progress'
import type { ViewPort } from '~/types/template'
import useCanvasDimension from '~/utils/hooks/useCanvasDimension'
import useDevices from '~/utils/hooks/useDevice'
import useWindowSize from '~/utils/hooks/useWindowSize'
import { ZoomComponentContainer } from '../../contexts/ZoomContext'
import { RenderElementCanvas } from '../../elements/render.client'
import { useTools } from '../../hooks/useTools'
import { EElementType } from '../Outline/Header/ButtonAddElements'
import AddElementsTools from './AddElementsTools'
import { ProgressProcessPSD } from './ProgressProcessPSD'
import { useEditorParams } from '~/modules/ProductEditor/hooks'

interface ICardCanvasProps {
  extractedLayerStores: TLayerStore[]
}

function CardCanvasComponent(props: ICardCanvasProps) {
  const { extractedLayerStores } = props

  // Due to layers are painted step by step so the after layer will overwrite the before layer
  // so we need to reverse the list
  const reversedExtractedLayerStores = [...extractedLayerStores]
    .reverse()
    .filter(layerStore => !layerStore.getState().isGroupLayer)

  const extracting = useStore(TemplateEditorStore, state => state.extracting)
  const progressTotal = useStore(ProgressStore, state => state.total)
  const { previewMode } = useEditorParams()
  const isAnchorDragging = useStore(TemplateEditorStore, state => state.isAnchorDragging)
  const snappable = !isAnchorDragging

  const { widthByPixels, heightByPixels } = useCanvasDimension()

  const { isGrabbing } = useTools()
  const options = useMemo(
    () => ({ interactive: true, previewMode, isGrabbing, snappable }),
    [previewMode, isGrabbing, snappable]
  )

  // Only show ProgressProcessPSD when extracting AND there's active progress
  // This prevents showing stale progress UI when state is not properly reset
  const shouldShowProgress = extracting && progressTotal > 0

  return (
    <Fragment>
      {shouldShowProgress ? (
        <ProgressProcessPSD />
      ) : (
        <CanvasContainer canvasWidth={widthByPixels} canvasHeight={heightByPixels} options={options}>
          {reversedExtractedLayerStores.map((extractedLayerStore, _index) => (
            <LayerContainer extractedLayerStore={extractedLayerStore} key={extractedLayerStore.getState()._id} />
          ))}
        </CanvasContainer>
      )}

      {/* Element creation tools */}
      {/* {!previewMode && <ElementCreationTools />} */}
    </Fragment>
  )
}

/**
 * Element creation tools component
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ElementCreationTools() {
  const { isSmallMobileView } = useDevices()
  const { width } = useWindowSize()
  /**
   * Determine which element types should be excluded from the Add Elements tool
   * based on the current window width. This helps to optimize the UI for smaller screens.
   * - If width < 1071px: Exclude both AI_IMAGE and CLIPART types.
   * - If width < 1161px: Exclude only the CLIPART type.
   * - Otherwise: Do not exclude any types.
   */
  const excludeTypes = useMemo(() => {
    if (width < 1071) {
      return [EElementType.AI_IMAGE, EElementType.CLIPART]
    }

    if (width < 1161) {
      return [EElementType.CLIPART]
    }

    return []
  }, [width])

  if (isSmallMobileView) return null

  return (
    <div className={styles.ToolBelt}>
      <Box
        id="styling-toolbar-container"
        borderRadius="200"
        background="bg-surface"
        padding="100"
        shadow="border-inset"
      >
        <InlineStack align="center" blockAlign="center" gap={'100'} wrap={false}>
          <AddElementsTools excludeTypes={excludeTypes} />
        </InlineStack>
      </Box>
    </div>
  )
}

export default memo(CardCanvasComponent)

export function CanvasContainer(props: {
  canvasWidth: number
  canvasHeight: number
  children: React.ReactNode | React.ReactNode[]
  options?: ICanvasEditorProps['options']
}) {
  const { children, options, ...otherProps } = props
  const { canWheel = true } = options || {}

  const viewport = useStore(TemplateEditorStore, state => state.viewport)
  const dimension = useStore(TemplateEditorStore, state => state.dimension)

  // Stage component reference
  const stageRef = useStore(TemplateEditorStore, state => state.stageRef)

  const onWheelHandler = useCallback((_viewport: ViewPort) => {
    TemplateEditorStore.dispatch({
      type: 'SET_VIEW_PORT',
      payload: {
        viewport: _viewport,
      },
      skipTrace: true,
    })
  }, [])

  useEffect(() => {
    // Create a new stage reference ref
    const stageRef = createRef<Konva.Stage>()

    if (!stageRef) {
      TemplateEditorStore.dispatch({
        type: 'SET_STAGE_REF',
        payload: { stageRef },
        skipTrace: true,
      })
    }
  }, [])

  if (!stageRef) {
    return null
  }

  return (
    <Fragment>
      <ZoomComponentContainer
        viewport={viewport}
        dimension={dimension}
        onWheel={canWheel ? onWheelHandler : undefined}
        stageRef={stageRef}
      >
        <CanvasEditor {...otherProps} options={options} stageRef={stageRef}>
          {props.children}
        </CanvasEditor>
      </ZoomComponentContainer>
    </Fragment>
  )
}

export const LayerContainer = memo(function LayerContainer(props: {
  extractedLayerStore: TLayerStore
  previewMode?: boolean
}) {
  const { previewMode } = useEditorParams()

  return <LayerCanvas {...props} previewMode={props.previewMode || previewMode} />
})

function LayerCanvas(props: { extractedLayerStore: TLayerStore; previewMode?: boolean }) {
  const { extractedLayerStore, ...otherProps } = props

  return (
    <RenderElementCanvas
      {...otherProps}
      layerStore={extractedLayerStore}
      type={extractedLayerStore.getState().type}
      key={extractedLayerStore.getState()._id}
    />
  )
}
