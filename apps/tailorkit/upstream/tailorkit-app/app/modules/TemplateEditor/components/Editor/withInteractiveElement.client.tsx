import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import type Konva from 'konva'
import { type KonvaEventObject } from 'konva/lib/Node'
import type { ComponentType } from 'react'
import React, { useCallback, useMemo, useRef, useState } from 'react'
import { INNER_EDIT_NODE_NAME, LAYER_NAME, LAYER_STROKE_COLOR, LAYER_STROKE_WIDTH } from '~/constants/canvas'
import { useStore } from '~/libs/external-store'
import type { LayerDocument } from '~/models/Layer.server'
import { MUTATION_LAYER_FROM_INSPECTOR_EVENTS } from '~/modules/TemplateEditor/constants'
import { useTools } from '~/modules/TemplateEditor/hooks/useTools'
import {
  computeClipGroupPatch,
  encodeIndividualModePosition,
  encodeIndividualModeTransforms,
} from '~/modules/TemplateEditor/utils/individual-mode-encoding'
import type { TLayerStore } from '~/stores/modules/layer'
import { LayerStoreSelection } from '~/stores/modules/layer-store-selection'
import { TemplateEditorStore } from '~/stores/modules/template'
import {
  ELayerType,
  EOptionSet,
  type IMAGE_OPTION_SET,
  type ImageOptionSet,
  type NodeImage,
  type OptionSet,
} from '~/types/psd'
import { normalizeAngleToPositiveValue } from '~/utils/angle-fns'
import { normalizeLayerMetric } from '~/utils/canvas/normalizeLayerMetric'
import { clearGuides } from '~/utils/canvas/snappingObject'
import { GUIDE_LINE_NAME } from '../../../../components/canvas/constants'
import { useRAFDebounce } from '../../hooks/useRAFDebounce'
import useDevices from '~/utils/hooks/useDevice'
import isObject from 'lodash/isObject'

export interface WithInteractiveElementProps {
  id: string
  previewMode?: boolean
  visible?: boolean
  layerStore: TLayerStore
}

export interface InteractiveElementProps {
  id?: string
  name?: string
  spriteRef: React.RefObject<Konva.Node | null>
  visible?: boolean
  stroke?: string
  strokeWidth?: number
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  onDragEnd?: (e: KonvaEventObject<DragEvent>) => void
  onTransformEnd?: (e: KonvaEventObject<Event>) => void
  onDragMove?: (e: KonvaEventObject<DragEvent>) => void
  onTransform?: (e: KonvaEventObject<Event>) => void
}

/**
 * Higher-Order Component that adds interactive canvas behavior to layer components.
 *
 * This HOC wraps canvas layer components (Image, Text, Shape, etc.) to provide:
 * - Drag and drop functionality with position encoding
 * - Transform (resize/rotate) handling with percentage-based encoding
 * - Hover state management for visual feedback
 * - Integration with individual editing mode for image option sets
 * - ClipGroup (crop area) scaling when layers are resized
 *
 * **Interaction Modes:**
 * - **Normal mode**: All transforms apply directly to the layer
 * - **Individual mode**: Transforms are encoded as percentages relative to the selected option's base state
 *
 * **ClipGroup Handling:**
 * When a layer has a clipGroup (cropped image), the HOC:
 * - Uses the parent Group node for transform calculations instead of the inner Image
 * - Automatically scales the clipGroup proportionally when the layer is resized
 *
 * @typeParam P - Props type extending WithInteractiveElementProps
 * @param Component - The canvas component to wrap (e.g., KonvaImage, KonvaText)
 * @param realTimeUpdate - If true, updates occur during drag/transform (onDragMove/onTransform).
 *                         If false, updates occur only on completion (onDragEnd/onTransformEnd).
 * @returns Wrapped component with interactive behavior
 *
 * @example
 * // Create an interactive image component
 * const InteractiveImage = withInteractiveElement(KonvaImage)
 *
 * // Use in a canvas with real-time updates
 * const InteractiveText = withInteractiveElement(KonvaText, true)
 */
