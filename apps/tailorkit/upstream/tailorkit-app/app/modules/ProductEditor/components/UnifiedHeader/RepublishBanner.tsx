import { Banner, Box, Card } from '@shopify/polaris'
import type { TFunction } from 'i18next'
import { memo } from 'react'

/**
 * RepublishWarningBanner - Warning banner when republish pending
 */
export const RepublishWarningBanner = memo(function RepublishWarningBanner(props: {
  visible: boolean
  onDismiss: () => void
  t: TFunction
}) {
  const { visible, onDismiss, t } = props
  if (!visible) return null
  return (
    <Box paddingBlockStart={'200'}>
      <Card padding="0">
        <Banner tone="warning" onDismiss={onDismiss}>
          <p>{t('template-updated-republish-to-show-on-storefront')}</p>
        </Banner>
      </Card>
    </Box>
  )
})
