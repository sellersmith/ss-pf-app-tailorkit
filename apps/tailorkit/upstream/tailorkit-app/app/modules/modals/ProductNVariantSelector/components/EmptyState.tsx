import { BlockStack, Text } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { AlertCircleIcon60x60 } from '~/assets/icons'

export const EmptyState = () => {
  const { t } = useTranslation()

  return (
    <BlockStack align="center" inlineAlign="center" gap={'100'}>
      <span className="Polaris-Icon" style={{ width: '60px', height: '60px' }}>
        {AlertCircleIcon60x60}
      </span>
      <Text variant="bodyMd" as="p" tone="subdued">
        {t('your-store-doesn-t-have-any-products-yet')}
      </Text>
    </BlockStack>
  )
}
