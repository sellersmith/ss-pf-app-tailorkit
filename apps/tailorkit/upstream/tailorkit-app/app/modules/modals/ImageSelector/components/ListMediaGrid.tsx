import type { InlineGridProps } from '@shopify/polaris'
import { BlockStack, Box, InlineGrid } from '@shopify/polaris'
import { memo, useCallback, useMemo } from 'react'
import ImageLoadingSkeleton from '~/components/skeleton/ImageLoading'
import { type IImageQuery } from '~/types/shopify-files'
import { MediaItem } from './MediaItem'
import { useTranslation } from 'react-i18next'
import { showToast } from '~/utils/toastEvents'
import { TOAST } from '~/constants/toasts'

interface IListMediaGridProps {
  files: IImageQuery[]
  isLoading: boolean
  imagesSelected?: IImageQuery[] | null
  setImagesSelected: (image: IImageQuery[]) => void
  allowMultiple?: boolean
  /** Maximum number of images that can be selected. Only applies when allowMultiple is true */
  maxSelection?: number
  numberOfSkeletons?: number
  gridColumns?: InlineGridProps['columns']
  backgroundSkeletonLoading?: boolean
  showFilenameInTooltip?: boolean
  showFilename?: boolean
  thumbnailFullWidth?: boolean
  customImageWidth?: number
  showFilenameFromAlt?: boolean
  showCheckbox?: boolean
  onImageClick?: (image: IImageQuery) => void
  preloadOriginalOnHover?: boolean
  preloadDelay?: number
}

function ListMediaGrid(props: IListMediaGridProps) {
  const {
    files,
    isLoading,
    imagesSelected = [],
    setImagesSelected,
    allowMultiple,
    maxSelection,
    numberOfSkeletons = 20,
    showFilenameInTooltip = true,
    showFilename = true,
    backgroundSkeletonLoading = false,
    thumbnailFullWidth = false,
    gridColumns = { xs: 3, sm: 4, md: 5, lg: 5, xl: 5 },
    customImageWidth,
    showFilenameFromAlt,
    showCheckbox = true,
    onImageClick,
    preloadOriginalOnHover = false,
    preloadDelay = 150,
  } = props

  const mediaFiles = useMemo(() => (files?.length ? files.filter(file => !!file) : []), [files])
  const { t } = useTranslation()

  const onSelectImageHandler = useCallback(
    (newCheck: boolean, media: IImageQuery) => {
      // If direct click handler provided, use it instead of selection logic
      if (onImageClick) {
        onImageClick(media)
        return
      }

      // Otherwise use normal selection logic
      if (newCheck) {
        if (allowMultiple) {
          // Check maxSelection limit if provided
          const currentCount = imagesSelected?.length || 0
          if (maxSelection !== undefined && currentCount >= maxSelection) {
            // Already reached max selection limit, show toast and don't add more
            showToast(t(TOAST.COMMON.MAXIMUM_IMAGES_SELECTED, { count: maxSelection }), { duration: 1500 })
            return
          }
          const newImages = [...(imagesSelected || []), media]
          setImagesSelected(newImages)
        } else {
          setImagesSelected([media])
        }
      } else {
        const filteredImages = imagesSelected?.filter(
          selectedImage => selectedImage.image.originalSrc !== media.image.originalSrc
        )

        const newImages = filteredImages || []

        setImagesSelected(newImages)
      }
    },
    [onImageClick, allowMultiple, imagesSelected, maxSelection, setImagesSelected, t]
  )

  return (
    <InlineGrid columns={gridColumns} alignItems="start" gap={'200'}>
      {mediaFiles.map((media: IImageQuery) => {
        return (
          <MediaItem
            key={media.id}
            selected={
              !!imagesSelected?.find(selectedMedia => selectedMedia.image.originalSrc === media.image?.originalSrc)
            }
            media={media}
            showFilenameInTooltip={showFilenameInTooltip}
            showFilename={showFilename}
            thumbnailFullWidth={thumbnailFullWidth}
            customImageWidth={customImageWidth}
            showCheckbox={showCheckbox}
            preloadOriginalOnHover={preloadOriginalOnHover}
            preloadDelay={preloadDelay}
            setImageSelected={onSelectImageHandler}
            showFilenameFromAlt={showFilenameFromAlt}
            customImageType={media.customImageType}
            tooltip={t('click-to-add')}
          />
        )
      })}

      {isLoading ? (
        <ListMediaSkeleton
          backgroundSkeletonLoading={backgroundSkeletonLoading}
          numberOfSkeletons={numberOfSkeletons}
          thumbnailFullWidth={thumbnailFullWidth}
          customImageWidth={customImageWidth}
        />
      ) : null}
    </InlineGrid>
  )
}

const ListMediaSkeleton = memo(
  function ListMediaSkeleton({
    backgroundSkeletonLoading = false,
    thumbnailFullWidth = false,
    customImageWidth = 0,
    numberOfSkeletons = 20,
  }: {
    numberOfSkeletons?: number
    backgroundSkeletonLoading?: boolean
    thumbnailFullWidth?: boolean
    customImageWidth?: number
  }) {
    const _width = customImageWidth || 90

    return (
      <>
        {Array(numberOfSkeletons)
          .fill(null)
          .map((_, index) => {
            return (
              <Box key={index}>
                <BlockStack align="center" inlineAlign="center" gap={'100'}>
                  {backgroundSkeletonLoading ? (
                    <ImageLoadingSkeleton width={thumbnailFullWidth ? '100%' : `${_width}px`} height="120px" />
                  ) : (
                    <Box
                      width={thumbnailFullWidth ? '100%' : `${_width}px`}
                      minHeight={`${_width}px`}
                      background={'bg-surface-brand-active'}
                      borderRadius="200"
                    ></Box>
                  )}
                </BlockStack>
              </Box>
            )
          })}
      </>
    )
  },
  () => true
)

export default ListMediaGrid
