/* eslint-disable max-len */
import type Konva from 'konva'
import { useCallback, useMemo, useRef } from 'react'
import { Layer } from 'react-konva'
import { Fragment } from 'react/jsx-runtime'
import GridBackgroundTransparent from '~/components/canvas/GridTransparent'
import TransformerContainer from '~/components/canvas/TransformerContainer'
import KonvaImageComponent from '~/components/canvas/elements/Image/KonvaImage.client'
import {
  CANVAS_EDITOR_LAYER,
  LAYER_STROKE_WIDTH,
  PRODUCT_LAYER_STROKE_COLOR,
  TEMPLATE_EDITOR_CANVAS_CONTAINER,
} from '~/constants/canvas'
import { LAYER_BACKGROUND_IMAGE, LAYER_BASE_PRODUCT_IMAGE } from '~/constants/integration'
import { useStore } from '~/libs/external-store'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import type { ViewPort } from '~/types/template'
import useIntegrationViewport from '../../hooks/useViewport'
import type { WithVariantsProps } from '../../withMockup'
import withMockup from '../../withMockup'
import CanvasStage from './CanvasStage'
import LayersIntegration from './LayersIntegration'
import { CanvasRulerContainer } from './CanvasRulerContainer'
import { CanvasGridContainer } from './CanvasGridContainer'
import type { KeyboardAction } from '~/bootstrap/hoc/withKeyboardShortcut'
import withKeyboardShortcut from '~/bootstrap/hoc/withKeyboardShortcut'
import { useTools } from '~/modules/TemplateEditor/hooks/useTools'
import { ZoomComponentContainer } from '../../contexts/ZoomContext'
import { useIntegrationEditorContext } from '../../contexts'
import { useEditorParams } from '../../hooks'

interface IIntegrationCanvasProps extends WithVariantsProps {}

const DEFAULT_IMAGE = {
  url: '',
  width: 0,
  height: 0,
  altText: '',
}

