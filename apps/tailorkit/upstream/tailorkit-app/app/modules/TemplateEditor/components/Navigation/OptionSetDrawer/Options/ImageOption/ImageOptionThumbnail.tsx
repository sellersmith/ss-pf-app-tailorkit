import { Box, Icon, InlineStack, Thumbnail, Tooltip } from '@shopify/polaris'
import { InfoIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import BlockLoading from '~/components/loading/BlockLoading'
import { useStore } from '~/libs/external-store'
import { ImageOptionUploadingStore } from '~/stores/loading/image-option-uploading'
import { getShopifyThumbnail } from '~/utils/loadImage'
import { useImageWithOverlay, type OverlayData } from '~/hooks/useImageWithOverlay'
import type { ImageOptionOverlay } from '~/models/OptionSet.d'

interface IImageOptionThumbnailProps {
  id: string
  name: string
  src: string | null
  overlay?: ImageOptionOverlay
  compositedThumbnailSrc?: string // Pre-composited thumbnail from Shopify CDN
  hasCustomTransform?: boolean // Whether this option has been edited with custom transforms
}

export default function ImageOptionThumbnail(props: IImageOptionThumbnailProps) {
  const { id, src, name, overlay, compositedThumbnailSrc, hasCustomTransform } = props
  const { t } = useTranslation()

  const imageUploading = useStore(ImageOptionUploadingStore, state => state.imageUploading)

  // Convert ImageOptionOverlay to OverlayData only when overlaySvg exists
  const overlayData: OverlayData | null = overlay?.overlaySvg
    ? { overlaySvg: overlay.overlaySvg, overlayMetadata: overlay.overlayMetadata }
    : null

  // Skip client-side compositing if we have a pre-composited thumbnail from CDN
  const { imageUrl: compositedUrl, isCompositing } = useImageWithOverlay({
    imageUrl: src || undefined,
    overlay: overlayData,
    enabled: !!overlayData && !compositedThumbnailSrc,
  })

  // Priority: 1) CDN composited, 2) client-side composited, 3) original
  const thumbnailSource = compositedThumbnailSrc || compositedUrl || getShopifyThumbnail(src)
  const isLoading = (id === imageUploading.id && imageUploading.loading) || isCompositing

  const imageThumbnail = (
    <InlineStack align="center" blockAlign="center">
      <div>
        {isLoading ? (
          <BlockLoading size="small" paddingBlockEnd={0} paddingBlockStart={0} />
        ) : (
          <Box paddingBlock={'100'}>
            <Thumbnail source={thumbnailSource} alt={name} size="extraSmall" />
          </Box>
        )}
      </div>
    </InlineStack>
  )

  return (
    <InlineStack align="center" blockAlign="center" gap={'200'}>
      <Box position="relative">
        <div className="image-option_dropzone">{imageThumbnail}</div>
        {hasCustomTransform && (
          <div style={{ position: 'absolute', top: 0, right: -8 }}>
            <Tooltip content={t('this-option-has-custom-size-position')}>
              <Icon source={InfoIcon} tone="info" />
            </Tooltip>
          </div>
        )}
      </Box>
    </InlineStack>
  )
}
