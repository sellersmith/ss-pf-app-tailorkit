import { BlockStack, Card, EmptyState } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { ILLUSTRATORS } from '~/constants/assets-url'

export const EmptySelectedProducts = () => {
  const { t } = useTranslation()

  return (
    <BlockStack gap={'500'}>
      <Card roundedAbove="sm">
        <BlockStack align="center">
          <EmptyState heading={t('save-time-by-fulfilling-orders-automatically')} image={ILLUSTRATORS.EMPTY_TEMPLATE}>
            <BlockStack gap={'200'}>
              <p>{t('import-product-base-and-fulfill-orders-automatically')}</p>
            </BlockStack>
          </EmptyState>
        </BlockStack>
      </Card>
    </BlockStack>
  )
}