const IntegrationCanvas = (props: IIntegrationCanvasProps) => {
  const { variants } = props

  // Stage component reference
  const { stageRef } = useIntegrationEditorContext()

  // Layer (canvas) component references
  const layerRef = useRef<Konva.Layer>(null)

  // Transformer component references
  const primaryTransformerRef = useRef<Konva.Transformer>(null)
  // Transformer component reference for mask
  const maskTrRef = useRef<Konva.Transformer | null>(null)

  const viewport = useStore(IntegrationStore, state => state.viewport)
  const { previewMode } = useEditorParams()

  const onWheelHandler = useCallback((_viewport: ViewPort) => {
    IntegrationStore.dispatch({
      type: 'UPDATE_VIEW_PORT',
      payload: {
        viewport: _viewport,
      },
      skipTrace: true,
    })
  }, [])

  const productFeaturedImage = variants[0].product?.featuredImage
  const mockup = variants[0].mockup
  const selectedViewId: string | undefined = mockup.selectedViewId || mockup.views?.[0]?._id
  const currentView = Array.isArray(mockup.views) ? mockup.views.find(v => v._id === selectedViewId) : undefined

  const viewBase = currentView?.baseImage
  const viewBackground = currentView?.backgroundImage

  const mockupProductVariantImage = variants.find(variant => !!variant.image)

  const productBaseImage = viewBase || mockupProductVariantImage?.image

  const { url, width, height, altText = '' } = productBaseImage || productFeaturedImage || DEFAULT_IMAGE

  const { url: backgroundImageUrl } = viewBackground || DEFAULT_IMAGE

  // const dimension = useMemo(() => {
  //   // Prefer intrinsic dimensions; fallback to current stage size to avoid 0-dimension
  //   const w = Number(width || 0)
  //   const h = Number(height || 0)
  //   if (w > 0 && h > 0) return { width: w, height: h }
  //   try {
  //     const currentW = Math.max(
  //       0,
  //       Number((stageRef?.current && (stageRef.current as any).width && (stageRef.current as any).width()) || 0)
  //     )
  //     const currentH = Math.max(
  //       0,
  //       Number((stageRef?.current && (stageRef.current as any).height && (stageRef.current as any).height()) || 0)
  //     )
  //     if (currentW > 0 && currentH > 0) return { width: currentW, height: currentH }
  //   } catch {}
  //   // Safe minimal fallback to keep viewport math valid
  //   return { width: 300, height: 300 }
  // }, [width, height, stageRef])

  const dimension = useMemo(
    () => ({
      width,
      height,
    }),
    [width, height]
  )

  useIntegrationViewport(TEMPLATE_EDITOR_CANVAS_CONTAINER, dimension)

  return (
    <ZoomComponentContainer stageRef={stageRef} viewport={viewport} dimension={dimension} onWheel={onWheelHandler}>
      <Fragment>
        {/* Canvas Stage contains grid background and layer (contains elements inside) */}
        <CanvasStage
          stageRef={stageRef}
          viewport={viewport}
          dimensions={dimension}
          layerRef={layerRef}
          trRef={primaryTransformerRef}
        >
          {/* Display grid transparent as background for template */}
          <GridBackgroundTransparent width={width} height={height} gridSize={10} />

          {/* Layer container contains all elements inside */}
          <Layer id={CANVAS_EDITOR_LAYER} ref={layerRef}>
            {backgroundImageUrl && (
              <KonvaImageComponent
                name={LAYER_BACKGROUND_IMAGE}
                x={0}
                y={0}
                width={width}
                height={height}
                src={backgroundImageUrl}
                alt={altText}
              />
            )}

            <KonvaImageComponent
              id={LAYER_BASE_PRODUCT_IMAGE}
              name={LAYER_BASE_PRODUCT_IMAGE}
              x={0}
              y={0}
              width={width}
              height={height}
              src={url}
              alt={altText}
              stroke={PRODUCT_LAYER_STROKE_COLOR}
              strokeWidth={LAYER_STROKE_WIDTH}
            />

            {/* Render layer integrations */}
            <LayersIntegration maskTrRef={maskTrRef} />

            {/* Render component transformer to interact with layer(s) */}
            <TransformerContainer
              primaryTransformerRef={primaryTransformerRef}
              maskTrRef={maskTrRef}
              interactive={!previewMode}
            />
          </Layer>

          {/* Render ruler container */}
          <CanvasRulerContainer stageRef={stageRef} />

          {/* Render grid container */}
          <CanvasGridContainer stageRef={stageRef} dimension={dimension} />
        </CanvasStage>
      </Fragment>
    </ZoomComponentContainer>
  )
}

const IntegrationCanvasWithKeyboardShortcut = withKeyboardShortcut(IntegrationCanvas)

export const IntegrationCanvasComponent = withMockup(function IntegrationCanvasComponent(props: WithVariantsProps) {
  const { onQuickToolsChangeHandler } = useTools()

  const onToggleRulerMode = useCallback(() => {
    // Filter out move tool
    onQuickToolsChangeHandler('ruler-tool')
  }, [onQuickToolsChangeHandler])

  const onToggleGridMode = useCallback(() => {
    // Filter out move tool
    onQuickToolsChangeHandler('grid-tool')
  }, [onQuickToolsChangeHandler])

  const keyboardActions: KeyboardAction[] = useMemo(
    (): KeyboardAction[] => [
      {
        keyCode: 'KeyR',
        shiftKey: true,
        onAction: onToggleRulerMode,
      },
      {
        keyCode: 'KeyG',
        shiftKey: true,
        onAction: onToggleGridMode,
      },
    ],
    [onToggleGridMode, onToggleRulerMode]
  )
  return <IntegrationCanvasWithKeyboardShortcut keyboardActions={keyboardActions} {...props} />
})
