import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { RefObject } from 'react'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Group, Rect } from 'react-konva'
import KonvaImageComponent from '~/components/canvas/elements/Image/KonvaImage.client'
import { TemplatePlaceholder } from './TemplatePlaceholder'
import {
  GROUP_LAYER_NAME,
  LAYER_MASK_NAME,
  LAYER_NAME,
  LAYER_STROKE_COLOR,
  LAYER_STROKE_WIDTH,
} from '~/constants/canvas'
import { FULFILLMENT_PROVIDERS } from '~/constants/fulfillment-providers'
import { useStore } from '~/libs/external-store'
import { LayerIntegrationStoreSelection } from '~/stores/modules/integration/layer-integration-selection'
import type { TLayerIntegrationStore } from '~/stores/modules/integration/layerIntegration'
import {
  getEnableClippingMaskForView,
  getViewLayerIntegrationStoreByIds,
} from '~/stores/modules/integration/viewLayerIntegration'
import { getLayerIntegrationStoreById } from '~/stores/modules/integration/layerIntegration'
import type { Store } from '~/libs/external-store'
import { normalizeAngleToPositiveValue } from '~/utils/angle-fns'
import { normalizeLayerMetric } from '~/utils/canvas/normalizeLayerMetric'
import type { WithVariantsProps } from '../../withMockup'
import withMockup from '../../withMockup'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import type { LayerIntegration } from '~/types/integration'
import { useTools } from '~/modules/TemplateEditor/hooks/useTools'
import { GUIDE_LINE_NAME } from '~/components/canvas/constants'
import { clearGuides } from '~/utils/canvas/snappingObject'
import { KonvaShimmerLoading } from '~/components/canvas/elements/LoadingAnimation/KonvaShimmerLoading.client'
import { useEditorParams } from '../../hooks'
import useDevices from '~/utils/hooks/useDevice'

interface ISpriteLayerIntegrationProps extends WithVariantsProps {
  src: string
  layerStore: TLayerIntegrationStore
  crop?: boolean
  maskTrRef: RefObject<Konva.Transformer>
  /** Override layer opacity (used to make sprite invisible when live overlay is shown on top) */
  opacity?: number
}

