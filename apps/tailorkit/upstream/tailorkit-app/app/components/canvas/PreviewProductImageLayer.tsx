import type Konva from 'konva'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Image as KonvaImage } from 'react-konva'
import TransformerTool from './Transformer'
import { useImageLoading } from './elements/Image/hooks/useImageLoading'
import { useStore } from '~/libs/external-store'
import { TemplateEditorStore } from '~/stores/modules/template'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import { GRID_BACKGROUND_NAME, GUIDE_LINE_NAME, RULER_LINE_HORIZONTAL_PREFIX, RULER_LINE_NAME } from './constants'
import {
  clearGuides,
  drawGuides,
  forceUpdatePosition,
  getGuides,
  getLineGuideStops,
  getObjectSnappingEdges,
} from '~/utils/canvas/snappingObject'
import { LAYER_NAME, LAYER_STROKE_DASH_COLOR, LAYER_STROKE_WIDTH, PREVIEW_IMAGE_NODE_NAME } from '~/constants/canvas'
import { LayerStoreSelection } from '~/stores/modules/layer-store-selection'
import { TEMPLATE_EDITOR_TRANSMISSION_EVENTS } from '~/modules/TemplateEditor/constants'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import isObject from 'lodash/isObject'

type PreviewImageData = NonNullable<ReturnType<typeof TemplateEditorStore.getState>['previewProductImage']>

interface PreviewProductImageLayerProps {
  canvasWidth: number
  canvasHeight: number
  image: PreviewImageData
  interactive: boolean
}

