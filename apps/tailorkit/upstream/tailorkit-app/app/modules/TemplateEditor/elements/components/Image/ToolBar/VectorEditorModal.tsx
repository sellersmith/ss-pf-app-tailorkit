import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { MODAL_ID } from '~/constants/modal'
import { useStore } from '~/libs/external-store'
import { FILE_UPLOAD_EVENTS } from '~/modules/TemplateEditor/constants'
import VectorEditor from '~/modules/VectorEditor'
import type { OverlaySvgOutput, PreviewImageConfig, OverlayState } from '~/modules/VectorEditor/types'
import { preCompositeThumbnail } from '~/shared/utils/thumbnail-pre-compositor'
import type { TLayerStore } from '~/stores/modules/layer'
import { TemplateEditorStore } from '~/stores/modules/template'
import type { NodeImage, ImageOptionSet } from '~/types/psd'
import { EOptionSet, optionSetDataKeys } from '~/types/psd'
import { dataURLtoFile, isSvgImage } from '~/utils/file-types'
import { useModal } from '~/utils/hooks/useModal'
import { uuid } from '~/utils/uuid'

type VectorEditorModalProps = {
  imageUrl?: string
  layerStore?: TLayerStore
}

type OverlayData = {
  overlaySvg?: string
  editableSvg?: string
  overlayState?: OverlayState
  overlayMetadata?: unknown
} | null

/**
 * Selector function to extract overlay data from layer state.
 */
function selectOverlayData(state: ReturnType<TLayerStore['getState']>, isSvg: boolean): OverlayData {
  if (isSvg) return null

  // Check image option set first (if applicable)
  const imageOptionSet = state.optionSet?.find(os => os.type === EOptionSet.IMAGE_OPTION)
  if (imageOptionSet) {
    const dataKey = optionSetDataKeys[EOptionSet.IMAGE_OPTION]
    const files: ImageOptionSet[] = (imageOptionSet.data as any)?.[dataKey] || []
    const selectedFile = files.find(f => f.selecting)
    if (selectedFile?.overlay) {
      return selectedFile.overlay
    }
  }

  // Fallback to layer-level overlay
  return state.settings?.overlay || null
}