function SpriteLayerIntegration(props: ISpriteLayerIntegrationProps) {
  const { layerStore, src, maskTrRef, variants, opacity: opacityOverride } = props

  const mockup = variants[0].mockup as any

  const spriteRef = useRef<Konva.Image>(null)

  const { previewMode } = useEditorParams()
  const _id = useStore(layerStore, state => state._id)

  const { isMobile } = useDevices()

  // Read effective values from per-view store when a view is selected (reactive via store)
  const currentViewId = useStore(IntegrationStore, s => {
    const v = s.variants.find(v => v.mockup._id === mockup._id)
    return (v?.mockup?.selectedViewId as string | undefined) || (v?.mockup?.views?.[0]?._id as string | undefined) || ''
  })

  const enableClippingMask = currentViewId ? getEnableClippingMaskForView(mockup._id, currentViewId) : false

  const viewLayerStore = useMemo<Store<LayerIntegration, any>>(
    () =>
      currentViewId ? (getViewLayerIntegrationStoreByIds(mockup._id, currentViewId, _id) as any) : (layerStore as any),
    [mockup._id, currentViewId, _id, layerStore]
  )

  const widthBase = useStore(viewLayerStore, state => state.width)
  const heightBase = useStore(viewLayerStore, state => state.height)
  const xBase = useStore(viewLayerStore, state => state.x)
  const yBase = useStore(viewLayerStore, state => state.y)
  const rotationBase = useStore(viewLayerStore, state => state.rotation)
  const type = useStore(layerStore, state => state.type)
  const mask = useStore(viewLayerStore, state => state.mask)
  const visibleEff = useStore(viewLayerStore, state => state.visible)

  // Effective values already include per-view overrides via view layer store
  // Local, ephemeral transform patch during interaction to avoid heavy store writes
  const [dragPatch, setDragPatch] = useState<
    Partial<Pick<LayerIntegration, 'x' | 'y' | 'width' | 'height' | 'rotation'>>
  >({})

  const widthEff = dragPatch.width ?? widthBase
  const heightEff = dragPatch.height ?? heightBase
  const xEff = dragPatch.x ?? xBase
  const yEff = dragPatch.y ?? yBase
  const rotationEff = dragPatch.rotation ?? rotationBase

  // Note: effective primitive values are directly used; no aggregated object to avoid rerender churn

  const [isHovered, setIsHovered] = useState(false) // State to track hover status

  // Determine if the image source has finished loading so we can show a shimmer while waiting.
  const [isImageLoaded, setIsImageLoaded] = useState<boolean>(() => {
    // If there is no src (template placeholder) we treat as loaded so no shimmer
    return !src
  })

  // Whenever src changes, listen for its load event once
  useEffect(() => {
    if (!src) {
      setIsImageLoaded(true)
      return
    }

    // Start loading
    setIsImageLoaded(false)

    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      setIsImageLoaded(true)
    }
    img.onerror = () => {
      // Even on error, stop the shimmer to avoid infinite loading
      setIsImageLoaded(true)
    }
    img.src = src

    return () => {
      // clean up listeners to avoid memory leak
      img.onload = null
      img.onerror = null
    }
  }, [src])

  const clickedLayerStore = useStore(LayerIntegrationStoreSelection, state => state.clickedLayerStore)
  const selectedTab = useStore(IntegrationStore, state => state.selectedTab)

  const { isGrabbing } = useTools()

  const rectRef = useRef<Konva.Rect | null>(null)

  const rect = mask || { x: xEff, y: yEff, width: widthEff, height: heightEff, rotation: rotationEff }

  const selecting = clickedLayerStore?.getState()._id === _id

  // Make sure the Transformer is applied to the Mask once it's rendered
  useEffect(() => {
    if (!enableClippingMask) {
      if (maskTrRef.current) {
        maskTrRef.current.nodes([])
      }

      return
    }

    if (rectRef.current && maskTrRef.current) {
      const currentNodes = maskTrRef.current.getNodes()

      // Filter nodes that not being selected
      const nodes = selecting
        ? [rectRef.current, ...currentNodes]
        : currentNodes.filter(node => node !== rectRef.current)

      maskTrRef.current.nodes(nodes)

      const getLayer = maskTrRef.current.getLayer()

      if (getLayer) {
        getLayer.batchDraw() // Force the layer to re-render
      }
    }
  }, [selecting, maskTrRef, enableClippingMask])

  const setRect = useCallback(
    (nextMask: LayerIntegration['mask']) => {
      if (!nextMask) return

      // If a view is active, save mask as per-view override. Otherwise, update base layer.
      if (currentViewId) {
        IntegrationStore.dispatch({
          type: 'UPDATE_VIEW_OVERRIDES',
          payload: { mockupId: mockup._id, viewId: currentViewId, layerId: _id, patch: { mask: nextMask } },
        })
        return
      }

      const baseStore = getLayerIntegrationStoreById(_id)
      baseStore.dispatch({
        type: 'UPDATE_MASK',
        payload: {
          mask: nextMask,
        },
      })
    },
    [_id, currentViewId, mockup._id]
  )

  // Avoid toggling tabs repeatedly during a single interaction
  const hasSwitchedTabRef = useRef<boolean>(false)

  const onMouseEnterHandler = useCallback(() => {
    setIsHovered(true)
  }, [])

  const onMouseLeaveHandler = useCallback(() => {
    setIsHovered(false)
  }, [])

  const onDragMoveHandler = useCallback(
    (e: KonvaEventObject<DragEvent>) => {
      // Update local patch only for smooth UX
      if (selectedTab === 0 && !hasSwitchedTabRef.current) {
        IntegrationStore.dispatch({
          type: 'UPDATE_SELECTED_TAB',
          payload: { selectedTab: 1 },
          skipTrace: true,
        })
        hasSwitchedTabRef.current = true
      }
      setDragPatch(prev => ({
        ...prev,
        x: normalizeLayerMetric(e.target.x()),
        y: normalizeLayerMetric(e.target.y()),
      }))
    },
    [selectedTab]
  )

  const onTransformHandler = useCallback(
    (e: KonvaEventObject<Event>) => {
      // Update local patch only for smooth UX
      if (selectedTab === 0 && !hasSwitchedTabRef.current) {
        IntegrationStore.dispatch({
          type: 'UPDATE_SELECTED_TAB',
          payload: { selectedTab: 1 },
          skipTrace: true,
        })
        hasSwitchedTabRef.current = true
      }
      const node = spriteRef.current || rectRef.current
      if (!node) return

      const scaleX = node.scaleX()
      const scaleY = node.scaleY()
      // reset visual scale so width/height are accurate for next frame
      node.scaleX(1)
      node.scaleY(1)

      setDragPatch(prev => ({
        ...prev,
        rotation: normalizeAngleToPositiveValue(node.rotation()),
        x: normalizeLayerMetric(node.x()),
        y: normalizeLayerMetric(node.y()),
        width: normalizeLayerMetric(Math.max(5, node.width() * scaleX)),
        height: normalizeLayerMetric(Math.max(node.height() * scaleY)),
      }))
    },
    [selectedTab]
  )

  const commitPatch = useCallback(() => {
    if (!currentViewId) return
    if (!dragPatch || Object.keys(dragPatch).length === 0) return

    IntegrationStore.dispatch({
      type: 'UPDATE_VIEW_OVERRIDES',
      payload: { mockupId: mockup._id, viewId: currentViewId, layerId: _id, patch: dragPatch },
    })
    setDragPatch({})
  }, [currentViewId, dragPatch, mockup._id, _id])

  const onDragEndHandler = useCallback(
    (e: KonvaEventObject<DragEvent>) => {
      commitPatch()
      const layer = e.target.getLayer()
      if (layer) {
        clearGuides(layer, GUIDE_LINE_NAME)
      }
      hasSwitchedTabRef.current = false
    },
    [commitPatch]
  )

  const onTransformEndHandler = useCallback(() => {
    commitPatch()
    hasSwitchedTabRef.current = false
  }, [commitPatch])

  const isDisabledInteraction = isGrabbing || previewMode
  const shouldDisplayStroke = isHovered

  /**
   * Elements should only be draggable when selected (selecting) on mobile
   * This prevents accidental drags during pinch-zoom gestures on mobile
   * User must tap to select first, then drag
   */
  const draggable = !isDisabledInteraction && (!isMobile || selecting)
  const layerOpacity
    = opacityOverride !== undefined
      ? opacityOverride
      : !enableClippingMask || type !== 'template'
        ? 1
        : selecting
          ? 0.3
          : 0

  // Determine if current product is from a fulfillment provider (e.g., Printify)
  const productVendor = useMemo(() => {
    const first = variants && variants.length > 0 ? (variants[0] as any) : undefined
    return (first?.vendor as string) || (first?.product?.vendor as string) || ''
  }, [variants])

  const isImportedProduct = useMemo(() => {
    return productVendor ? FULFILLMENT_PROVIDERS.includes(productVendor) : false
  }, [productVendor])

  // Only show blue fill for fulfillment-provider products; normal products get transparent (omit fill)
  const rectFill = isImportedProduct ? '#E0F0FF' : undefined

  // Define props for image component
  const commonProps = useMemo(
    () => ({
      id: _id,
      spriteRef,
      name: LAYER_NAME,
      listening: true,
      x: xEff,
      y: yEff,
      width: widthEff,
      height: heightEff,
      draggable: draggable,
      rotation: rotationEff,
      // Use visible/invisible instead of not render this component
      // to create a empty zone that we can still evaluate the zone
      // selecting multiple layers or editing single layer
      visible: visibleEff,
      opacity: layerOpacity,
      ...(isDisabledInteraction
        ? {}
        : {
            // Set stroke color and width when hovered
            stroke: shouldDisplayStroke ? LAYER_STROKE_COLOR : undefined,
            strokeWidth: shouldDisplayStroke ? LAYER_STROKE_WIDTH : 0,
            // Events handlers
            onMouseEnter: onMouseEnterHandler,
            onMouseLeave: onMouseLeaveHandler,
            onDragMove: onDragMoveHandler,
            onTransform: onTransformHandler,
            onTransformEnd: onTransformEndHandler,
            onDragEnd: onDragEndHandler,
            onMouseDown: undefined,
          }),
    }),
    [
      _id,
      draggable,
      widthEff,
      heightEff,
      rotationEff,
      xEff,
      yEff,
      isDisabledInteraction,
      layerOpacity,
      shouldDisplayStroke,
      visibleEff,
      onDragMoveHandler,
      onMouseEnterHandler,
      onMouseLeaveHandler,
      onTransformHandler,
      onTransformEndHandler,
      onDragEndHandler,
    ]
  )

  // Hide rendering when layer explicitly invisible in current view
  if (visibleEff === false) return null

  return (
    <Fragment>
      {src ? (
        <KonvaImageComponent src={src} {...commonProps} />
      ) : previewMode ? null : (
        <Group>
          <Rect fill={rectFill} stroke={'#E0F0FF'} strokeWidth={1} ref={rectRef} {...commonProps} />
          <TemplatePlaceholder
            x={xEff}
            y={yEff}
            width={widthEff}
            height={heightEff}
            rotation={rotationEff}
            visible={visibleEff}
            color={isImportedProduct ? '#616161' : '#005BD3'}
          />
        </Group>
      )}

      {/* Overlay a simple static placeholder while the image is loading */}
      {!isImageLoaded && (
        <KonvaShimmerLoading
          x={xEff}
          y={yEff}
          width={widthEff}
          height={heightEff}
          rotation={rotationEff}
          isVisible={true}
        />
      )}

      {enableClippingMask && type === 'template' && (
        <Fragment>
          {/* In order to has a mask, we need to group the rect as a top layer and image as a under layer.
          The matter that out of the bound of rect will be disappear as well */}
          <Group
            name={GROUP_LAYER_NAME}
            clipFunc={ctx => {
              const node = rectRef.current

              if (node) {
                ctx.save()
                ctx.translate(node.x(), node.y())
                ctx.rotate((node.rotation() * Math.PI) / 180)
                ctx.rect(0, 0, node.width() * node.scaleX(), node.height() * node.scaleY())
                ctx.restore()
              }
            }}
          >
            <KonvaImageComponent
              id={_id}
              name={LAYER_NAME}
              src={src}
              width={widthEff}
              height={heightEff}
              x={xEff}
              y={yEff}
              rotation={rotationEff}
              draggable={false}
              // Use visible/invisible instead of not render this component
              // to create a empty zone that we can still evaluate the zone
              // selecting multiple layers or editing single layer
              visible={visibleEff}
            />

            <Rect
              name={LAYER_MASK_NAME}
              id={`mask-${_id}`}
              ref={rectRef}
              {...rect}
              onTransformEnd={() => {
                const node = rectRef.current

                if (!node) return

                const scaleX = node.scaleX()
                const scaleY = node.scaleY()

                // we will reset it back
                node.scaleX(1)
                node.scaleY(1)

                setRect({
                  rotation: node.rotation(),
                  x: node.x(),
                  y: node.y(),
                  width: Math.max(5, node.width() * scaleX),
                  height: Math.max(5, node.height() * scaleY),
                })
              }}
              onDragEnd={e => {
                setRect({ ...rect, x: e.target.x(), y: e.target.y() })
              }}
              fill="rgba(0, 0, 0, 0)" // Invisible rectangle used as a mask
              draggable={draggable}
            />
          </Group>
        </Fragment>
      )}
    </Fragment>
  )
}

export default withMockup(SpriteLayerIntegration)
