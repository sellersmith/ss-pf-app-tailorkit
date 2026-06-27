import { BlockStack, Box, Button, InlineStack } from '@shopify/polaris'
import { ExchangeIcon } from '@shopify/polaris-icons'

interface ReferenceImageSectionProps {
  url: string
  alt: string
  isBusy: boolean
  showReset: boolean
  resetLabel: string
  changeLabel: string
  onReset: () => void
  onChangeReferenceImage: () => void
}

/**
 * Reference image preview + controls (reset/change) for AI mockup generation.
 */
export function ReferenceImageSection(props: ReferenceImageSectionProps) {
  const { url, alt, isBusy, showReset, resetLabel, changeLabel, onReset, onChangeReferenceImage } = props

  return (
    <BlockStack gap="100">
      <InlineStack gap="200" blockAlign="center" wrap={false}>
        {showReset && (
          <Button variant="plain" size="micro" onClick={onReset} disabled={isBusy}>
            {resetLabel}
          </Button>
        )}
      </InlineStack>

      <InlineStack gap="200" blockAlign="center" wrap={false}>
        <img
          src={url}
          alt={alt}
          loading="lazy"
          style={{ width: '180px', height: '180px', objectFit: 'cover', borderRadius: '8px' }}
        />
      </InlineStack>

      <Box>
        <Button icon={ExchangeIcon} onClick={onChangeReferenceImage} variant="secondary" disabled={isBusy}>
          {changeLabel}
        </Button>
      </Box>
    </BlockStack>
  )
}
