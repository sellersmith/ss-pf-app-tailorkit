import { useCallback, useEffect, useMemo, useState } from 'react'
import uniqBy from 'lodash/uniqBy'
import { useSearchParams } from '@remix-run/react'
import { ALLOWED_IMAGE_TYPES } from '~/constants/dropzone'
import { EMPTY_ARRAY } from '~/constants'
import { useUploadFiles } from '~/modules/TemplateEditor/hooks/useUploadFiles'
import { getMyShopifySubdomainName } from '~/shopify/fns'
import type { BaseImage } from '~/types/integration'
import type { ErrorFile } from '~/types/media'
import type { NodeImage } from '~/types/psd'
import type { IImageQuery } from '~/types/shopify-files'
import { TemplateEditorStore } from '~/stores/modules/template'
import { validateMediaFiles } from '~/utils/file-types/validate-media-file-size'
import { uuid } from '~/utils/uuid'
import { sleep } from '~/utils/sleep'
import { chunkArray } from '~/utils/chunkArray'
import { useDebounce } from '~/utils/hooks/useDebounce'
import { useFetchMediaList } from './useFetchMediaList'
import getFilenameAndTypeFromShopifyCDN from '../utilities/getFilenameAndTypeFromShopifyCDN'
import { TEMPLATE_EDITOR_TRANSMISSION_EVENTS } from '~/modules/TemplateEditor/constants'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { proxyImageUrlToFile } from '~/utils/file-types'

function isNodeImage(img: unknown): img is NodeImage {
  return typeof img === 'object' && img !== null && 'src' in img
}

interface UseImageSelectorProps {
  baseImage?: BaseImage[] | null
  onSelectImage: (images: IImageQuery[] | null) => void
  onClose: (metaData?: any) => void
}

