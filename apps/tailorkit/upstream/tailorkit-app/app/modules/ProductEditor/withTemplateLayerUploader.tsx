import type { EventObject } from 'extensions/tailorkit-src/src/assets/libraries/event-handler'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import cloneDeep from 'lodash/cloneDeep'
import type { ComponentType } from 'react'
import { Fragment, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { BackgroundUploaderResponse, BackgroundUploaderStatus } from '~/components/BackgroundUploader'
import BackgroundUploader from '~/components/BackgroundUploader'
import { FILE_UPLOAD_EVENTS } from '~/modules/TemplateEditor/constants'
import { TEMPLATES_ACTIONS } from '~/routes/api.templates/constants'
import { ProgressStoreActions } from '~/stores/canvas/progress'
import type { TLayerStore } from '~/stores/modules/layer'
import { getLayerStoreById } from '~/stores/modules/layer'
import { TemplateEditorStore } from '~/stores/modules/template'
import { EOptionSet, optionSetDataKeys } from '~/types/psd'
import { showToast } from '~/utils/toastEvents'
import { TOAST } from '~/constants/toasts'

/**
 * Update composited thumbnail URL in layer's image option set or layer settings
 */
function updateCompositedThumbnailInLayer(layerId: string, optionId: string, shopifyUrl: string) {
  const layerStore = getLayerStoreById(layerId)
  if (!layerStore) return

  const currentState = layerStore.getState()
  const imageOptionSet = currentState.optionSet?.find((os: any) => os.type === EOptionSet.IMAGE_OPTION)
  const dataKey = optionSetDataKeys[EOptionSet.IMAGE_OPTION]
  const files = imageOptionSet ? (imageOptionSet.data as any)?.[dataKey] || [] : []

  // If there's an image option set with files, update the specific file's compositedThumbnailSrc
  if (imageOptionSet && files.length > 0) {
    // Find and update the specific option
    const updatedFiles = files.map((file: any) => {
      if (file._id === optionId) {
        return { ...file, compositedThumbnailSrc: shopifyUrl }
      }
      return file
    })

    // Silent update - don't pollute undo history
    layerStore.dispatch(
      {
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
        skipTrace: true,
      },
      false
    )
  } else {
    // No image option set or no files - update layer settings with compositedThumbnailSrc
    layerStore.dispatch(
      {
        type: 'UPDATE_LAYER',
        payload: {
          state: {
            settings: {
              ...(currentState.settings || {}),
              compositedThumbnailSrc: shopifyUrl,
            } as any,
          },
        },
        skipTrace: true,
      },
      false
    )
  }
}

/**
 * Higher-Order Component that wraps a component with BackgroundUploader functionality
 * for handling template layer image uploads in the ProductEditor.
 *
 * This HOC adds background file upload capabilities to the wrapped component,
 * allowing users to upload images for template layers with progress tracking
 * and automatic retry logic.
 *
 * @param Component - The React component to wrap with upload functionality
 * @returns A new component with BackgroundUploader integrated
 *
 * @example
 * ```tsx
 * const ProductEditorWithUploader = withTemplateLayerUploader(ProductEditor)
 * ```
 */
export default function withTemplateLayerUploader<P extends object>(Component: ComponentType<P>) {
  return function TemplateLayerUploader(props: P) {
    const { t } = useTranslation()

    // Listen to events from the background uploader
    useEffect(() => {
      // Define function to update the progress
      function updateProgress(e: EventObject) {
        const { failed, pending, completed, uploading } = (e.data || {}) as BackgroundUploaderStatus

        const index = failed + completed

        ProgressStoreActions.setProgress({ index, total: index + pending + uploading })
      }

      function replaceBase64SourceToURLSource(layerStore: TLayerStore, file: any, _id: string) {
        const layerState = layerStore.getState()
        const srcFile = file.image.originalSrc
        const altFile = file.alt
        const { image, optionSet = [] } = layerState
        let _optionSet: any[] = optionSet

        // Replace the new source of option set images
        if (optionSet && optionSet.length > 0) {
          const optionSetImage = optionSet.find(option => option.type === EOptionSet.IMAGE_OPTION)
          const files = optionSetImage?.data?.files || []

          if (optionSetImage && files.length > 0) {
            const _files = files.map((file: any) => {
              if (optionSetImage._id === _id) {
                file.src = srcFile
                file.imageName = undefined
              }

              return file
            })

            _optionSet = optionSet.map(option => {
              if (option._id === optionSetImage?._id) {
                return { ...option, data: { ...option.data, files: _files } }
              }

              return option
            })
          }
        }

        if (image && typeof image === 'object' && layerState._id === _id) {
          // Exclude base64 dataSrc out of the image object
          const { dataSrc, src, ...restImage } = image

          const updatedImage = { ...cloneDeep(restImage), dataSrc: srcFile, src: srcFile, imageName: altFile }

          layerStore.dispatch(
            {
              type: 'UPDATE_LAYER',
              payload: {
                state: {
                  image: updatedImage,
                  optionSet: _optionSet,
                },
              },
              // Don't need to listen if a dataSrc is replacing from base64 to URL
              skipTrace: true,
            },
            false
          )
        }
      }

      // Define function to process the response
      function handleResponse(e: EventObject) {
        // Parse response to update layer data
        const layerStores = TemplateEditorStore.getState().extractedLayerStores

        const {
          uploadedFiles = [],
          errorFiles,
          _id,
          fileUploadType,
          compositedThumbnailMeta,
        } = (e.data || {}) as BackgroundUploaderResponse & {
          _id: string
          fileUploadType?: string
          compositedThumbnailMeta?: { optionId: string }
        }

        // Handle composited thumbnail uploads
        if (fileUploadType === 'composited-thumbnail' && compositedThumbnailMeta?.optionId) {
          const uploadedFile = uploadedFiles[0]
          if (uploadedFile) {
            const shopifyUrl = uploadedFile.image?.originalSrc || uploadedFile.url || uploadedFile.src
            if (shopifyUrl) {
              updateCompositedThumbnailInLayer(_id, compositedThumbnailMeta.optionId, shopifyUrl)
            }
          }
          updateProgress(e)
          return // Don't continue to normal layer image handling
        }

        uploadedFiles.forEach((file: any) => {
          layerStores.forEach((layerStore: TLayerStore) => {
            const layerState = layerStore.getState()

            const { type } = layerState

            if (type === 'multi-layout') {
              const optionSet = layerState.optionSet?.find(ot => ot.type === EOptionSet.MULTI_LAYOUT_OPTION)

              if (!optionSet) return

              // Get layer ids of layouts
              const layerIds = optionSet.data?.multi_layout?.layouts.map(layout => layout.layerIds).flat() || []

              // Loop through layer id of layout to replace the image
              layerIds.forEach(layerId => {
                const layerStore = getLayerStoreById(layerId)

                replaceBase64SourceToURLSource(layerStore, file, _id)
              })

              return
            }

            replaceBase64SourceToURLSource(layerStore, file, _id)
          })
        })

        if (errorFiles.length > 0) {
          errorFiles.forEach((file: any) => {
            console.error('Image layer is not uploaded successfully: ', file)
          })

          // Delete the image layer if the image is not uploaded successfully
          TemplateEditorStore.dispatch({
            type: 'SET_EXTRACTED_LAYER_IDS',
            payload: {
              extractedLayerStores: TemplateEditorStore.getState().extractedLayerStores.filter(
                store => store.getState()._id !== _id
              ),
            },
            skipTrace: true,
          })

          // Show toast to user
          showToast(t(TOAST.TEMPLATE_EDITOR.SOME_LAYERS_NOT_UPLOADED), { isError: true })
        }

        // Update the progress
        updateProgress(e)
      }

      Transmitter.listen(FILE_UPLOAD_EVENTS.UPLOAD, updateProgress)
      Transmitter.listen(FILE_UPLOAD_EVENTS.UPLOADED, handleResponse)

      return () => {
        Transmitter.remove(FILE_UPLOAD_EVENTS.UPLOAD, updateProgress)
        Transmitter.remove(FILE_UPLOAD_EVENTS.UPLOADED, handleResponse)
      }
    }, [t])

    return (
      <Fragment>
        <Component {...props} />
        <BackgroundUploader
          t={t}
          resetStateEvent={FILE_UPLOAD_EVENTS.RESET}
          selectFileEvent={FILE_UPLOAD_EVENTS.SELECT}
          uploadFileEvent={FILE_UPLOAD_EVENTS.UPLOAD}
          uploadedFileEvent={FILE_UPLOAD_EVENTS.UPLOADED}
          message={t('uploading-index-of-total-layer-images')}
          actionUrl={`/api/templates?action=${TEMPLATES_ACTIONS.UPLOAD_FILES}`}
          // If an upload step takes too long to complete, end-users might be confused about whether the
          // process is hung, and this might result in actions we don't want. Therefore, to prevent this
          // potential not-good experience, we should let an upload step no longer than 20 seconds.
          maxFilesInOneUploadAction={5}
          maxSecondsPerUploadAction={20}
        />
      </Fragment>
    )
  }
}
