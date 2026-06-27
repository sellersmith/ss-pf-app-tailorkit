import type Konva from 'konva'
import { useCallback, type RefObject } from 'react'
import { Fragment } from 'react/jsx-runtime'
import {
  LAYER_NAME,
  LAYER_STROKE_CAUTION_COLOR,
  LAYER_STROKE_DASH_COLOR,
  LAYER_STROKE_WIDTH,
  LAYER_STROKE_INNER_EDIT_COLOR,
  MASK_LAYER_STROKE_COLOR,
  INNER_EDIT_NODE_NAME,
} from '~/constants/canvas'
import {
  // applyResizeSnapping,
  clearGuides,
  drawGuides,
  forceUpdatePosition,
  getGuides,
  getLineGuideStops,
  getObjectSnappingEdges,
} from '~/utils/canvas/snappingObject'
import TransformerTool from './Transformer'
import {
  GRID_BACKGROUND_NAME,
  GUIDE_LINE_NAME,
  RULER_LINE_HORIZONTAL_PREFIX,
  RULER_LINE_NAME,
  TRANSFORMER_NAME,
} from './constants'

export interface ITransformerContainer {
  primaryTransformerRef: RefObject<Konva.Transformer | null>
  secondaryTransformerRef?: RefObject<Konva.Transformer>
  maskTrRef?: RefObject<Konva.Transformer>
  interactive?: boolean
  snappable?: boolean
  innerEditMode?: boolean
}

