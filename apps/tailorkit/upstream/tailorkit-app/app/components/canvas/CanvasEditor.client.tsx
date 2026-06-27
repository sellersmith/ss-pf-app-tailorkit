import type Konva from 'konva'
import React, { Fragment, useMemo, useRef } from 'react'
import { Layer, Rect } from 'react-konva'
import { Spinner } from '@shopify/polaris'
import {
  CANVAS_EDITOR_LAYER,
  CANVAS_BORDER_COLOR,
  CANVAS_BORDER_DASH,
  CANVAS_BORDER_STROKE_WIDTH,
} from '~/constants/canvas'
import { GRID_BACKGROUND_NAME } from './constants'
import SaveTemplateModal from '~/modules/TemplateEditor/modals/SaveTemplateModal'
import CanvasStage from './CanvasStage'
import GridBackgroundTransparent from './GridTransparent'
import { CanvasRulerContainer } from '../../modules/TemplateEditor/components/Editor/CanvasRulerContainer'
import TransformerContainer, { type ITransformerContainer } from './TransformerContainer'
import { CanvasGridContainer } from '~/modules/TemplateEditor/components/Editor/CanvasGridContainer'
import { useInnerEditDetection } from './hooks/useInnerEditDetection'
import { useStore } from '~/libs/external-store'
import { TemplateEditorStore } from '~/stores/modules/template'
import PreviewProductImageLayer from '~/components/canvas/PreviewProductImageLayer'
import { useLocation } from '@remix-run/react'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import PrintAreasBar from '~/modules/ProductEditor/components/Canvas/PrintAreasBar'
import { useEditorParams } from '~/modules/ProductEditor/hooks'
import { NavMenuItems } from '~/bootstrap/app-config'
import { useCanvasSwitching } from '~/stores/modules/canvas-switching'
import useDevices from '~/utils/hooks/useDevice'

export interface ICanvasEditorProps {
  stageRef: React.RefObject<Konva.Stage>
  children: React.ReactNode | React.ReactNode[]
  canvasWidth: number
  canvasHeight: number
  options?: {
    interactive?: boolean
    previewMode?: boolean
    isGrabbing?: boolean
    canWheel?: boolean
    showPlaceHolder?: boolean
    scaleUpStageViewPort?: boolean
    snappable?: boolean
  }
}
/**
 * This component represents as highest-level of rendering layer elements
 *
 * @component
 * @param props ICanvasEditorProps
 * @returns {React.ReactElement}
 */
