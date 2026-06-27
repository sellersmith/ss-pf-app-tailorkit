import { BlockStack, Card, InlineGrid, SkeletonBodyText, SkeletonDisplayText, SkeletonPage } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'

/**
 * Skeleton for Storefront Setup page
 * Replicates the 2-column grid layout with cards
 */
export function SkeletonStorefrontSetup() {
  const { t } = useTranslation()

  return (
    <SkeletonPage title={t('sale-tools')} fullWidth>
      <InlineGrid gap="400" columns={{ sm: 1, md: 2 }}>
        {[1, 2, 3, 4].map(index => (
          <Card key={index}>
            <BlockStack gap="400">
              <SkeletonDisplayText size="medium" />
              <SkeletonBodyText lines={3} />
            </BlockStack>
          </Card>
        ))}
      </InlineGrid>
    </SkeletonPage>
  )
}