export default function TransformerContainer(props: ITransformerContainer) {
  const {
    primaryTransformerRef,
    secondaryTransformerRef,
    maskTrRef,
    interactive,
    snappable = true,
    innerEditMode = false,
  } = props

  const onDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const target = e.target as unknown as Konva.Transformer

      const nodes = target.nodes()
      if (nodes.length === 1 && typeof nodes[0].hasName === 'function' && nodes[0].hasName(INNER_EDIT_NODE_NAME)) {
        // Skip snapping for inner-edit image node
        return
      }
      const layer = target.getLayer()
      const stage = target.getStage()

      if (!layer || !stage) {
        console.log('No layer or stage found')
        return
      }

      if (!snappable) {
        // Clear all previous lines on the screen if existing and return
        clearGuides(layer, GUIDE_LINE_NAME)

        return
      }

      // Clear all previous lines on the screen
      clearGuides(layer, GUIDE_LINE_NAME)

      // Return if user is hold shift key
      if (e.evt.shiftKey) {
        return
      }

      // Get the transformer
      const transformer = e.target as unknown as Konva.Transformer

      // Get the scale of the stage
      const scale = stage.scaleX()

      // Find possible snapping lines
      const lineGuideStops = getLineGuideStops({
        nodes: transformer.nodes(),
        layerName: LAYER_NAME,
        gridBackgroundName: GRID_BACKGROUND_NAME,
        ruler: {
          rulerName: RULER_LINE_NAME,
          horizontalPrefix: RULER_LINE_HORIZONTAL_PREFIX,
        },
      })

      // Find snapping points of current object
      const objectSnappingEdges = getObjectSnappingEdges(transformer)

      // Now find where can we snap current object
      const guides = getGuides(lineGuideStops, objectSnappingEdges)

      // Do nothing if no snapping
      if (!guides.length) {
        return
      }

      // Draw guides on canvas
      drawGuides(guides, layer, GUIDE_LINE_NAME, {
        stroke: LAYER_STROKE_DASH_COLOR,
        strokeWidth: LAYER_STROKE_WIDTH / 2 / scale,
      })

      // Force update position
      forceUpdatePosition(transformer, guides)
    },
    [snappable]
  )

  // // Add this callback for handling resize
  // const onTransform = useCallback(
  //   (evt: Konva.KonvaEventObject<Event>) => {
  //     const trRef = primaryTransformerRef
  //     if (!trRef.current) return

  //     const layer = trRef.current.getLayer()
  //     const stage = trRef.current.getStage()

  //     const isShiftKey = (evt.evt as any).shiftKey

  //     if (isShiftKey) {
  //       trRef.current.rotationSnaps(ROTATION_SNAPS)
  //     } else {
  //       trRef.current.rotationSnaps([])
  //     }

  //     // Skip snapping if shift key is pressed or if there's no active anchor (not a resize event)
  //     if (isShiftKey || !trRef.current.getActiveAnchor()) {
  //       return
  //     }

  //     // This is a resize event, implement snapping
  //     if (!layer || !stage) {
  //       console.log('No layer or stage found')
  //       return
  //     }

  //     // Clear all previous guides
  //     clearGuides(layer, GUIDE_LINE_NAME)

  //     // Get the scale of the stage
  //     const scale = stage.scaleX()

  //     // Find possible snapping lines
  //     const lineGuideStops = getLineGuideStops({
  //       nodes: trRef.current.nodes(),
  //       layerName: LAYER_NAME,
  //       gridBackgroundName: GRID_BACKGROUND_NAME,
  //       ruler: {
  //         rulerName: RULER_LINE_NAME,
  //         horizontalPrefix: RULER_LINE_HORIZONTAL_PREFIX,
  //       },
  //     })

  //     // Get resize-specific snapping edges based on active anchor
  //     const resizeSnappingEdges = getResizeSnappingEdges(trRef.current)

  //     // Find snapping guides
  //     const guides = getGuides(lineGuideStops, resizeSnappingEdges)

  //     // Do nothing if no snapping
  //     if (!guides.length) {
  //       return
  //     }

  //     // Draw guides on canvas
  //     drawGuides(guides, layer, GUIDE_LINE_NAME, {
  //       stroke: LAYER_STROKE_DASH_COLOR,
  //       strokeWidth: LAYER_STROKE_WIDTH / 2 / scale,
  //     })

  //     // Apply the snapping to the resize operation
  //     applyResizeSnapping(trRef.current, guides)
  //   },
  //   [primaryTransformerRef]
  // )

  // // Handle resize behavior with snapping
  // const onTransformStart = useCallback(
  //   (evt: Konva.KonvaEventObject<Event>) => {
  //     const trRef = primaryTransformerRef
  //     if (!trRef.current) return

  //     // Store original properties for potential use during transform
  //     const nodes = trRef.current.getNodes()

  //     // Store original properties on the node for use in onTransform
  //     nodes.forEach(node => {
  //       node.setAttr('_originalWidth', node.width())
  //       node.setAttr('_originalHeight', node.height())
  //       node.setAttr('_originalX', node.x())
  //       node.setAttr('_originalY', node.y())
  //     })
  //   },
  //   [primaryTransformerRef]
  // )

  // const onTransformEnd = useCallback(
  //   (evt: Konva.KonvaEventObject<Event>) => {
  //     const trRef = primaryTransformerRef
  //     if (!trRef.current) return

  //     const layer = trRef.current.getLayer()

  //     // Clear guides when transform ends
  //     if (layer) {
  //       clearGuides(layer, GUIDE_LINE_NAME)
  //     }

  //     // Clear stored original properties
  //     const nodes = trRef.current.getNodes()
  //     nodes.forEach(node => {
  //       node.setAttr('_originalWidth', undefined)
  //       node.setAttr('_originalHeight', undefined)
  //       node.setAttr('_originalX', undefined)
  //       node.setAttr('_originalY', undefined)
  //     })
  //   },
  //   [primaryTransformerRef]
  // )

  return (
    <Fragment>
      <Fragment>
        <TransformerTool
          id={TRANSFORMER_NAME}
          trRef={primaryTransformerRef}
          interactive={interactive}
          rotateEnabled
          onDragMove={onDragMove}
          {...(innerEditMode
            ? {
                anchorFill: LAYER_STROKE_INNER_EDIT_COLOR,
                anchorStroke: LAYER_STROKE_INNER_EDIT_COLOR,
                borderStroke: LAYER_STROKE_INNER_EDIT_COLOR,
              }
            : {})}
          // onTransformStart={onTransformStart}
          // onTransform={onTransform}
          // onTransformEnd={onTransformEnd}
        />
        {secondaryTransformerRef && (
          <TransformerTool
            trRef={secondaryTransformerRef}
            anchorFill={LAYER_STROKE_CAUTION_COLOR}
            borderStroke={LAYER_STROKE_CAUTION_COLOR}
            borderStrokeWidth={LAYER_STROKE_WIDTH}
            interactive={interactive}
          />
        )}

        {maskTrRef && (
          <TransformerTool
            trRef={maskTrRef}
            anchorFill={MASK_LAYER_STROKE_COLOR}
            borderStroke={MASK_LAYER_STROKE_COLOR}
            borderStrokeWidth={LAYER_STROKE_WIDTH}
            interactive={interactive}
          />
        )}
      </Fragment>
    </Fragment>
  )
}
