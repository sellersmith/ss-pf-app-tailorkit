import { Checkbox, Spinner, Tooltip } from '@shopify/polaris'
import styles from './ThumbnailButton.style.module.css'
import { useCallback, useMemo, useRef, useState } from 'react'
import { Fragment } from 'react/jsx-runtime'
import { ELink } from '~/constants/enum'
import { type IImageQuery } from '~/types/shopify-files'
import { getShopifyThumbnail } from '~/utils/loadImage'

interface IThumbnailButton {
  tooltip?: string
  media: IImageQuery & { isUploading?: boolean }
  fullWidth?: boolean
  customImageWidth?: number
  setImageSelected?: (newCheck: boolean, image: IImageQuery) => void
  selected?: boolean
  showCheckbox?: boolean
  preloadOriginalOnHover?: boolean
  preloadDelay?: number
}

export function ThumbnailButton(props: IThumbnailButton) {
  const {
    media,
    selected,
    tooltip,
    setImageSelected,
    fullWidth,
    customImageWidth,
    showCheckbox = true,
    preloadOriginalOnHover = false,
    preloadDelay = 150,
  } = props
  const [imageError, setImageError] = useState(false)
  const preloadTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const preloadedRef = useRef(false)
  const Wrapper = useMemo(() => (tooltip ? Tooltip : Fragment), [tooltip])
  const image = media?.image?.originalSrc
  const thumbnailUrl = useMemo(
    () => getShopifyThumbnail(media.image.originalSrc, fullWidth ? 1024 : (customImageWidth || 80) * 2),
    [customImageWidth, fullWidth, media.image.originalSrc]
  )

  // Use customImageWidth if provided, otherwise use CSS default (90px)
  const containerStyle = customImageWidth
    ? {
        width: `${customImageWidth}px`,
        height: `${customImageWidth}px`,
      }
    : {}

  const handleImageError = useCallback(() => {
    setImageError(true)
  }, [])

  const handleMouseEnter = useCallback(() => {
    if (!preloadOriginalOnHover || preloadedRef.current || !image) return

    // Clear any existing timeout
    if (preloadTimeoutRef.current) {
      clearTimeout(preloadTimeoutRef.current)
    }

    // Set timeout to preload after delay
    preloadTimeoutRef.current = setTimeout(() => {
      if (!preloadedRef.current) {
        const img = new Image()
        img.src = image
        preloadedRef.current = true
      }
    }, preloadDelay)
  }, [preloadOriginalOnHover, image, preloadDelay])

  const handleMouseLeave = useCallback(() => {
    // Clear timeout if user leaves before delay completes
    if (preloadTimeoutRef.current) {
      clearTimeout(preloadTimeoutRef.current)
      preloadTimeoutRef.current = null
    }
  }, [])

  return (
    <div
      onClick={() => {
        if (media?.isUploading) return

        setImageSelected && setImageSelected(!selected, media)
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`${styles.ImageSelect} ${fullWidth ? styles.ImageSelectFullWidth : ''}`}
      style={containerStyle}
    >
      <div className={styles.ImageSelectWrapperImage} style={{ minHeight: fullWidth ? '80px' : 'auto' }}>
        {/* @ts-ignore */}
        <Wrapper {...(tooltip ? { content: tooltip || media.alt, hoverDelay: 500 } : {})}>
          <img
            src={imageError || !thumbnailUrl ? ELink.IMAGE_PREVIEW_PLACEHOLDER : thumbnailUrl}
            alt={media.alt}
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
              objectFit: 'contain',
              objectPosition: 'center center',
              borderRadius: '4px',
            }}
            onError={handleImageError}
          />
        </Wrapper>
      </div>

      {showCheckbox && (
        <Checkbox
          id={image}
          name="imgUrl"
          value={image}
          label={media.alt}
          labelHidden
          checked={selected}
          disabled={media?.isUploading}
          onChange={() => {}}
        />
      )}
      {media?.isUploading && (
        <div className="emtlkit-loading-media">
          <Spinner size="small" />
        </div>
      )}
    </div>
  )
}
