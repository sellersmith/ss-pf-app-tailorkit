import type { KonvaEditorState } from 'extensions/tailorkit-src/src/assets/handlers/event-handlers/image-editor'
import { showImageEditorModal } from 'extensions/tailorkit-src/src/assets/handlers/event-handlers/image-editor/modal'
import { getMaskConfigOptimized } from 'extensions/tailorkit-src/src/assets/handlers/event-handlers/upload-image'
import { loadFeature } from 'extensions/tailorkit-src/src/assets/utils/feature-loader'
import type { KonvaFeatureModule } from 'extensions/tailorkit-src/src/assets/utils/feature-loader.types'
import type { IMaskConfig } from 'extensions/tailorkit-src/src/shared/libraries/konva/core'
import type { TransformerConfig } from 'konva/lib/shapes/Transformer'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { removeImageBackground } from '~/modules/TemplateEditor/utils/removeImageBackground'
import { getLayerStoreById } from '~/stores/modules/layer'
import { EOptionSet, type IMAGE_OPTION_SET, type ImageOptionSet as ImageOptionSetType } from '~/types/psd'
import { useModal } from '~/utils/hooks/useModal'
import { uuid } from '~/utils/uuid'
import { UPLOAD_PREVIEW_MODAL_ID } from '../../../constant'
import { DEFAULT_IMAGE_UPLOADER_OPTION_DATA } from '~/modules/TemplateEditor/elements/constants/image'

/**
 * Load Konva feature using the universal feature loader.
 * In admin context, provides dynamic import callback.
 */
async function ensureKonvaLoaded(): Promise<void> {
  await loadFeature<KonvaFeatureModule>('konva', {
    adminImport: () => import('extensions/tailorkit-src/src/assets/features/konva/index'),
  })
}

/**
 * UploadPreviewModal component for previewing and managing image uploads
 *
 * This modal should be rendered at a higher level to avoid conflicts when multiple
 * ImageOptionSet components are present. The optionSet and related data are passed
 * through the modal state when opening the modal.
 */
