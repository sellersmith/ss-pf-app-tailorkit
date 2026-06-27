import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { TOAST } from '~/constants/toasts'
import { useStore } from '~/libs/external-store'
import { LayerStoreSelection } from '~/stores/modules/layer-store-selection'
import { ELayerType } from '~/types/psd'
import type { CharmSettings, NodeImage } from '~/types/psd'
import { showToast } from '~/utils/toastEvents'
import backgroundRemovalService from '~/services/BackgroundRemovalService'
import { useRemoveBackgroundWithStore } from './useRemoveBackgroundWithStore'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { FILE_UPLOAD_EVENTS } from '../constants'
import { dataURLtoFile } from '~/utils/file-types'
import { getLayerStoreById } from '~/stores/modules/layer'

/** Update both the CHARM layer settings and the parent CHARM_NODE's linkedProducts thumbnail */
function updateCharmThumbnail(clickedLayerStore: any, charmSettings: CharmSettings, newUrl: string) {
  // Update the CHARM layer's own settings
  clickedLayerStore.dispatch({
    type: 'UPDATE_LAYER',
    payload: {
      state: {
        settings: {
          ...charmSettings,
          productRef: {
            ...charmSettings.productRef,
            thumbnailUrl: newUrl,
          },
        },
      },
    },
  })

  // Also update the parent CHARM_NODE so the canvas rendering reflects the change
  const parentStore = getLayerStoreById(charmSettings.nodeId)
  if (parentStore) {
    const parentSettings = parentStore.getState().settings as any
    const linkedProducts = (parentSettings?.linkedProducts || []).map((p: any) =>
      p._id === charmSettings.productRef._id ? { ...p, thumbnailUrl: newUrl } : p
    )
    parentStore.dispatch({
      type: 'UPDATE_LAYER',
      payload: { state: { settings: { ...parentSettings, linkedProducts } } },
    })
  }
}

/**
 * Hook to remove background from an image (supports IMAGE and CHARM layers)
 * @returns {Object} - An object containing the handleRemoveBackground function
 */
