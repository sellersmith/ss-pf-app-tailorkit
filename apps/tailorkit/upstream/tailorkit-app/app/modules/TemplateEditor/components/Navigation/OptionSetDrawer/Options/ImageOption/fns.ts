import type { TLayerStore } from '~/stores/modules/layer'
import type { IMAGE_OPTION_SET, MASK_OPTION_SET } from '~/types/psd'
import { optionSetDataKeys } from '~/types/psd'
import type { IImageQuery } from '~/types/shopify-files'
import { showGenericErrorToast } from '~/utils/toastEvents'
import { uuid } from '~/utils/uuid'

/**
 * Add image options to the option set
 * @param mediaFiles - The media files to add
 * @param layerStore - The layer store
 * @param optionSet - The option set
 */
export function addImageOptions(
  mediaFiles: IImageQuery[] | null,
  layerStore: TLayerStore,
  optionSet: IMAGE_OPTION_SET | MASK_OPTION_SET,
  shouldPushToData = true
) {
  const optionSetType = optionSet.type
  const optionSetDataKey = optionSetDataKeys[optionSetType as keyof typeof optionSetDataKeys]
  const optionSetData = (optionSet.data as Record<string, unknown[]> | null)?.[optionSetDataKey] || []

  if (!mediaFiles) return

  try {
    const imageOptionMedia: { src: string; name: string; _id: string }[] = []

    for (let i = 0; i < mediaFiles.length; i++) {
      const {
        image: { originalSrc },
        alt,
      } = mediaFiles[i]

      // Do not store original image dimensions - let the layer dimensions be the source of truth
      // The width/height will be set by the sync mechanism based on the current layer state
      imageOptionMedia.push({ src: originalSrc, name: alt, _id: uuid() })
    }

    const newOptionSet = {
      ...optionSet,
      type: optionSetType,
      data: {
        ...optionSet.data,
        [optionSetDataKey]: [
          ...(shouldPushToData ? optionSetData : []),
          ...imageOptionMedia.map(media => {
            return {
              ...media,
              selecting: false,
            }
          }),
        ],
      } as IMAGE_OPTION_SET['data'] | MASK_OPTION_SET['data'],
    }
    layerStore.dispatch({
      type: 'UPDATE_OPTION_SET',
      payload: { optionSet: newOptionSet },
    })
  } catch (e) {
    console.error('Failed to uploading images options set. :', e instanceof Error ? e.message : e)

    // Restore option images to previously
    const previousOptionSet: IMAGE_OPTION_SET | MASK_OPTION_SET = {
      ...optionSet,
      type: optionSetType,
      data: { [optionSetDataKey]: optionSetData } as IMAGE_OPTION_SET['data'] | MASK_OPTION_SET['data'],
    }

    layerStore.dispatch({
      type: 'UPDATE_OPTION_SET',
      payload: {
        optionSet: previousOptionSet,
      },
    })

    showGenericErrorToast()
  }
}