export const UploadPreviewModal = () => {
  const { state, closeModal } = useModal()

  const modalActive = state[UPLOAD_PREVIEW_MODAL_ID]?.active
  const modalData = state[UPLOAD_PREVIEW_MODAL_ID]?.data || {}
  const {
    layerId,
    url: imageUrl,
    layerDimensions,
    name,
    source,
    onReplace,
    optionSet,
    onSelect,
    replacingImage,
  } = modalData

  const { width = 160, height } = layerDimensions || {}

  // Resolve edit permissions from layer settings with sensible defaults
  const editPermissions = useMemo(() => {
    if (!layerId) return DEFAULT_IMAGE_UPLOADER_OPTION_DATA.allowCustomerToEditImage
    const layerStore = getLayerStoreById(layerId)
    const layerSettings = (layerStore?.getState()?.settings as any) || {}
    const imageUploaderOptions = layerSettings.imageUploaderOptions || {}
    return imageUploaderOptions.allowCustomerToEditImage ?? DEFAULT_IMAGE_UPLOADER_OPTION_DATA.allowCustomerToEditImage
  }, [layerId])

  const selectingFile = useMemo(
    () => (optionSet as IMAGE_OPTION_SET)?.data?.files?.find(file => file.selecting),
    [optionSet]
  )
  const clipGroup = useMemo(() => selectingFile?.clipGroup, [selectingFile])

  // Get overlay data from option or layer settings
  // This allows uploaded images to inherit SVG overlays (clip paths, filters, etc.) from VectorEditor
  const inheritableOverlay = useMemo(() => {
    const files = (optionSet as IMAGE_OPTION_SET)?.data?.files || []

    // 1. First try the selecting file (if it has overlay)
    if (selectingFile?.overlay?.overlaySvg) {
      return selectingFile.overlay
    }

    // 2. Fall back to first preset file with overlay (excludes uploaded/ai-generated)
    const presetWithOverlay = files.find((file: ImageOptionSetType) => !file.source && file.overlay?.overlaySvg)
    if (presetWithOverlay?.overlay) {
      return presetWithOverlay.overlay
    }

    // 3. Fall back to layer settings overlay (when overlay is stored at layer level, not option level)
    if (layerId) {
      const layerStore = getLayerStoreById(layerId)
      const layerSettings = layerStore?.getState()?.settings as any
      if (layerSettings?.overlay?.overlaySvg) {
        return layerSettings.overlay
      }
    }

    return undefined
  }, [optionSet, selectingFile, layerId])

  const closeModalHandler = useCallback(() => {
    closeModal(UPLOAD_PREVIEW_MODAL_ID)
  }, [closeModal])

  const handleSaveImage = useCallback(
    (finalUrl?: string, editorState?: KonvaEditorState) => {
      if (!optionSet || !onSelect || !layerId) {
        console.error('Missing optionSet or onSelect callback in modal data')
        return
      }

      const layerStore = getLayerStoreById(layerId)
      if (!layerStore) {
        console.error('Layer store not found')
        return
      }

      const _id = uuid()
      const temporaryOptionImage = {
        _id,
        name,
        src: finalUrl || imageUrl,
        selecting: false,
        source,
        clipGroup: {
          absoluteWidth: editorState?.absoluteWidth ?? width,
          absoluteHeight: editorState?.absoluteHeight ?? height,
          absoluteX: editorState?.absoluteX ?? 0,
          absoluteY: editorState?.absoluteY ?? 0,
          rotation: editorState?.rotation ?? 0,

          // These are the values that are used to position the image on the canvas
          x: editorState?.x ?? 0,
          y: editorState?.y ?? 0,
          width: editorState?.width ?? width,
          height: editorState?.height ?? height,
        },
        // Inherit overlay from preset options (SVG clip paths, filters, etc. from VectorEditor)
        ...(inheritableOverlay && { overlay: inheritableOverlay }),
      }

      let files: ImageOptionSetType[]
      if (replacingImage) {
        files = optionSet?.data?.files?.map((file: ImageOptionSetType) =>
          file._id === replacingImage._id ? temporaryOptionImage : file
        )
      } else {
        files = [temporaryOptionImage, ...(optionSet?.data?.files || [])]
      }

      const _optionSet = {
        ...optionSet,
        data: {
          ...optionSet?.data,
          files,
        },
      }

      onSelect(_optionSet, _id)
      closeModal(UPLOAD_PREVIEW_MODAL_ID)
    },
    [
      optionSet,
      onSelect,
      layerId,
      name,
      imageUrl,
      source,
      width,
      height,
      replacingImage,
      closeModal,
      inheritableOverlay,
    ]
  )

  const handleReplaceImage = useCallback(() => {
    if (typeof onReplace === 'function') {
      onReplace()
    }
  }, [onReplace])

  // When the temporary UploadPreviewModal opens, immediately launch the new image editor modal
  const openedRef = useRef(false)
  useEffect(() => {
    if (!modalActive || !imageUrl || openedRef.current) {
      return
    }
    openedRef.current = true

    const img = new Image()
    img.onload = async () => {
      // Ensure Konva is loaded for admin Preview mode
      await ensureKonvaLoaded()

      // Map granular permissions to transformer/UI capabilities
      const transformerConfig: Partial<TransformerConfig> & {
        draggable?: boolean
        removeBackgroundEnabled?: boolean
      } = {
        // Resize controls and zoom buttons
        resizeEnabled: !!editPermissions?.allowZoom,
        // Rotation handles and rotate buttons
        rotateEnabled: !!editPermissions?.allowRotate,
        // Drag to move image inside frame
        draggable: !!editPermissions?.allowTransform,
        // Show/hide Remove background action
        removeBackgroundEnabled: !!editPermissions?.allowRemoveBackground,
      }

      // Get mask config from layer's option sets
      let maskConfig: IMaskConfig | undefined

      // Find mask from selecting mask option set
      const maskOptionSet = getLayerStoreById(layerId)
        .getState()
        .optionSet?.find(optionSet => optionSet.type === EOptionSet.MASK_OPTION)

      if (maskOptionSet) {
        const masks = maskOptionSet.data?.masks || []
        const selectingMaskOption = masks.find(mask => mask.selecting) || masks[0]
        maskConfig = getMaskConfigOptimized({ v: selectingMaskOption?.src })
      }

      await showImageEditorModal({
        file: undefined as unknown as File,
        objectUrl: imageUrl,
        maskConfig,
        layerDimensions: layerDimensions || {
          width: width || 160,
          height: height || 160,
          left: 0,
          top: 0,
          rotation: 0,
        },
        imageElement: img,
        initialState: clipGroup ?? { zoom: 1, rotation: 0 },
        transformerConfig,
        onCancel: () => {
          closeModalHandler()
          openedRef.current = false
        },
        onReplaceImage: () => {
          handleReplaceImage()
          closeModalHandler()
          openedRef.current = false
        },
        onSubmit: async (_editorState, uploadedUrl: string) => {
          handleSaveImage(uploadedUrl, _editorState)
          openedRef.current = false
        },
        onRemoveBackground: async ({
          objectUrl,
          konvaEditor,
          setLoading,
          setObjectUrl,
          setRemovedInSession,
          setImageElement,
        }) => {
          try {
            setLoading(true)
            const { processedUrl, imageEl } = await removeImageBackground(objectUrl)
            if (konvaEditor && typeof konvaEditor.replaceImage === 'function') {
              konvaEditor.replaceImage(imageEl)
            }
            setObjectUrl(processedUrl)
            setRemovedInSession(true)
            setImageElement(imageEl)
            setLoading(false, true)
          } catch (e) {
            // eslint-disable-next-line no-alert
            alert('Service is not available right now')
            setLoading(false)
          }
        },
      })
    }
    img.src = imageUrl

    return () => {
      openedRef.current = false
      closeModalHandler()
    }
  }, [
    modalActive,
    imageUrl,
    layerId,
    layerDimensions,
    width,
    height,
    clipGroup,
    editPermissions,
    closeModalHandler,
    handleReplaceImage,
    handleSaveImage,
  ])

  return null
}
