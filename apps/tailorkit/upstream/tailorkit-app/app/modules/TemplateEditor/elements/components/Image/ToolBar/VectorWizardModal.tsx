import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { MODAL_ID } from '~/constants/modal'
import VectorWizard from '~/modules/VectorWizard'
import type { VectorResult } from '~/modules/VectorWizard/types'
import type { TLayerStore } from '~/stores/modules/layer'
import { createLayerStore } from '~/stores/modules/layer'
import { TemplateEditorStoreActions } from '~/stores/modules/template'
import { LayerStoreSelection } from '~/stores/modules/layer-store-selection'
import { ELayerType } from '~/types/psd'
import { uuid } from '~/utils/uuid'
import { useModal } from '~/utils/hooks/useModal'

type VectorWizardModalProps = {
  imageUrl?: string
  layerStore?: TLayerStore
  originalImageDimensions?: { width: number; height: number }
}

/**
 * @description Renders the VectorWizard modal outside the overflow popover.
 * The open/close state is controlled by modalStore via MODAL_ID.VECTOR_WIZARD_MODAL.
 */
export function VectorWizardModal({ imageUrl, layerStore, originalImageDimensions }: VectorWizardModalProps) {
  const { t } = useTranslation()
  const { state, closeModal } = useModal()

  const isOpen = Boolean(state[MODAL_ID.VECTOR_WIZARD_MODAL]?.active)

  const handleClose = useCallback(() => {
    closeModal(MODAL_ID.VECTOR_WIZARD_MODAL)
  }, [closeModal])

  // Clean up stale modal state when component unmounts (e.g. layer deselected)
  useEffect(() => {
    return () => {
      closeModal(MODAL_ID.VECTOR_WIZARD_MODAL)
    }
  }, [closeModal])

  const handleError = useCallback((error: string) => {
    console.error('Vector conversion error:', error)
  }, [])

  const handleVectorResult = useCallback(
    (results: VectorResult[]) => {
      if (!layerStore || !imageUrl || results.length === 0) {
        handleClose()
        return
      }

      const originalLayer = layerStore.getState()
      const layerWidth = originalLayer.width ?? 100
      const layerHeight = originalLayer.height ?? 100
      const layerLeft = originalLayer.left ?? 0
      const layerTop = originalLayer.top ?? 0

      const imageWidth = originalImageDimensions?.width || layerWidth
      const imageHeight = originalImageDimensions?.height || layerHeight

      // Calculate scale factors from original image space to canvas layer space
      const scaleX = layerWidth / imageWidth
      const scaleY = layerHeight / imageHeight

      const newLayerStores: TLayerStore[] = []

      results.forEach((result, index) => {
        if (result.error || (!result.svgUrl && !result.svgDataUri)) return

        const svgSrc = result.svgUrl || result.svgDataUri
        if (!svgSrc) return

        // Scale bounds from original image space to canvas space
        const scaledLeft = layerLeft + result.bounds.x * scaleX
        const scaledTop = layerTop + result.bounds.y * scaleY
        const scaledWidth = result.bounds.width * scaleX
        const scaledHeight = result.bounds.height * scaleY

        const newLayerStore = createLayerStore({
          _id: uuid(),
          left: Math.round(scaledLeft),
          top: Math.round(scaledTop),
          width: Math.round(scaledWidth),
          height: Math.round(scaledHeight),
          rotate: 0,
          type: ELayerType.IMAGE,
          visible: true,
          label: `Vector ${index + 1}`,
          parent: '',
          psdId: '',
          blendingRanges: null,
          optionSet: [],
          image: {
            _id: uuid(),
            src: svgSrc,
            originalSrc: svgSrc,
            dataSrc: svgSrc,
            width: result.bounds.width,
            height: result.bounds.height,
            imageName: `vector-${result.shapeId}`,
          },
        })

        newLayerStores.push(newLayerStore)
      })

      if (newLayerStores.length > 0) {
        TemplateEditorStoreActions.addExtractedLayerStores(newLayerStores)

        setTimeout(() => {
          LayerStoreSelection.dispatch({
            type: 'SET_LAYER_STORE_SELECTION',
            payload: {
              clickedLayerStore: newLayerStores[0],
              checkedLayerStores: newLayerStores.length > 1 ? newLayerStores : [],
            },
          })
        }, 100)
      }

      handleClose()
    },
    [handleClose, imageUrl, layerStore, originalImageDimensions]
  )

  if (!isOpen || !imageUrl) return null

  return (
    <VectorWizard
      isModal={true}
      modalOpen={isOpen}
      modalTitle={t('convert-image-to-vector')}
      onModalClose={handleClose}
      imageUrl={imageUrl}
      onApply={handleVectorResult}
      onError={handleError}
    />
  )
}