export default function PreviewProductImageLayer(props: PreviewProductImageLayerProps) {
  const { image, interactive } = props

  const trRef = useRef<Konva.Transformer>(null)
  const nodeRef = useRef<Konva.Image>(null)

  useStore(TemplateEditorStore, state => state.viewport)

  const [selected, setSelected] = useState(false)

  const { img } = useImageLoading({
    src: image?.src,
    width: image?.width,
    height: image?.height,
    visible: true,
  })

  // Bind transformer to our preview node when selected
  useEffect(() => {
    const tr = trRef.current
    const node = nodeRef.current
    if (!tr || !node) return

    if (selected && interactive) {
      tr.nodes([node])
      tr.getLayer()?.batchDraw()
    } else {
      tr.nodes([])
      tr.getLayer()?.batchDraw()
    }
  }, [selected, interactive])

  // Deselect when clicking on empty stage or other nodes
  useEffect(() => {
    const node = nodeRef.current
    const stage = node?.getStage()
    if (!stage || !interactive) return

    const handler = (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!selected) return
      const target = e.target

      // If click on stage or outside our preview node and not on transformer, deselect
      if (
        target === stage
        || (!target.hasName(PREVIEW_IMAGE_NODE_NAME)
          && !target.findAncestor(`.${PREVIEW_IMAGE_NODE_NAME}`)
          && !target.findAncestor('Transformer'))
      ) {
        setSelected(false)
      }
    }

    stage.on('mousedown.preview', handler)
    stage.on('touchstart.preview', handler as any)

    return () => {
      stage.off('mousedown.preview', handler)
      stage.off('touchstart.preview', handler as any)
    }
  }, [interactive, selected])

  const onSelect = useCallback(
    (e: any) => {
      e.cancelBubble = true
      if (!interactive) return
      setSelected(true)
      // Clear existing layer selection to avoid double transformers
      LayerStoreSelection.dispatch({ type: 'RESET_STATE' })
      // Ask main transformer to update (will clear nodes when no selection)
      Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.UPDATE_TRANSFORMER)
    },
    [interactive]
  )

  /**
   * Update TemplateEditorStore and sync to PrintArea in IntegrationStore
   * This ensures previewProductImage changes (drag/resize) are persisted per print area
   */
  const updateStore = useCallback((patch: Partial<PreviewImageData>) => {
    // Get current state to compute merged state
    const currentState = TemplateEditorStore.getState()
    const currentPreview = currentState.previewProductImage

    // Compute merged previewProductImage
    const mergedPreview: PreviewImageData
      = currentPreview && isObject(currentPreview) && isObject(patch)
        ? { ...currentPreview, ...patch }
        : (patch as PreviewImageData)

    // Update TemplateEditorStore
    TemplateEditorStore.dispatch({
      type: 'SET_PREVIEW_PRODUCT_IMAGE',
      payload: { previewProductImage: patch, merge: true },
    })

    // Sync to PrintArea in IntegrationStore if we're in unified editor context
    // Get mockupId and printAreaId from URL params (unified editor uses URL params)
    if (typeof window !== 'undefined') {
      try {
        const searchParams = new URLSearchParams(window.location.search)
        const mockupId = searchParams.get('mockup')
        const printAreaId = searchParams.get('printAreaId')

        if (mockupId && printAreaId) {
          // Check if previewProductImage is valid (has src which is required)
          const shouldSync = mergedPreview && isObject(mergedPreview) && mergedPreview.src

          if (shouldSync) {
            IntegrationStore.dispatch({
              type: 'UPDATE_PRINT_AREA_PREVIEW_PRODUCT_IMAGE',
              payload: {
                mockupId,
                printAreaId,
                previewProductImage: mergedPreview,
              },
              skipTrace: true,
            })
          }
        }
      } catch (error) {
        // Silently fail - this is a best-effort sync, main functionality doesn't depend on it
        // syncTemplateEditorToIntegration will handle sync during save/step changes
      }
    }
  }, [])

  const onDragEnd = useCallback(
    (e: any) => {
      e.cancelBubble = true
      if (!interactive) return
      updateStore({ left: e.target.x(), top: e.target.y() })
      const layer = e.target.getLayer()
      if (layer) clearGuides(layer, GUIDE_LINE_NAME)
    },
    [interactive, updateStore]
  )

  const onTransformEnd = useCallback(
    (e: any) => {
      e.cancelBubble = true
      if (!interactive) return
      const node = nodeRef.current
      if (!node) return

      const scaleX = node.scaleX()
      const scaleY = node.scaleY()
      node.scaleX(1)
      node.scaleY(1)

      const newWidth = Math.max(5, node.width() * scaleX)
      const newHeight = Math.max(5, node.height() * scaleY)
      const newLeft = node.x()
      const newTop = node.y()
      const rotation = node.rotation()

      updateStore({ width: newWidth, height: newHeight, left: newLeft, top: newTop, rotation })

      const layer = node.getLayer()
      if (layer) clearGuides(layer, GUIDE_LINE_NAME)
    },
    [interactive, updateStore]
  )

  // Snapping during dragging transformer
  const onTrDragMove = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    const target = e.target as unknown as Konva.Transformer
    const layer = target.getLayer()
    const stage = target.getStage()
    if (!layer || !stage) return

    // Clear previous guides
    clearGuides(layer, GUIDE_LINE_NAME)

    // Skip when holding shift (free move)
    if ((e.evt as any).shiftKey) return

    const transformer = e.target as unknown as Konva.Transformer
    const lineGuideStops = getLineGuideStops({
      nodes: transformer.nodes(),
      layerName: LAYER_NAME,
      gridBackgroundName: GRID_BACKGROUND_NAME,
      ruler: { rulerName: RULER_LINE_NAME, horizontalPrefix: RULER_LINE_HORIZONTAL_PREFIX },
    })

    const objectSnappingEdges = getObjectSnappingEdges(transformer)
    const guides = getGuides(lineGuideStops, objectSnappingEdges)

    if (!guides.length) return

    drawGuides(guides, layer, GUIDE_LINE_NAME, {
      stroke: LAYER_STROKE_DASH_COLOR,
      strokeWidth: LAYER_STROKE_WIDTH / 2 / (stage.scaleX() || 1),
    })

    forceUpdatePosition(transformer, guides)
  }, [])

  // Derived props for node
  const nodeProps = useMemo(() => {
    return {
      id: 'preview-product-image',
      name: PREVIEW_IMAGE_NODE_NAME,
      x: image.left,
      y: image.top,
      width: image.width,
      height: image.height,
      rotation: image.rotation || 0,
      // Only allow dragging after explicit selection (double click/tap)
      draggable: interactive && selected,
    }
  }, [image, interactive, selected])

  return (
    <>
      {/* Render the image if loaded */}
      {img && (
        <KonvaImage
          ref={nodeRef}
          image={img}
          {...nodeProps}
          onDblClick={onSelect}
          onDblTap={onSelect}
          onDragEnd={onDragEnd}
          onTransformEnd={onTransformEnd}
          listening={interactive}
        />
      )}

      {/* Dedicated transformer for preview image */}
      <TransformerTool trRef={trRef} interactive={interactive && selected} rotateEnabled onDragMove={onTrDragMove} />
    </>
  )
}
