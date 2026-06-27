import { getFileNameFromUrl } from 'extensions/tailorkit-src/src/assets/libraries/simple-url-parser'
import type { LayerDocument } from '~/models/Layer.server'
import type { TFileToUpload } from '~/shopify/graphql/files/types'
import type { IMAGE_OPTION_SET } from '~/types/psd'
import { sanitizeFileName } from '.'
import { uuid } from '../uuid'

/**
 * Interface for image name generation arguments
 */
interface ImageNameArgs {
  baseImageName: string
  prefix?: string
  suffix?: string
}

/**
 * Generates a flag image name by combining prefix, base name, and suffix
 * @param args - Object containing baseImageName, optional prefix and suffix
 * @returns Formatted image name string
 */
export const getFlagImageNameOfImageUpload = ({
  baseImageName,
  prefix = '',
  suffix = '',
}: ImageNameArgs): string | undefined => {
  if (!baseImageName) return

  return [prefix && `${prefix}_`, baseImageName, suffix && `_${suffix}`].filter(Boolean).join('')
}

/**
 * Removes prefix and suffix from a flagged image name
 * @param baseImageName - Original image name
 * @param prefix - Prefix to remove
 * @param suffix - Suffix to remove
 * @returns Clean image name string without prefix and suffix
 */
const removeImageNameFlags = (baseImageName: string, prefix: string, suffix: string): string | undefined => {
  if (!baseImageName) return undefined

  let cleanName = baseImageName

  // Remove prefix if it exists at the start
  if (cleanName.startsWith(`${prefix}_`)) {
    cleanName = cleanName.slice(prefix.length + 1)
  }

  // Remove suffix if it exists at the end
  if (cleanName.endsWith(suffix)) {
    cleanName = cleanName.slice(0, -suffix.length)
  }

  return cleanName
}

/**
 * Removes prefix and suffix from an option set image name
 * @param args - Object containing optionSet, baseImageName and item details
 * @returns Clean image name string without prefix and suffix
 */
export const getImageNameOfOptionSetWithoutFlag = ({
  optionSet,
  baseImageName,
  item,
}: {
  optionSet: IMAGE_OPTION_SET
  baseImageName: string
  item: {
    _id: string
    name: string
  }
}): string | undefined => {
  const prefix = `${optionSet.label || ''}_${item.name}`
  const suffix = `_${item._id.split('-')[0]}`

  return removeImageNameFlags(baseImageName, sanitizeFileName(prefix), suffix)
}

/**
 * Removes prefix and suffix from a layer image name
 * @param args - Object containing layer, baseImageName and image details
 * @returns Clean image name string without prefix and suffix
 */
export const getImageNameOfLayerWithoutFlag = ({
  layer,
  baseImageName,
  image,
}: {
  layer: {
    label?: string
    legacyName?: string
  }
  baseImageName: string
  image: {
    _id: string
  }
}): string | undefined => {
  const prefix = `${layer.label || layer.legacyName || ''}`
  const suffix = `_${image._id.split('-')[0]}`

  return removeImageNameFlags(baseImageName, sanitizeFileName(prefix), suffix)
}

/**
 * Generates a flag image name for an option set image
 * @param args - Object containing option set, base image name, and item
 * @returns Formatted image name string
 */
export const getFlagImageNameOfOptionSetImage = ({
  optionSet,
  baseImageName,
  item,
}: {
  optionSet: IMAGE_OPTION_SET
  baseImageName: string
  item: {
    _id: string
    name: string
  }
}): string | undefined => {
  return getFlagImageNameOfImageUpload({
    baseImageName,
    prefix: sanitizeFileName(`${optionSet.label || ''}_${item.name}`),
    suffix: item._id.split('-')[0],
  })
}

/**
 * Generates a flag image name for a layer image
 * @param args - Object containing layer label, base image name, and image
 * @returns Formatted image name string
 */
export const getFlagImageNameOfLayerImage = ({
  layer,
  baseImageName,
  image,
}: {
  layer: {
    label?: string
    legacyName?: string
  }
  baseImageName: string
  image: {
    _id: string
  }
}) => {
  return getFlagImageNameOfImageUpload({
    baseImageName,
    prefix: sanitizeFileName(layer.label || layer.legacyName || ''),
    suffix: image._id.split('-')[0],
  })
}

/**
 * Creates a file upload object from image source
 * @param source - Image source URL
 * @returns File upload object or undefined
 */
const createFileUpload = (source: string): TFileToUpload | undefined => {
  const imageName = getFileNameFromUrl(source, true)
  if (!imageName) return

  return {
    originalSource: source,
    contentType: 'IMAGE',
    filename: imageName,
    alt: imageName,
  }
}

/**
 * Prepares option set images for upload
 * @param args - Object containing option set data
 * @returns Object with prepared images array
 */
export const prepareOptionSetImagesForUpload = ({
  optionSet,
}: {
  optionSet: IMAGE_OPTION_SET
}): { imagesOptionSetToUpload: TFileToUpload[] } => {
  const files = optionSet.data?.files || []
  const imagesOptionSetToUpload: TFileToUpload[] = []

  files.forEach((file: any, fileIdx) => {
    const { _id, src, dataSrc } = file
    const fileUpload = createFileUpload(src || dataSrc || '')
    if (!fileUpload) return

    imagesOptionSetToUpload.push({ ...fileUpload, _id })

    file._id = uuid()
    const updatedFile = {
      ...file,
      imageName: getFlagImageNameOfOptionSetImage({
        optionSet,
        item: file,
        baseImageName: fileUpload.filename,
      }),
    }

    if (optionSet.data) {
      optionSet.data.files[fileIdx] = updatedFile
    }
  })

  return { imagesOptionSetToUpload }
}

/**
 * Prepares layer images for upload
 * @param args - Object containing layer data
 * @returns Object with prepared images array
 */
export const prepareLayerImagesForUpload = ({
  layer,
}: {
  layer: LayerDocument
}): { imagesLayerToUpload: TFileToUpload[]; imageUpdated: typeof layer.image } => {
  const imagesLayerToUpload: TFileToUpload[] = []
  const { image } = layer
  const srcImage = image?.src || image?.dataSrc

  if (!srcImage || !image) return { imagesLayerToUpload, imageUpdated: image }

  const fileUpload = createFileUpload(srcImage)
  if (!fileUpload) return { imagesLayerToUpload, imageUpdated: image }

  imagesLayerToUpload.push({ ...fileUpload, _id: layer._id })

  image._id = uuid()
  const _image = {
    ...image,
    imageName: getFlagImageNameOfLayerImage({
      layer,
      image,
      baseImageName: fileUpload.filename,
    }),
  }

  return { imagesLayerToUpload, imageUpdated: _image }
}