export function useImageSelector({ baseImage, onSelectImage, onClose }: UseImageSelectorProps) {
  const [searchParams] = useSearchParams()
  const shopDomain = searchParams.get('shop')
  const subDomain = getMyShopifySubdomainName(shopDomain || '')

  // Search state
  const [textFieldValue, setTextFieldValue] = useState<string>('')
  const deferredQuery = useDebounce(textFieldValue, 150)

  // Upload state
  const [imagesProcessing, setImagesProcessing] = useState(false)
  const [filesUploading, setFilesUploading] = useState<any[]>(EMPTY_ARRAY)
  const [filesUploaded, setFilesUploaded] = useState<any[]>(EMPTY_ARRAY)

  // Selection state
  const baseImageFormatted = useMemo(() => {
    return baseImage
      ? baseImage.map(image => {
          const { altText = '', url = '', width = 0, height = 0 } = image
          return {
            altText,
            image: {
              originalSrc: url,
              width: width,
              height: height,
            },
          }
        })
      : EMPTY_ARRAY
  }, [baseImage])

  const [imagesSelected, setImagesSelected] = useState<any[]>(baseImageFormatted)

  // Error state
  const [rejectedFiles, setRejectedFiles] = useState<ErrorFile[]>(EMPTY_ARRAY)
  const [errorMessage, setErrorMessage] = useState<string>('')

  // Fetch media
  const { mediaList, isFetching, fetchNextPage, handleFetchMoreMedia } = useFetchMediaList({
    textFieldValue: deferredQuery,
  })

  const { uploadFiles } = useUploadFiles()

  // Computed values
  const validMediaFiles = ALLOWED_IMAGE_TYPES.join(', ')
  const hasError = rejectedFiles.length > 0

  const _mediaList = useMemo(() => {
    if (deferredQuery) return mediaList

    const combined = [
      ...filesUploading.filter(file => !file.isCanceled),
      ...filesUploaded.filter(file => !file.isCanceled),
      ...mediaList,
    ]

    // Deduplicate items that appear both in filesUploaded and mediaList
    // Prefer id when available, otherwise fall back to originalSrc
    return uniqBy(combined, (item: IImageQuery) => item?.id || item?.image?.originalSrc)
  }, [filesUploading, filesUploaded, mediaList, deferredQuery])

  // Handlers
  const onSelect = useCallback(() => {
    const _imagesSelected = imagesSelected.map(media => {
      const alt = media.alt || getFilenameAndTypeFromShopifyCDN(media?.image?.originalSrc).filename
      return {
        ...media,
        alt,
      }
    })
    onSelectImage && onSelectImage(_imagesSelected)
    onClose({ closeViaSelect: true })
  }, [imagesSelected, onSelectImage, onClose])

  const onDropHandler = useCallback(
    async (_: File[], _acceptedFiles: File[], _rejectedFiles: File[]) => {
      try {
        setRejectedFiles([])
        setErrorMessage('')

        if (_rejectedFiles.length) {
          setRejectedFiles(
            _rejectedFiles.map(file => ({
              ...file,
              error: `"${file.name}" is not supported. File type must be ${validMediaFiles}.`,
            }))
          )
          return
        }

        const _files: File[] = []
        const _filesUploading: Array<{
          alt: string
          id: string
          image: { originalSrc: string; width: number; height: number }
          isUploading: boolean
        }> = []

        setImagesProcessing(true)

        const { acceptedFiles: acceptedMediaFiles, rejectedFiles } = await validateMediaFiles(_acceptedFiles)

        setImagesProcessing(false)
        await sleep(50)

        if (rejectedFiles.length > 0) {
          setRejectedFiles(rejectedFiles)
          return
        }

        for (const acceptedMediaFile of acceptedMediaFiles) {
          const { file, blobFile, width, height } = acceptedMediaFile
          const name = file.name
          const id = uuid()

          _files.push(file)

          const fileUploading = {
            alt: name,
            id,
            image: { originalSrc: blobFile, width, height },
            isUploading: true,
          }
          _filesUploading.push(fileUploading)
          setFilesUploading(prev => [...prev, fileUploading])

          await sleep(100)
        }

        const chunkSize = 5
        const chunkFiles = chunkArray(_files, chunkSize)

        type UploadedFile = {
          id: string
          alt: string
          image: { originalSrc: string; width: number; height: number }
          isUploading: boolean
        }

        const filesUploaded = await chunkFiles.reduce<Promise<UploadedFile[]>>(async (accPromise, files) => {
          const acc = await accPromise
          const results = (await uploadFiles(files)) || []

          return [
            ...acc,
            ...results.flatMap(result => {
              const uploadedFiles = result.data.uploadedFiles
              return uploadedFiles.map((uploadedFile: any) => {
                const { originalSrc, width, height } = uploadedFile.image
                return {
                  id: uploadedFile.id,
                  alt: uploadedFile.alt,
                  image: { originalSrc, width, height },
                  isUploading: false,
                }
              })
            }),
          ]
        }, Promise.resolve([]))

        // Update any canvas layer stores that reference blob URLs before revoking.
        // This handles the case where a user clicked an uploading image to add it
        // to the canvas — the layer store holds the blob URL which must be replaced
        // with the permanent CDN URL to survive canvas remounts (preview→design).
        try {
          const layerStores = TemplateEditorStore.getState().extractedLayerStores || []

          // Build a Map of blob URL → layer store for O(1) lookups.
          const storesByBlobUrl = new Map<string, (typeof layerStores)[number]>()
          for (const store of layerStores) {
            const img = store.getState().image
            if (!img) continue
            const src = typeof img === 'string' ? img : isNodeImage(img) ? img.src : undefined
            if (src?.startsWith('blob:')) {
              storesByBlobUrl.set(src, store)
            }
          }

          // Match uploading→uploaded by filename (alt) + dimensions for robustness.
          // IDs differ (local uuid vs Shopify gid://), so ID-based matching isn't possible.
          _filesUploading.forEach(uploadingFile => {
            const blobUrl = uploadingFile.image.originalSrc
            const uploadedFile = filesUploaded.find(
              f =>
                f.alt === uploadingFile.alt
                && f.image.width === uploadingFile.image.width
                && f.image.height === uploadingFile.image.height
            )
            if (!uploadedFile) return

            const cdnUrl = uploadedFile.image.originalSrc
            const affectedStore = storesByBlobUrl.get(blobUrl)

            if (affectedStore) {
              const currentImage = affectedStore.getState().image
              const imagePayload
                = typeof currentImage === 'string'
                  ? cdnUrl
                  : isNodeImage(currentImage)
                    ? { ...currentImage, src: cdnUrl }
                    : cdnUrl
              affectedStore.dispatch({
                type: 'UPDATE_LAYER',
                payload: { state: { image: imagePayload } },
              })
            }
          })
        } catch (error) {
          // Best-effort update — log but don't block upload flow
          console.warn('Failed to migrate blob→CDN URL in layer store:', error)
        }

        _filesUploading.forEach(file => {
          URL.revokeObjectURL(file.image.originalSrc)
        })

        setFilesUploading([])
        setFilesUploaded(prev => [...filesUploaded, ...prev])
      } catch (e) {
        console.error('Failed to upload images with error', e)
        setErrorMessage('Failed to upload files')
        setImagesProcessing(false)
      }
    },
    [uploadFiles, validMediaFiles]
  )

  // Listen for AI Chat image drag events
  useEffect(() => {
    ;(async () => {
      Transmitter.listen(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.IMAGE_DRAG_START, async (event: any) => {
        const eventData = event.data
        if (eventData.source) {
          const { source } = eventData
          if (!source) return

          const file = await proxyImageUrlToFile(source, 'image-generation')
          if (file) {
            await onDropHandler([file], [file], [])
          }
        }
      })
    })()
  }, [onDropHandler])

  return {
    // State
    textFieldValue,
    imagesProcessing,
    imagesSelected,
    rejectedFiles,
    errorMessage,
    mediaList: _mediaList,
    isFetching,
    fetchNextPage,
    deferredQuery,

    // Computed
    hasError,
    validMediaFiles,
    subDomain,

    // Handlers
    setTextFieldValue,
    setImagesSelected,
    onSelect,
    onDropHandler,
    handleFetchMoreMedia,
  }
}