export default function withInteractiveElement<P extends WithInteractiveElementProps>(
  Component: ComponentType<P>,
  realTimeUpdate?: boolean
) {
  return function WithInteractiveElement(props: P) {
    const { id, previewMode, visible, layerStore } = props

    const { isGrabbing } = useTools()
    const { isMobile } = useDevices()
    const [isHovered, setIsHovered] = useState(false) // State to track hover status
    const spriteRef = useRef<Konva.Node>(null)

    const scale = useStore(TemplateEditorStore, state => state.viewport.scale)
    const clickedLayerStore = useStore(LayerStoreSelection, state => state.clickedLayerStore)

    // Layer's properties
    const locked = useStore(layerStore, state => state.locked)

    /**
     * Determines if transforms should be locked due to individual editing mode.
     *
     * In individual editing mode, transforms are encoded relative to the selected option.
     * If no option is selected, the layer cannot be transformed because there's no
     * target option to encode the transforms to.
     *
     * @returns `true` if layer is in individual mode without a selected option
     */
    const isTransformLocked = useStore(layerStore, state => {
      const optionSets = state.optionSet as OptionSet[] | undefined
      const imageOptionSet = optionSets?.find(os => os.type === EOptionSet.IMAGE_OPTION) as IMAGE_OPTION_SET | undefined
      if (!imageOptionSet) return false

      const editingMode = imageOptionSet.editingMode || 'sync'
      if (editingMode !== 'individual') return false

      const files: ImageOptionSet[] = imageOptionSet.data?.files || []
      const hasSelectedOption = files.some(f => f.selecting)

      return !hasSelectedOption
    })

    /** Type for layer update patches - allows runtime-compatible partial updates */
    type LayerPatch = Partial<Omit<LayerDocument, 'optionSet' | 'image'>> & {
      optionSet?: OptionSet[]
      image?: Partial<NodeImage>
    }

    /**
     * Dispatch layer state updates to the store and notify external listeners.
     *
     * This callback:
     * 1. Skips updates if the layer is locked
     * 2. Merges image patches with existing image data (preserves unmodified image properties)
     * 3. Dispatches the UPDATE_LAYER action to the layer store
     * 4. Triggers the TEMPLATE_ELEMENT_DATA_CHANGED event for external listeners
     *
     * **Image merging behavior:**
     * If both `data.image` and `currentState.image` exist, they are merged:
     * - Existing image properties are preserved
     * - New properties from `data.image` override existing ones
     *
     * @param data - Partial layer state update (position, dimensions, optionSet, image, etc.)
     *
     * @example
     * // Update position only
     * onChange({ left: 100, top: 50 })
     *
     * // Update with clipGroup and option set encoding
     * onChange({
     *   width: 200,
     *   height: 150,
     *   image: { clipGroup: newClipGroup },
     *   optionSet: encodedOptionSet
     * })
     */
    const onChange = useCallback(
      (data: LayerPatch) => {
        if (locked) return

        const currentState = layerStore.getState()

        // Merge image patch with existing image if both exist
        let mergedData: Record<string, unknown> = { ...data }
        if (data.image && currentState.image && typeof currentState.image === 'object') {
          mergedData = {
            ...data,
            image: { ...currentState.image, ...data.image },
          }
        }

        const _state = {
          ...currentState,
          ...mergedData,
        }

        layerStore.dispatch({
          type: 'UPDATE_LAYER',
          payload: {
            state: _state,
          },
        })

        Transmitter.trigger(MUTATION_LAYER_FROM_INSPECTOR_EVENTS.TEMPLATE_ELEMENT_DATA_CHANGED, {
          id,
          elementData: _state,
        })
      },
      [id, layerStore, locked]
    )

    /**
     * Handle drag completion events from Konva.
     *
     * This handler:
     * 1. Ignores events from inner edit nodes (e.g., text cursor positioning)
     * 2. Normalizes the new position to the layer metric format
     * 3. In individual mode: encodes position as percentages relative to the selected option's base
     * 4. Dispatches the position update via onChange
     * 5. Clears any guide lines used during drag
     *
     * **Individual mode encoding:**
     * When in individual editing mode with a selected option, the position is encoded as:
     * - `leftPct = (newLeft - base.left) / base.width`
     * - `topPct = (newTop - base.top) / base.height`
     *
     * This allows each option to have its own relative offset from the original position.
     *
     * @param e - Konva drag event containing the new position
     */
    const onDragEndHandler = useCallback(
      (e: KonvaEventObject<DragEvent>) => {
        const target = e.target as Konva.Node
        if (target && typeof target.hasName === 'function' && target.hasName(INNER_EDIT_NODE_NAME)) {
          return
        }

        const newLeft = normalizeLayerMetric(e.target.x())
        const newTop = normalizeLayerMetric(e.target.y())

        // In individual mode: synchronously update the selected option's position
        let optionSetPatch: OptionSet[] | undefined
        try {
          const state = layerStore.getState()

          const result = encodeIndividualModePosition({
            newLeft,
            newTop,
            state,
          })

          if (result.shouldPatch) {
            optionSetPatch = result.optionSetPatch
          }
        } catch {}

        onChange({
          left: newLeft,
          top: newTop,
          ...(optionSetPatch ? { optionSet: optionSetPatch } : {}),
        })

        const layer = e.target.getLayer()

        if (!layer) {
          console.log('No layer found')
          return
        }

        // clear all previous lines on the screen
        clearGuides(layer, GUIDE_LINE_NAME)
      },
      [onChange, layerStore]
    )

    const onDragMoveHandler = useRAFDebounce((e: KonvaEventObject<DragEvent>) => {
      onDragEndHandler(e)
    })

    /**
     * Get the correct Konva node to use for transform calculations.
     *
     * For layers with clipGroup (cropped images), the structure is:
     * ```
     * Group (outer container - holds position/rotation)
     *   └── Image (inner content - clipped)
     * ```
     *
     * In this case, we need to read/write transforms from the Group, not the Image,
     * because the Image is positioned relative to its parent Group for clipping.
     *
     * For normal layers without clipGroup, we use the node directly.
     *
     * @param node - The Konva node from spriteRef (may be inner Image or regular node)
     * @param hasClipGroup - Whether the layer has a clipGroup (crop area)
     * @returns The Group node for clipGroup layers, or the original node otherwise
     *
     * @example
     * const actualNode = getTransformNode(spriteRef.current, hasClipGroup)
     * const rotation = actualNode.rotation() // Reads from correct node
     */
    const getTransformNode = useCallback((node: Konva.Node, hasClipGroup: boolean): Konva.Node => {
      if (hasClipGroup && node.getClassName() === 'Image') {
        const parentGroup = node.getParent()
        if (parentGroup && parentGroup.getClassName() === 'Group') {
          return parentGroup
        }
      }
      return node
    }, [])

    /**
     * Handle transform completion events from Konva (resize, rotate).
     *
     * This handler processes the final state after a transform operation:
     *
     * **Transform processing:**
     * 1. Ignores events from inner edit nodes
     * 2. Gets the correct node (parent Group for clipGroup layers)
     * 3. Converts Konva's scale-based transform to width/height values
     * 4. Resets scale to 1 after extracting dimensions
     * 5. Normalizes all values to the layer metric format
     *
     * **ClipGroup scaling:**
     * If the layer has a clipGroup (crop area), it's scaled proportionally
     * to maintain the same relative crop when the layer is resized.
     *
     * **Individual mode encoding:**
     * When in individual editing mode, all transforms are encoded as percentages:
     * - `widthPct = newWidth / base.width`
     * - `heightPct = newHeight / base.height`
     * - `leftPct = (newLeft - base.left) / base.width`
     * - `topPct = (newTop - base.top) / base.height`
     * - `rotateDelta = newRotate - base.rotate`
     * - `clipGroupPct` = percentage-based crop area
     *
     * @param e - Konva transform event
     *
     * @example
     * // After user resizes a layer from 100x100 to 200x150
     * // In individual mode, the selected option receives:
     * // { widthPct: 2, heightPct: 1.5, leftPct: 0, topPct: 0, rotateDelta: 0 }
     */
    const onTransformEndHandler = useCallback(
      (e: KonvaEventObject<Event>) => {
        const target = e.target as Konva.Node
        if (target && typeof target.hasName === 'function' && target.hasName(INNER_EDIT_NODE_NAME)) {
          return
        }

        // transformer is changing scale of the node
        // and NOT its width or height
        // but in the store we have only width and height
        // to match the data better we will reset scale on transform end
        const node = spriteRef.current as Konva.Node

        if (!node) return

        // Get current layer state and detect clipGroup layers
        const currentState = layerStore.getState()
        const hasClipGroup = Boolean('image' in currentState && (currentState.image as NodeImage)?.clipGroup)

        // For clipGroup layers, use the parent Group's transform data instead of inner Image
        const actualNode = getTransformNode(node, hasClipGroup)

        const scaleX = actualNode.scaleX()
        const scaleY = actualNode.scaleY()

        // we will reset it back
        actualNode.scaleX(1)
        actualNode.scaleY(1)

        const newRotate = normalizeAngleToPositiveValue(actualNode.rotation())
        // Always use Konva's position - actualNode is already the correct node
        // (parent Group for clipGroup layers, regular node otherwise)
        const newLeft = normalizeLayerMetric(actualNode.x())
        const newTop = normalizeLayerMetric(actualNode.y())
        const newWidth = normalizeLayerMetric(Math.max(5, actualNode.width() * scaleX))
        const newHeight = normalizeLayerMetric(Math.max(actualNode.height() * scaleY))

        // Prepare optional clipGroup auto-fit for image layers when outer frame is resized
        let imagePatch: Partial<NodeImage> | undefined
        try {
          const state = layerStore.getState()
          const isImageLayer = state?.type === ELayerType.IMAGE

          if (
            isImageLayer
            && 'image' in state
            && state.image
            && isObject(state.image)
            && 'clipGroup' in state.image
            && state.image.clipGroup
          ) {
            imagePatch = computeClipGroupPatch({
              currentClipGroup: state.image.clipGroup,
              oldLayerWidth: currentState.width || 1,
              oldLayerHeight: currentState.height || 1,
              newWidth,
              newHeight,
            })
          }
        } catch {}

        // In individual mode: synchronously update all options' transforms and clipGroup
        let optionSetPatch: OptionSet[] | undefined
        try {
          const state = layerStore.getState()

          const result = encodeIndividualModeTransforms({
            newRotate,
            newLeft,
            newTop,
            newWidth,
            newHeight,
            imagePatch,
            state,
          })

          if (result.shouldPatch) {
            optionSetPatch = result.optionSetPatch
          }
        } catch {}

        onChange({
          rotate: newRotate,
          left: newLeft,
          top: newTop,
          width: newWidth,
          height: newHeight,
          ...(imagePatch ? { image: imagePatch } : {}),
          ...(optionSetPatch ? { optionSet: optionSetPatch } : {}),
        })
      },
      [onChange, layerStore, getTransformNode]
    )

    const onTransformHandler = useRAFDebounce((e: KonvaEventObject<Event>) => {
      onTransformEndHandler(e)
    })

    const onMouseEnterHandler = useCallback(() => {
      setIsHovered(true)
    }, [])

    const onMouseLeaveHandler = useCallback(() => {
      setIsHovered(false)
    }, [])

    const isDisabledInteraction = previewMode || locked || isGrabbing

    const isLayerChecked = useMemo(() => clickedLayerStore?.getState()?._id === id, [clickedLayerStore, id])

    /**
     * @important
     * The stroke only display when the layer is not disabled, hovered and not checked
     * The condition - "not checked" is important, if we set the stroke if the layer is checked,
     * The coordinate of the transformer will be wrong, it will have redundant gap and wrong position
     */
    const shouldDisplayStroke = !isDisabledInteraction && isHovered && !isLayerChecked

    /**
     * Elements should only be draggable when selected (isLayerChecked)
     * This prevents accidental drags during pinch-zoom gestures on mobile
     * User must tap to select first, then drag
     * Also disable dragging when in individual mode without selected option
     */
    const draggable = !isDisabledInteraction && !isTransformLocked && (isLayerChecked || !isMobile)

    /**
     * Memoized props passed to the wrapped component.
     *
     * **Interaction states:**
     * - `canInteract`: Layer is not locked, not in preview mode, and not in grab mode
     * - `canTransform`: canInteract AND not in individual mode without a selected option
     *
     * **Props behavior:**
     * - `id`, `name`: Only set when interaction is enabled (for Konva selection)
     * - `stroke`, `strokeWidth`: Hover highlight (only when hovered AND not selected)
     * - `draggable`: Enabled when canTransform AND (selected OR not mobile)
     * - Event handlers: Only attached when interaction/transform is allowed
     *
     * @see {@link isTransformLocked} for individual mode locking behavior
     */
    const componentProps: InteractiveElementProps = useMemo(() => {
      // When transform is locked, still allow selection but disable transform handlers
      const canInteract = !isDisabledInteraction
      const canTransform = canInteract && !isTransformLocked

      return {
        ...(canInteract ? { id, name: LAYER_NAME } : {}),
        spriteRef,
        draggable,
        // Use visible/invisible instead of not render this component
        // to create a empty zone that we can still evaluate the zone
        // selecting multiple layers or editing single layer
        visible: visible,
        ...(canInteract
          ? {
              // Set stroke color and width when hovered
              stroke: shouldDisplayStroke ? LAYER_STROKE_COLOR : undefined,
              strokeWidth: shouldDisplayStroke ? LAYER_STROKE_WIDTH / scale : 0,

              // Events handler
              onMouseEnter: onMouseEnterHandler,
              onMouseLeave: onMouseLeaveHandler,
              // Only attach transform handlers when not locked
              ...(canTransform
                ? realTimeUpdate
                  ? {
                      onDragMove: onDragMoveHandler,
                      onTransform: onTransformHandler,
                    }
                  : { onDragEnd: onDragEndHandler, onTransformEnd: onTransformEndHandler }
                : {}),
            }
          : {}),
      }
    }, [
      isDisabledInteraction,
      isTransformLocked,
      id,
      draggable,
      visible,
      shouldDisplayStroke,
      scale,
      onMouseEnterHandler,
      onMouseLeaveHandler,
      onDragEndHandler,
      onTransformEndHandler,
      onDragMoveHandler,
      onTransformHandler,
    ])

    return <Component {...(props as P)} {...componentProps} />
  }
}
