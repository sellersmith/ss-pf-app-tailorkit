import { Fragment, memo } from 'react'
import getFilenameAndTypeFromShopifyCDN from '../utilities/getFilenameAndTypeFromShopifyCDN'
import { type IImageQuery } from '~/types/shopify-files'
import { BlockStack, Box, Text, Tooltip } from '@shopify/polaris'
import { ThumbnailButton } from './ThumbnailButton'
import { ALLOWED_IMAGE_EXTENSIONS } from '~/constants/dropzone'

export const MediaItem = memo(function MediaItem(props: {
  id?: string
  style?: any
  tooltip?: string
  media: IImageQuery
  selected?: boolean
  showFilenameInTooltip?: boolean
  showFilename?: boolean
  thumbnailFullWidth?: boolean
  customImageWidth?: number
  showFilenameFromAlt?: boolean
  customImageType?: string
  showCheckbox?: boolean
  preloadOriginalOnHover?: boolean
  preloadDelay?: number
  setImageSelected: (newCheck: boolean, image: IImageQuery) => void
}) {
  const {
    id,
    media,
    style,
    tooltip,
    selected,
    setImageSelected,
    showFilenameInTooltip,
    showFilename,
    thumbnailFullWidth,
    customImageWidth,
    showFilenameFromAlt,
    customImageType,
    showCheckbox,
    preloadOriginalOnHover,
    preloadDelay,
  } = props

  if (!media?.image?.originalSrc) {
    return null
  }

  const { filename, type } = getFilenameAndTypeFromShopifyCDN(media.image.originalSrc)
  const displayName = showFilenameFromAlt && media.alt ? media.alt : filename

  return (
    <div style={{ ...style, borderRadius: '10px' }} {...(id ? { id } : {})}>
      <BlockStack align="center" gap={'100'} key={media.id}>
        <ThumbnailButton
          media={media}
          selected={selected}
          tooltip={tooltip}
          fullWidth={thumbnailFullWidth}
          customImageWidth={customImageWidth}
          showCheckbox={showCheckbox}
          preloadOriginalOnHover={preloadOriginalOnHover}
          preloadDelay={preloadDelay}
          setImageSelected={setImageSelected}
        />

        <BlockStack inlineAlign="center" align="center">
          {showFilename && (
            <MediaTitle
              media={media}
              filename={displayName}
              showFilenameInTooltip={showFilenameInTooltip}
              customImageWidth={customImageWidth}
            />
          )}
          {(customImageType || ALLOWED_IMAGE_EXTENSIONS.includes(type)) && (
            <MediaType media={media} type={customImageType || type} />
          )}
        </BlockStack>
      </BlockStack>
    </div>
  )
})

function MediaTitle(props: {
  filename: string
  showFilenameInTooltip?: boolean
  customImageWidth?: number
  media: IImageQuery & { isUploading?: boolean }
}) {
  const { media, filename, showFilenameInTooltip = true, customImageWidth = 0 } = props

  const Wrapper = showFilenameInTooltip ? Tooltip : Fragment

  return (
    <Box width={`${(customImageWidth || 90) + 10}px`}>
      {/* @ts-ignore */}
      <Wrapper {...(showFilenameInTooltip ? { content: media.isUploading ? media.alt : filename } : {})}>
        <Text as="p" variant="bodySm" truncate alignment="center">
          {media.isUploading ? media.alt : filename}
        </Text>
      </Wrapper>
    </Box>
  )
}

function MediaType(props: { media: IImageQuery & { isUploading?: boolean; type?: string }; type: string }) {
  const { media, type } = props
  return (
    <Text as="p" variant="bodySm" truncate>
      {media.isUploading ? media.type : media.customImageType || type.toUpperCase()}
    </Text>
  )
}
