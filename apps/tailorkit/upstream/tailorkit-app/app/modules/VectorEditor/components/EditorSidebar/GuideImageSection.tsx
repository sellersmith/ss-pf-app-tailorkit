/**
 * GuideImageSection - Sidebar panel for managing the reference/guide background image.
 * Shows an inline image browser (no modal) + canvas snapshot option.
 *
 * Layout: flex column that fills the sidebar. The image browser at the bottom
 * gets flex:1 so it stretches to fill remaining space — no double-scroll.
 */

import { BlockStack, Button, Divider, Text } from '@shopify/polaris'
import { ViewIcon, DeleteIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import type { GuideImageSectionProps } from './types'

export default function GuideImageSection({
  imageUrl,
  onCaptureCanvas,
  onRemoveImage,
  imageBrowser,
}: GuideImageSectionProps) {
  const { t } = useTranslation()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--p-space-400)', height: '100%', minHeight: 0 }}>
      <Text as="p" variant="bodySm" tone="subdued">
        {t('add-a-background-image-to-help-you-trace-the-path-accurately')}
      </Text>

      {imageUrl && (
        <BlockStack gap="200">
          <div
            style={{
              width: '100%',
              aspectRatio: '4/3',
              borderRadius: 'var(--p-border-radius-200)',
              overflow: 'hidden',
              border: '1px solid var(--p-color-border)',
            }}
          >
            <img
              src={imageUrl}
              alt={t('guide-image')}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
          <Button onClick={onRemoveImage} icon={DeleteIcon} fullWidth variant="tertiary" tone="critical">
            {t('remove-image')}
          </Button>
        </BlockStack>
      )}

      <Button onClick={onCaptureCanvas} icon={ViewIcon} fullWidth variant="secondary">
        {t('use-canvas-snapshot')}
      </Button>

      <Divider />

      {/* flex:1 + minHeight:0 = fills remaining sidebar height, image browser scrolls internally */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{imageBrowser}</div>
    </div>
  )
}
