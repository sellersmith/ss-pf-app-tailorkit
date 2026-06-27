import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  decodeClipGroupFromPercentages,
  encodeClipGroupToPercentages,
} from '~/modules/TemplateEditor/elements/hooks/useSyncClipGroupOption'
import { evaluateImageOptionTransform } from '~/utils/image-option-transforms'
import useImageWithOverlay from '~/hooks/useImageWithOverlay'
import { EOptionSet, optionSetDataKeys, type ImageOptionSet } from '~/types/psd'
import { Group } from 'react-konva'
import { InnerEditModeIndicator } from '~/components/canvas/elements/Image/InnerEditModeIndicator'
import { INNER_EDIT_NODE_NAME, LAYER_NAME } from '~/constants/canvas'
import type { IMaskConfig } from '~/components/canvas/elements/Image/KonvaImageWithMask.client'
import KonvaImageWithMask from '~/components/canvas/elements/Image/KonvaImageWithMask.client'
import { KonvaRemoveBackgroundLoading } from '~/components/canvas/elements/LoadingAnimation/KonvaRemoveBackgroundLoading.client'
import { TOAST } from '~/constants/toasts'
import { useStore } from '~/libs/external-store'
import withInteractiveElement from '~/modules/TemplateEditor/components/Editor/withInteractiveElement.client'
import { ImageLoadingStore, PendingToastStore } from '~/stores/modules/image-loading-store'
import type { TLayerStore } from '~/stores/modules/layer'
import { showToast } from '~/utils/toastEvents'
import { useTranslation } from 'react-i18next'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { TEMPLATE_EDITOR_TRANSMISSION_EVENTS } from '~/modules/TemplateEditor/constants'
import { LayerStoreSelection } from '~/stores/modules/layer-store-selection'
import { ONE_SECOND_IN_MILLISECONDS } from '~/constants'
import { subInspectorStoreActions } from '~/stores/canvas/subInspector'
import isObject from 'lodash/isObject'
import isString from 'lodash/isString'

interface ImageCanvasProps {
  layerStore: TLayerStore
  image?: string
  mask?: IMaskConfig
}

const DEFAULT_LOADING_STATE = { isLoading: false, progress: 0 }

