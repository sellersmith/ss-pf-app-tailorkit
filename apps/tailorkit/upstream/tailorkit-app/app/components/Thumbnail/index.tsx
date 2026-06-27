import { Box } from '@shopify/polaris'
import { useId } from 'react'
import { MODAL_ID } from '~/constants/modal'

type ThumbnailSize = 'small' | 'medium' | 'large'

interface ThumbnailProps {
  src: string
  alt: string
  size?: ThumbnailSize | number
}

function ExpandableThumbnail(props: ThumbnailProps) {
  const { src, alt, size = 'medium' } = props
  const uniqueId = useId()
  const modalId = `${MODAL_ID.THUMBNAIL_PREVIEW_MODAL}-${uniqueId}`

  return (
    <>
      <Box position="relative">
        <s-thumbnail src={src} alt={alt} size={size} />
        <Box position="absolute" insetBlockStart="050" insetInlineEnd="050">
          <s-button commandFor={modalId} icon="maximize" accessibilityLabel="maximize thumbnail" variant="tertiary" />
        </Box>
      </Box>

      <s-modal id={modalId} variant="base" padding="none" heading={'Image view'}>
        <img src={src} alt={alt} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
      </s-modal>
    </>
  )
}

export default ExpandableThumbnail