export function useBackgroundRemoval() {
  const { t } = useTranslation()
  const clickedLayerStore = useStore(LayerStoreSelection, state => state.clickedLayerStore)
  const { startLoading, resetProgress } = useRemoveBackgroundWithStore()

  const handleRemoveBackground = useCallback(
    async (type: string = 'ai') => {
      const currentLayer = clickedLayerStore?.getState()
      const isImage = currentLayer?.type === ELayerType.IMAGE
      const isCharm = currentLayer?.type === ELayerType.CHARM

      if (!currentLayer || (!isImage && !isCharm)) {
        console.warn('No supported layer selected for background removal')
        return
      }

      const layerId = currentLayer._id

      // Derive image URL based on layer type
      let imageRef: string | undefined

      if (isImage) {
        const img = currentLayer.image
        if (typeof img === 'object' && img !== null) {
          imageRef = (img as NodeImage).src || (img as NodeImage).dataSrc
        } else if (typeof img === 'string') {
          imageRef = img
        }
      } else if (isCharm) {
        const charmSettings = currentLayer.settings as CharmSettings
        imageRef = charmSettings?.productRef?.thumbnailUrl
      }

      try {
        // Start the loading animation with store integration
        startLoading(layerId)
        showToast(t(TOAST.TEMPLATE_EDITOR.REMOVING_BACKGROUND))

        if (!imageRef) {
          console.error('No image reference found in the selected layer')
          showToast(t(TOAST.TEMPLATE_EDITOR.REMOVE_BACKGROUND_FAILED), { isError: true })
          resetProgress(layerId)
          return
        }

        // Convert image reference to File object
        let file: File

        if (typeof imageRef === 'string') {
          // If it's a URL, fetch it
          const response = await fetch(imageRef)
          const blob = await response.blob()
          file = new File([blob], 'image.png', { type: blob.type })
        } else {
          console.error('Unsupported image reference type')
          showToast(t(TOAST.TEMPLATE_EDITOR.REMOVE_BACKGROUND_FAILED), { isError: true })
          resetProgress(layerId)
          return
        }

        // Try local processing first, fallback to API if it fails
        try {
          if (type === 'ai' && backgroundRemovalService.isAvailable()) {
            // Check if background removal service is available and initialized
            const modelInfo = backgroundRemovalService.getModelInfo()
            console.log('Using local background removal with Transformers.js with model info', modelInfo)

            // Use the background removal service
            const processedFile = await backgroundRemovalService.removeBackground(file)

            // Convert the processed file to a data URL
            const processedDataUrl = await new Promise<string>(resolve => {
              const reader = new FileReader()
              reader.onload = () => resolve(reader.result as string)
              reader.readAsDataURL(processedFile)
            })

            // Update the layer based on type
            if (isImage && clickedLayerStore && currentLayer.image && typeof currentLayer.image !== 'string') {
              clickedLayerStore.dispatch({
                type: 'UPDATE_LAYER',
                payload: {
                  state: {
                    image: {
                      ...currentLayer.image,
                      src: processedDataUrl,
                    },
                  },
                },
              })
            } else if (isCharm && clickedLayerStore) {
              const charmSettings = currentLayer.settings as CharmSettings
              updateCharmThumbnail(clickedLayerStore, charmSettings, processedDataUrl)
            }

            // Use background upload mechanism - convert data URL to File and trigger upload
            const fileForUpload = dataURLtoFile(processedDataUrl, processedFile.name)

            // Trigger background upload using the Transmitter event system
            Transmitter.trigger(FILE_UPLOAD_EVENTS.SELECT, {
              files: [
                {
                  _id: layerId,
                  file: fileForUpload,
                },
              ],
            })

            // Show success message immediately since upload happens in background
            showToast(t(TOAST.TEMPLATE_EDITOR.BACKGROUND_REMOVED))
            resetProgress(layerId)
            return
          }

          throw new Error('Local background removal not available')
        } catch (localError) {
          console.warn('Local background removal failed, falling back to API:', localError)

          try {
            // Fallback to API approach
            console.log('Using API background removal fallback')

            // Prepare form data
            const formData = new FormData()
            formData.append('action', 'remove-background')
            formData.append('image', file)
            formData.append('type', type)

            // Call the API
            const apiResponse = await fetch('/api/services', {
              method: 'POST',
              body: formData,
            })

            const response = await apiResponse.json()

            if (response.success) {
              const result = response.data

              const resultImageUrl
                = result.data?.downloadUrl || result.data?.previewUrl || result.downloadUrl || result.previewUrl

              if (resultImageUrl && clickedLayerStore) {
                if (isImage && currentLayer.image && typeof currentLayer.image !== 'string') {
                  clickedLayerStore.dispatch({
                    type: 'UPDATE_LAYER',
                    payload: {
                      state: {
                        image: {
                          ...currentLayer.image,
                          src: resultImageUrl,
                        },
                      },
                    },
                  })
                } else if (isCharm) {
                  const charmSettings = currentLayer.settings as CharmSettings
                  updateCharmThumbnail(clickedLayerStore, charmSettings, resultImageUrl)
                }

                showToast(t(TOAST.TEMPLATE_EDITOR.BACKGROUND_REMOVED))
                resetProgress(layerId)
              } else {
                throw new Error('API background removal failed - no result URL')
              }
            } else {
              throw new Error('API background removal failed')
            }
          } catch (apiError) {
            console.error('API background removal also failed:', apiError)
            showToast(t(TOAST.TEMPLATE_EDITOR.REMOVE_BACKGROUND_FAILED), { isError: true })
            resetProgress(layerId)
            return
          }
        }
      } catch (error) {
        console.error('Error removing background:', error)
        showToast(t(TOAST.TEMPLATE_EDITOR.REMOVE_BACKGROUND_FAILED), { isError: true })
        resetProgress(layerId)
      }
    },
    [clickedLayerStore, startLoading, t, resetProgress]
  )

  return {
    handleRemoveBackground,
  }
}