function ImageRendererComponent(props: ImageCanvasProps) {
  const { image, mask, layerStore, ...otherProps } = props
  const { t } = useTranslation()

  const baseWidth = useStore(layerStore, state => state.width || 0)
  const baseHeight = useStore(layerStore, state => state.height || 0)
  const baseX = useStore(layerStore, state => state.left || 0)
  const baseY = useStore(layerStore, state => state.top || 0)
  const baseClipGroup = useStore(layerStore, state => {
    const img = state.image
    if (img && isObject(img)) {
      return img.clipGroup || undefined
    }
    return undefined
  })

  const visible = useStore(layerStore, state => state.visible || true)
  const baseRotation = useStore(layerStore, state => state.rotate || 0)
  const layerId = useStore(layerStore, state => state._id)
  const clickedLayerStore = useStore(LayerStoreSelection, s => s.clickedLayerStore)
  const checkedLayerStores = useStore(LayerStoreSelection, s => s.checkedLayerStores)
  const editingMode = useStore(layerStore, s => {
    const imageOptionSet = s.optionSet?.find(os => os.type === EOptionSet.IMAGE_OPTION)
    return (imageOptionSet?.editingMode as 'sync' | 'individual') || 'sync'
  })
  const originalBaseState = useStore(layerStore, s => {
    const imageOptionSet = s.optionSet?.find(os => os.type === EOptionSet.IMAGE_OPTION)
    return imageOptionSet?.originalBaseState
  })

  const [isEditingInner, setIsEditingInner] = useState(false)
  const lastToggleRef = useRef(0)

  const isThisLayerSelected = useMemo(() => {
    const clickedId = clickedLayerStore?.getState()?._id
    if (clickedId === layerId) return true
    if (Array.isArray(checkedLayerStores) && checkedLayerStores.length) {
      return checkedLayerStores.some(s => s?.getState()?._id === layerId)
    }
    return false
  }, [checkedLayerStores, clickedLayerStore, layerId])

  useEffect(() => {
    if (!isThisLayerSelected && isEditingInner) {
      setIsEditingInner(false)
    }
  }, [isThisLayerSelected, isEditingInner])

  const selectedImageOption = useStore(layerStore, state => {
    const imageOptionSet = state.optionSet?.find(os => os.type === EOptionSet.IMAGE_OPTION)
    if (!imageOptionSet) return null

    const dataKey = optionSetDataKeys[EOptionSet.IMAGE_OPTION]
    const files: ImageOptionSet[] = (imageOptionSet.data as Record<string, any>)?.[dataKey] || []
    const selected = files.find(f => f.selecting) || null

    return selected
  })

  // Reset inner edit mode when selected image option changes
  const selectedOptionId = selectedImageOption?._id
  useEffect(() => {
    setIsEditingInner(false)
  }, [selectedOptionId])

  // Base image from the layer (string or object src/dataSrc)
  const baseSrc = useStore(layerStore, state => {
    const img = state.image
    if (isString(img)) return img
    if (img && isObject(img)) {
      return img.src || img.dataSrc
    }
    return undefined
  })

  // Get overlay data - prefer selected option's overlay, fall back to layer settings
  const overlayData = useStore(layerStore, state => {
    // First check if selected option has its own overlay
    const imageOptionSet = state.optionSet?.find(os => os.type === EOptionSet.IMAGE_OPTION)
    if (imageOptionSet) {
      const dataKey = optionSetDataKeys[EOptionSet.IMAGE_OPTION]
      const files = (imageOptionSet.data as Record<string, any>)?.[dataKey] || []
      const selectedFile = files.find((f: any) => f.selecting)
      if (selectedFile?.overlay) {
        return selectedFile.overlay
      }
    }

    // Fall back to layer settings overlay
    const settings = state.settings
    return settings?.overlay || null
  })

  // Derive final geometry and src in one place for clarity
  // Uses decode-on-read pattern: percentages are source of truth, decoded to absolute values here
  const geom = useMemo(() => {
    const noSelectedInIndividual = editingMode === 'individual' && !selectedImageOption
    const useBase = editingMode === 'sync' || noSelectedInIndividual

    if (useBase) {
      const optionSrc = selectedImageOption?.src ?? selectedImageOption?.dataSrc
      return {
        width: baseWidth,
        height: baseHeight,
        x: baseX,
        y: baseY,
        rotation: baseRotation,
        clipGroup: baseClipGroup,
        src: optionSrc ?? baseSrc ?? image,
      }
    }

    // Decode from percentages (individual mode with selection)
    // Use option's baseSnapshot first (percentages were encoded relative to it)
    // Fall back to originalBaseState, then current layer dimensions
    const optionBaseSnapshot = selectedImageOption?.baseSnapshot

    // Detect stale baseSnapshot - after reload, baseSnapshot may not match originalBaseState
    // This happens when layer dimensions changed between save and reload
    // If stale, skip baseSnapshot and use originalBaseState for correct decoding
    const isExistingSnapshot = optionBaseSnapshot && originalBaseState
    let isBaseSnapshotStale = false
    if (isExistingSnapshot) {
      const isWidthStale = optionBaseSnapshot.width !== originalBaseState.width
      const isHeightStale = optionBaseSnapshot.height !== originalBaseState.height
      isBaseSnapshotStale = isWidthStale || isHeightStale
    }

    // Use originalBaseState if baseSnapshot is stale
    const effectiveBaseSnapshot = isBaseSnapshotStale ? undefined : optionBaseSnapshot

    const baseTransform = {
      width: effectiveBaseSnapshot?.width ?? originalBaseState?.width ?? baseWidth,
      height: effectiveBaseSnapshot?.height ?? originalBaseState?.height ?? baseHeight,
      left: effectiveBaseSnapshot?.left ?? originalBaseState?.left ?? baseX,
      top: effectiveBaseSnapshot?.top ?? originalBaseState?.top ?? baseY,
      rotate: effectiveBaseSnapshot?.rotate ?? originalBaseState?.rotate ?? baseRotation,
    }

    const decoded = evaluateImageOptionTransform(selectedImageOption!, baseTransform)

    // Decode clipGroup from percentages if available
    const clipGroupPct = selectedImageOption?.clipGroupPct
    const clipGroup = clipGroupPct
      ? decodeClipGroupFromPercentages(clipGroupPct, {
          width: decoded.width,
          height: decoded.height,
          rotate: decoded.rotate,
        })
      : baseClipGroup

    const optionSrc = selectedImageOption?.src ?? selectedImageOption?.dataSrc
    const src = optionSrc ?? baseSrc ?? image

    return {
      width: decoded.width,
      height: decoded.height,
      x: decoded.left,
      y: decoded.top,
      rotation: decoded.rotate,
      clipGroup,
      src,
    }
  }, [
    editingMode,
    selectedImageOption,
    originalBaseState,
    baseWidth,
    baseHeight,
    baseX,
    baseY,
    baseRotation,
    baseClipGroup,
    baseSrc,
    image,
  ])

  const { width, height, x, y, rotation, clipGroup, src } = geom

  // useSyncImageOptionTransform(layerStore)
  // useSyncClipGroupOption(layerStore)

  // Apply VectorEditor overlay to the image if present
  // When clipGroup exists, pass container dimensions so overlay is applied
  // AFTER extracting the visible clipped portion of the image
  const { imageUrl: compositedImageUrl, clipGroupBakedIn } = useImageWithOverlay({
    imageUrl: src,
    overlay: overlayData,
    enabled: true,
    clipGroup: clipGroup,
    containerWidth: width,
    containerHeight: height,
  })

  const loadingState = useStore(ImageLoadingStore, state => state[layerId] || DEFAULT_LOADING_STATE)
  const pendingToast = useStore(PendingToastStore, state => state[layerId])

  // Use composited image if available, otherwise fall back to original
  const imageSrc = compositedImageUrl || src

  // When overlay was composited with clipGroup handling, the positioning is already baked in.
  // Create a "normalized" clipGroup that positions the image at (0,0) with container dimensions.
  // This preserves the clipFunc boundary while using the pre-positioned composited image.
  const effectiveClipGroup = useMemo(() => {
    if (clipGroupBakedIn && clipGroup) {
      return {
        absoluteX: 0,
        absoluteY: 0,
        absoluteWidth: width,
        absoluteHeight: height,
        rotation: 0,
      }
    }
    return clipGroup
  }, [clipGroupBakedIn, clipGroup, width, height])

  useEffect(() => {
    if (pendingToast && loadingState.isLoading && loadingState.progress >= 100) {
      const timeoutId = setTimeout(() => {
        ImageLoadingStore.dispatch({
          type: 'CLEAR_IMAGE_LOADING',
          payload: { layerId },
        })

        if (pendingToast.toastType === 'success') {
          showToast(t(TOAST.TEMPLATE_EDITOR.BACKGROUND_REMOVED))
        } else if (pendingToast.toastType === 'error') {
          showToast(t(TOAST.TEMPLATE_EDITOR.REMOVE_BACKGROUND_FAILED), { isError: true })
        }

        PendingToastStore.dispatch({
          type: 'CLEAR_PENDING_TOAST',
          payload: { layerId },
        })
      }, ONE_SECOND_IN_MILLISECONDS / 2)

      return () => clearTimeout(timeoutId)
    }
  }, [imageSrc, pendingToast, layerId, loadingState, t])

  const componentProps = useMemo(() => {
    return {
      src: imageSrc,
      mask,
      width,
      height,
      x,
      y,
      rotation,
      // Use visible/invisible instead of not render this component
      // to create a empty zone that we can still evaluate the zone
      // selecting multiple layers or editing single layer
      visible: visible,
    }
  }, [height, imageSrc, mask, rotation, visible, width, x, y])

  /**
   * Handles double-click to toggle inner edit mode for clipGroup functionality.
   * Initializes clipGroup on first entry and triggers transformer update.
   */
  const onImageDoubleClick = useCallback(() => {
    if (!mask) return

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    if (now - lastToggleRef.current < 300) {
      return
    }
    lastToggleRef.current = now

    // In individual mode without selection: guide user to select an option first (for inner image edit)
    if (editingMode === 'individual' && !selectedImageOption) {
      subInspectorStoreActions.openSubInspector('personalize-image-inspector', {
        showSelectInnerOptionBanner: true,
      })
      return
    }

    const current = layerStore.getState()
    const hasClipGroup = Boolean(current?.image && isObject(current.image) && current.image.clipGroup)

    // Initialize clipGroup on first entry to inner edit mode
    if (!hasClipGroup) {
      const initClipGroup = {
        absoluteWidth: width,
        absoluteHeight: height,
        absoluteX: 0,
        absoluteY: 0,
        rotation: 0,
      }
      const next = {
        ...current,
        image: {
          ...(current?.image && isObject(current.image) ? current.image : {}),
          clipGroup: initClipGroup,
        },
      }
      layerStore.dispatch({ type: 'UPDATE_LAYER', payload: { state: next as any } })
    }

    setIsEditingInner(prev => !prev)
    // Ask stage to re-bind transformer to the node with current id
    setTimeout(() => {
      Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.UPDATE_TRANSFORMER)
    }, 0)
  }, [height, layerStore, width, mask, editingMode, selectedImageOption])

  // When entering inner-edit mode, ensure transformer targets the inner node immediately
  useEffect(() => {
    if (isEditingInner) {
      setTimeout(() => {
        Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.UPDATE_TRANSFORMER)
      }, 0)
    }
  }, [isEditingInner])

  // Exit inner-edit mode automatically if mask is removed
  useEffect(() => {
    if (!mask && isEditingInner) {
      setIsEditingInner(false)
      setTimeout(() => {
        Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.UPDATE_TRANSFORMER)
      }, 0)
    }
  }, [mask, isEditingInner])

  /**
   * Updates clipGroup state when inner image is transformed (drag/resize).
   * Called from KonvaImageWithMask during inner edit mode.
   * In individual mode, synchronously encodes clipGroup to percentages and saves to selected option.
   */
  const onInnerTransform = useCallback(
    (state: {
      absoluteWidth: number
      absoluteHeight: number
      absoluteX: number
      absoluteY: number
      rotation: number
    }) => {
      const current = layerStore.getState()

      // Get image option set data for synchronous update
      const imageOptionSet = current.optionSet?.find(os => os.type === EOptionSet.IMAGE_OPTION)
      const editingMode = (imageOptionSet?.editingMode as 'sync' | 'individual') || 'sync'

      // Update layer clipGroup
      const nextClipGroup = {
        absoluteWidth: state.absoluteWidth,
        absoluteHeight: state.absoluteHeight,
        absoluteX: state.absoluteX,
        absoluteY: state.absoluteY,
        rotation: state.rotation,
      }

      const next: any = {
        ...current,
        image: {
          ...(current?.image && typeof current.image === 'object' ? current.image : {}),
          clipGroup: nextClipGroup,
        },
      }

      // In individual mode: synchronously encode and save to selected option
      if (editingMode === 'individual' && imageOptionSet) {
        const dataKey = optionSetDataKeys[EOptionSet.IMAGE_OPTION]
        const files: ImageOptionSet[] = (imageOptionSet.data as Record<string, any>)?.[dataKey] || []
        const selectedIndex = files.findIndex(f => f.selecting)

        if (selectedIndex !== -1) {
          const containerWidth = current.width || 0
          const containerHeight = current.height || 0
          const containerRotate = current.rotate || 0
          const originalClipGroup = imageOptionSet?.originalClipGroup

          if (containerWidth > 0 && containerHeight > 0) {
            // Encode clipGroup to percentages
            const clipGroupPct = encodeClipGroupToPercentages(
              nextClipGroup,
              { width: containerWidth, height: containerHeight, rotate: containerRotate },
              originalClipGroup
            )

            // Update the selected option synchronously (only store percentage)
            const updatedFiles = [...files]
            updatedFiles[selectedIndex] = {
              ...updatedFiles[selectedIndex],
              clipGroupPct,
            }

            // Update option set in the same state update
            next.optionSet = current.optionSet?.map(os =>
              os.type === EOptionSet.IMAGE_OPTION ? { ...os, data: { ...os.data, [dataKey]: updatedFiles } } : os
            )
          }
        }
      }

      // Single synchronous dispatch with both layer and option updates
      layerStore.dispatch({ type: 'UPDATE_LAYER', payload: { state: next } })
      setTimeout(() => Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.UPDATE_TRANSFORMER), 0)
    },
    [layerStore]
  )

  return (
    <Group id={`${layerId}-wrapper`}>
      <KonvaImageWithMask
        {...componentProps}
        {...otherProps}
        id={layerId}
        clipGroup={effectiveClipGroup}
        editInnerImage={isEditingInner}
        onInnerTransform={onInnerTransform}
        onDblClick={onImageDoubleClick}
        name={isEditingInner ? INNER_EDIT_NODE_NAME : LAYER_NAME}
      />

      <InnerEditModeIndicator
        visible={isEditingInner && Boolean(clipGroup)}
        width={width}
        height={height}
        x={x}
        y={y}
        rotation={rotation}
      />

      {loadingState.isLoading && (
        <KonvaRemoveBackgroundLoading
          x={x}
          y={y}
          width={width}
          height={height}
          rotation={rotation}
          isVisible={loadingState.isLoading}
          progress={loadingState.progress}
        />
      )}
    </Group>
  )
}

export const ImageRenderer = memo(withInteractiveElement(ImageRendererComponent))
