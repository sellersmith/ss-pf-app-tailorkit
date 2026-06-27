import { BlockStack, Button, InlineStack, Text, Thumbnail } from '@shopify/polaris'
import { XSmallIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import { getImageFileName } from '../../utils/imageUtils'

interface ImagePreviewProps {
  imageUrl: string
  altText?: string
  onClear: () => void
  width?: string
  height?: string
}

export function ImagePreview({ imageUrl, altText, onClear, width = '120px', height = '128px' }: ImagePreviewProps) {
  const { t } = useTranslation()

  return (
    <BlockStack gap={'200'}>
      <InlineStack align="space-between" blockAlign="center">
        <InlineStack gap="100">
          <Thumbnail source={imageUrl} alt={altText || ''} size="small" />
          <Text as="span" variant="bodySm" tone="subdued" truncate>
            {getImageFileName(imageUrl)}
          </Text>
        </InlineStack>
        <Button icon={XSmallIcon} variant="plain" onClick={onClear} accessibilityLabel={t('remove-image')} />
      </InlineStack>
    </BlockStack>
  )
}
