import { Button, Card, InlineStack, Text } from '@shopify/polaris'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useRootLoaderData } from '~/root'
import { navigateToShopifyAdmin } from '~/utils/shopify'

function PaymentHistory() {
  const { t } = useTranslation()
  const { PUBLIC_ENV: { APP_HANDLE } = {} } = useRootLoaderData() || {}

  const onNavigateToBillingSection = useCallback(() => {
    navigateToShopifyAdmin(`/settings/apps/app_installations/app/${APP_HANDLE}`)
  }, [APP_HANDLE])

  return (
    <Card>
      <InlineStack align="space-between" blockAlign="center">
        <Text as="h3" variant="headingSm">
          {t('payment-history')}
        </Text>

        <Button variant="plain" onClick={onNavigateToBillingSection}>
          {t('view-history')}
        </Button>
      </InlineStack>
    </Card>
  )
}

export default PaymentHistory