function CanvasEditor(props: ICanvasEditorProps): React.ReactElement {
  const { children, canvasWidth: width, canvasHeight: height, options, stageRef } = props

  const {
    interactive = true,
    isGrabbing = false,
    showPlaceHolder = true,
    scaleUpStageViewPort = false,
    snappable = true,
    previewMode = false,
  } = options || {}

  // Transformer component references
  const primaryTransformerRef = useRef<Konva.Transformer>(null)
  const secondaryTransformerRef = useRef<Konva.Transformer>(null)

  // Layer (canvas) component references
  const layerRef = useRef<Konva.Layer>(null)

  const previewProductImage = useStore(TemplateEditorStore, state => state.previewProductImage)

  // Unified editor (integration) context detection and URL params
  const location = useLocation()
  const { mockupId } = useEditorParams()
  const isUnifiedEditor = useMemo(
    () => location.pathname.includes(NavMenuItems.PERSONALIZED_PRODUCTS),
    [location.pathname]
  )

  // Read current variant from IntegrationStore when in unified editor
  const variants = useStore(IntegrationStore, state => state.variants)
  const activeVariant = useMemo(() => {
    if (!isUnifiedEditor || !variants || variants.length === 0) {
      return undefined
    }
    return variants.find(v => v.mockup._id === mockupId) || variants[0]
  }, [isUnifiedEditor, variants, mockupId])

  const isPreviewImageVisible = !!(previewProductImage && previewProductImage.visible !== false)

  // Subscribe to canvas switching state for overlay
  const switchingToPrintAreaId = useCanvasSwitching()
  const showLoadingOverlay = isUnifiedEditor && switchingToPrintAreaId !== null

  const { isMobileView } = useDevices()

  return (
    <Fragment>
      {/* Wrapper for unified editor to properly display Area Bar */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          width: '100%',
        }}
      >
        {/* Canvas container - takes remaining height */}
        <div style={{ flex: '1 1 auto', minHeight: 0, position: 'relative' }}>
          {/* Loading overlay - covers entire canvas during print area switching */}
          {showLoadingOverlay && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 1000,
                backgroundColor: 'var(--p-color-bg-surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'all',
              }}
            >
              <Spinner size="large" />
            </div>
          )}
          {/* Canvas Stage contains grid background and layer (contains elements inside) */}
          <CanvasStage
            stageRef={stageRef}
            trRef={primaryTransformerRef}
            secondaryTrRef={secondaryTransformerRef}
            layerRef={layerRef}
            interactive={interactive}
            isGrabbing={isGrabbing}
            scaleUpStageViewPort={scaleUpStageViewPort}
            previewMode={previewMode}
          >
            {/* Display grid transparent as background for template */}
            {showPlaceHolder && !isPreviewImageVisible && (
              <GridBackgroundTransparent width={width} height={height} gridSize={10} />
            )}

            {/* Preview product image layer (below elements layer) */}
            {isPreviewImageVisible && (
              <Layer id="preview-product-image-layer">
                <PreviewProductImageLayer
                  canvasWidth={width}
                  canvasHeight={height}
                  image={previewProductImage}
                  interactive={interactive && !previewMode && !isGrabbing}
                />
              </Layer>
            )}

            {/* Layer container contains all elements inside */}
            <Layer id={CANVAS_EDITOR_LAYER} ref={layerRef}>
              {/* Render elements */}
              {children}

              {/* Render component transformer to interact with layer(s) */}
              <TransformerContainerWrapper
                primaryTransformerRef={primaryTransformerRef}
                // secondaryTransformerRef={secondaryTransformerRef}
                /** Disable secondary transformer for now */
                secondaryTransformerRef={undefined}
                interactive={interactive}
                snappable={snappable}
              />
            </Layer>

            {/* Canvas dashed border when preview image exists */}
            {isPreviewImageVisible && (
              <Layer listening={false}>
                <Rect
                  x={0}
                  y={0}
                  width={width}
                  height={height}
                  stroke={CANVAS_BORDER_COLOR}
                  strokeWidth={CANVAS_BORDER_STROKE_WIDTH}
                  dash={CANVAS_BORDER_DASH}
                  name={GRID_BACKGROUND_NAME}
                />
              </Layer>
            )}

            {/* Render grid container */}
            <CanvasGridContainer stageRef={stageRef} />

            {/* Render ruler container */}
            <CanvasRulerContainer stageRef={stageRef} />
          </CanvasStage>
        </div>

        {/* Under-canvas Print Areas Bar (Unified Editor only) */}
        {isUnifiedEditor && mockupId && !isMobileView && (
          <PrintAreasBar
            mockupId={mockupId}
            productTitle={activeVariant?.product?.title}
            variantTitle={activeVariant?.title}
          />
        )}
      </div>

      {/* Render save template modal component */}
      <SaveTemplateModal stageRef={stageRef} />
    </Fragment>
  )
}

export default CanvasEditor

const TransformerContainerWrapper = (props: ITransformerContainer) => {
  const { primaryTransformerRef } = props
  // Detect if any transformer is in inner edit mode
  const isInnerEditMode = useInnerEditDetection(primaryTransformerRef)

  // Transformer anchor configuration moved to CanvasStage's unified handler to avoid double triggers

  return <TransformerContainer {...props} innerEditMode={isInnerEditMode} />
}
