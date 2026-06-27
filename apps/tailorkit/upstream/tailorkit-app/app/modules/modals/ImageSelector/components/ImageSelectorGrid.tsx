import { Box } from '@shopify/polaris'
import type { InlineGridProps } from '@shopify/polaris'
import type { IImageQuery } from '~/types/shopify-files'
import EmptySearchMarkup from './EmptySearchMarkup'
import ListMediaGrid from './ListMediaGrid'
import BlockLoading from '~/components/loading/BlockLoading'

interface ImageSelectorGridProps {
  files: IImageQuery[]
  isLoading: boolean
  isFetching: boolean
  imagesSelected: IImageQuery[]
  onSelectImages: (images: IImageQuery[]) => void
  allowMultiple?: boolean
  /** Maximum number of images that can be selected. Only applies when allowMultiple is true */
  maxSelection?: number
  showEmpty?: boolean
  deferredQuery?: string
  gridColumns?: InlineGridProps['columns']
  withPadding?: boolean
  customImageWidth?: number
  showCheckbox?: boolean
  thumbnailFullWidth?: boolean
  preloadOriginalOnHover?: boolean
  preloadDelay?: number
  onImageClick?: (image: IImageQuery) => void
}

export default function ImageSelectorGrid({
  files,
  isLoading,
  isFetching,
  imagesSelected,
  onSelectImages,
  allowMultiple = false,
  maxSelection,
  showEmpty = false,
  deferredQuery = '',
  gridColumns,
  withPadding = true,
  customImageWidth,
  thumbnailFullWidth = false,
  showCheckbox = true,
  preloadOriginalOnHover = false,
  preloadDelay = 150,
  onImageClick,
}: ImageSelectorGridProps) {
  // Show empty state
  if (showEmpty && deferredQuery && !files.length && !isFetching) {
    return <EmptySearchMarkup resourceName={'image'} />
  }

  // Show grid
  const gridContent = files.length > 0 && (
    <ListMediaGrid
      isLoading={isLoading}
      files={files}
      imagesSelected={imagesSelected}
      setImagesSelected={onSelectImages}
      allowMultiple={allowMultiple}
      maxSelection={maxSelection}
      gridColumns={gridColumns}
      customImageWidth={customImageWidth}
      showCheckbox={showCheckbox}
      onImageClick={onImageClick}
      thumbnailFullWidth={thumbnailFullWidth}
      preloadOriginalOnHover={preloadOriginalOnHover}
      preloadDelay={preloadDelay}
    />
  )

  // Show loading
  const loadingContent = isFetching && <BlockLoading paddingBlockStart="400" paddingBlockEnd="400" />

  if (withPadding) {
    return (
      <Box padding={'400'}>
        {gridContent}
        {loadingContent}
      </Box>
    )
  }

  return (
    <>
      {gridContent}
      {loadingContent}
    </>
  )
}