function svgToDataUri(svgString: string): string {
  const encoded = encodeURIComponent(svgString).replace(/'/g, '%27').replace(/"/g, '%22')
  return `data:image/svg+xml,${encoded}`
}

/**
 * Trigger composited thumbnail upload (fire and forget).
 * The withTemplateLayerUploader HOC will handle the upload completion and update the layer.
 */
function triggerCompositedThumbnailUpload(dataUrl: string, layerId: string, optionId: string) {
  const file = dataURLtoFile(dataUrl, `composited-${optionId}.png`)

  Transmitter.trigger(FILE_UPLOAD_EVENTS.SELECT, {
    files: [{ _id: layerId, file }],
    fileUploadType: 'composited-thumbnail',
    compositedThumbnailMeta: {
      optionId, // Track which image option this thumbnail is for
    },
  })
}

/**
 * Inner component that uses useStore to subscribe to layer store changes.
 * This is separated to allow proper hook usage (hooks can't be conditional).
 */
function VectorEditorModalInner({
  imageUrl,
  layerStore,
  isSvg,
  isOpen,
  onClose,
}: {
  imageUrl: string
  layerStore: TLayerStore
  isSvg: boolean
  isOpen: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()

  // Get preview product image for VectorEditor environmental background
  const previewProductImage = useStore(TemplateEditorStore, state => state.previewProductImage)

  // Convert previewProductImage to PreviewImageConfig format (only if visible)
  const previewImageConfig: PreviewImageConfig | undefined = useMemo(() => {
    if (!previewProductImage || previewProductImage.visible === false) {
      return undefined
    }
    return {
      src: previewProductImage.src,
      left: previewProductImage.left,
      top: previewProductImage.top,
      width: previewProductImage.width,
      height: previewProductImage.height,
      rotation: previewProductImage.rotation,
      naturalWidth: previewProductImage.naturalWidth,
      naturalHeight: previewProductImage.naturalHeight,
    }
  }, [previewProductImage])

  // Create a stable selector that captures isSvg
  const overlaySelector = useCallback(
    (state: ReturnType<TLayerStore['getState']>) => selectOverlayData(state, isSvg),
    [isSvg]
  )

  // Subscribe to store changes for overlay data
  const savedOverlay = useStore(layerStore, overlaySelector)

  const savedOverlaySvgDataUri = useMemo(() => {
    const editableSvg = savedOverlay?.editableSvg || savedOverlay?.overlaySvg
    if (!editableSvg) return undefined
    return svgToDataUri(editableSvg)
  }, [savedOverlay])

  const handleSvgSave = useCallback(
    (editedSvgUrl: string) => {
      const currentState = layerStore.getState()
      layerStore.dispatch({
        type: 'UPDATE_LAYER',
        payload: {
          state: {
            image: {
              ...(currentState.image as NodeImage),
              // Always generate new ID when saving SVG edits to ensure duplicated layers
              // become independent (each layer gets its own unique image reference)
              _id: uuid(),
              src: editedSvgUrl,
              originalSrc: editedSvgUrl,
              dataSrc: editedSvgUrl,
            },
          },
        },
      })
    },
    [layerStore]
  )

  const handleOverlaySave = useCallback(
    async (output: OverlaySvgOutput) => {
      const currentState = layerStore.getState()
      const currentImage = currentState.image as NodeImage

      // Create overlay data object
      const overlayData = {
        // Use combinedSvg for rendering (contains clipPath, mask, filter, paths)
        overlaySvg: output.combinedSvg,
        // Use editableSvg for resuming editing (contains all paths)
        editableSvg: output.editableSvg,
        // Store overlay state for restoring clip/hole/adjustment mask settings
        overlayState: output.overlayState,
        overlayMetadata: output.metadata,
      }

      // Update layer with overlay data stored in settings
      layerStore.dispatch({
        type: 'UPDATE_LAYER',
        payload: {
          state: {
            settings: {
              ...currentState.settings,
              overlay: overlayData,
            },
          },
        },
      })

      // Check if there's an image option set with a selected file
      const imageOptionSet = currentState.optionSet?.find(os => os.type === EOptionSet.IMAGE_OPTION)
      let thumbnailImageUrl: string | undefined
      let thumbnailOptionId: string | undefined

      if (imageOptionSet) {
        const dataKey = optionSetDataKeys[EOptionSet.IMAGE_OPTION]
        const files: ImageOptionSet[] = (imageOptionSet.data as any)?.[dataKey] || []
        const selectedIndex = files.findIndex(f => f.selecting)

        if (selectedIndex >= 0) {
          const selectedFile = files[selectedIndex]
          thumbnailImageUrl = selectedFile.src
          thumbnailOptionId = selectedFile._id

          // Update the selected option with overlay data
          const updatedFiles = files.map((file, idx) => {
            if (idx === selectedIndex) {
              return {
                ...file,
                overlay: overlayData,
              }
            }
            return file
          })

          layerStore.dispatch({
            type: 'UPDATE_OPTION_SET',
            payload: {
              optionSet: {
                ...imageOptionSet,
                data: {
                  ...(imageOptionSet.data as any),
                  [dataKey]: updatedFiles,
                },
              },
            },
          })
        }
      }

      // If no image option set, use the layer's image directly
      if (!thumbnailImageUrl && currentImage?.src) {
        thumbnailImageUrl = currentImage.src
        thumbnailOptionId = currentImage._id || currentState._id
      }

      // Generate and upload composited thumbnail (fire and forget)
      if (thumbnailImageUrl && thumbnailOptionId) {
        try {
          const compositedResult = await preCompositeThumbnail({
            imageUrl: thumbnailImageUrl,
            overlay: overlayData,
            thumbnailWidth: 120,
          })
          if (compositedResult) {
            triggerCompositedThumbnailUpload(compositedResult.dataUrl, currentState._id, thumbnailOptionId)
          }
        } catch (error) {
          console.warn('Failed to generate composited thumbnail:', error)
        }
      }
    },
    [layerStore]
  )

  const modalTitle = isSvg ? t('edit-vector') : t('edit-image')

  return (
    <VectorEditor
      isModal={true}
      modalOpen={isOpen}
      modalTitle={modalTitle}
      onModalClose={onClose}
      svgUrl={isSvg ? imageUrl : undefined}
      rasterImageUrl={!isSvg ? imageUrl : undefined}
      svgDataUri={!isSvg ? savedOverlaySvgDataUri : undefined}
      initialOverlayState={!isSvg ? savedOverlay?.overlayState : undefined}
      onSave={isSvg ? handleSvgSave : undefined}
      onOverlaySave={!isSvg ? handleOverlaySave : undefined}
      uploadToShopify={isSvg}
      previewImageConfig={previewImageConfig}
    />
  )
}

/**
 * @description Renders the VectorEditor modal outside the overflow popover.
 * The open/close state is controlled by modalStore via MODAL_ID.VECTOR_EDITOR_MODAL.
 */
export function VectorEditorModal({ imageUrl, layerStore }: VectorEditorModalProps) {
  const { state, closeModal } = useModal()

  const isOpen = Boolean(state[MODAL_ID.VECTOR_EDITOR_MODAL]?.active)
  const isSvg = useMemo(() => isSvgImage(imageUrl), [imageUrl])

  const handleClose = useCallback(() => {
    closeModal(MODAL_ID.VECTOR_EDITOR_MODAL)
  }, [closeModal])

  // Clean up stale modal state when component unmounts (e.g. layer deselected)
  useEffect(() => {
    return () => {
      closeModal(MODAL_ID.VECTOR_EDITOR_MODAL)
    }
  }, [closeModal])

  // Don't render if not open, no image, or no layer store
  if (!isOpen || !imageUrl || !layerStore) return null

  return (
    <VectorEditorModalInner
      imageUrl={imageUrl}
      layerStore={layerStore}
      isSvg={isSvg}
      isOpen={isOpen}
      onClose={handleClose}
    />
  )
}
