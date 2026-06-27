import { Fragment, useCallback } from 'react'
import { MODAL_ID } from '~/constants/modal'
import ImageSelector from '~/modules/modals/ImageSelector'
import { ELayerType, type LayerType } from '~/types/psd'
import type { IImageQuery } from '~/types/shopify-files'
import { useModal } from '~/utils/hooks/useModal'
import { useTourStatus } from '~/utils/hooks/useTourStatus'

export default function ImageSelectorComponent(props: {
  addElements: (type: LayerType, mediaFiles: IImageQuery[] | null) => void
}) {
  const { addElements } = props
  const { state, openModal, closeModal } = useModal()
  const { tourId, active: tourActive } = useTourStatus()
  const isInTour = !!tourId && tourActive

  const openImagesDialog = state?.[MODAL_ID.IMAGE_SELECTOR_MODAL]?.active
  const imageSelectorModalData = state?.[MODAL_ID.IMAGE_SELECTOR_MODAL]?.data as {
    mode: string
    layerId: string
    onReplaceImage: (imageSelected: IImageQuery[] | null) => void
  }
  const isReplacementMode = imageSelectorModalData?.mode === 'replace'
  const onReplaceImage = imageSelectorModalData?.onReplaceImage

  const addImageElements = useCallback(
    async (mediaFiles: IImageQuery[] | null) => {
      // Check if this is replacement mode
      if (isReplacementMode) {
        typeof onReplaceImage === 'function' && onReplaceImage(mediaFiles)
      } else {
        // Normal add elements mode
        addElements(ELayerType.IMAGE, mediaFiles)
      }
    },
    [addElements, isReplacementMode, onReplaceImage]
  )

  const toggleOpenImagesDialog = useCallback(
    (metaData?: any) => {
      const closeViaSelect = metaData?.closeViaSelect

      // Only prevent close modal if the modal is not close via select button and in the tour
      if (!closeViaSelect && isInTour) return

      if (openImagesDialog) {
        closeModal(MODAL_ID.IMAGE_SELECTOR_MODAL)
      } else {
        openModal(MODAL_ID.IMAGE_SELECTOR_MODAL)
      }
    },
    [closeModal, isInTour, openModal, openImagesDialog]
  )

  return (
    <Fragment>
      {openImagesDialog && (
        <ImageSelector
          active={openImagesDialog}
          onSelectImage={addImageElements}
          allowMultiple={!isReplacementMode} // Only allow single selection for replacement
          onClose={toggleOpenImagesDialog}
        />
      )}
    </Fragment>
  )
}
