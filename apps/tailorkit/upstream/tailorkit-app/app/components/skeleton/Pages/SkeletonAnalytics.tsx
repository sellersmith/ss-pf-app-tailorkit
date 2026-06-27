import {
  SkeletonPage,
  BlockStack,
  InlineGrid,
  Card,
  SkeletonBodyText,
  SkeletonDisplayText,
  InlineStack,
  Box,
} from '@shopify/polaris'
import { useTranslation } from 'react-i18next'

/**
 * Skeleton for Analytics page
 * Replicates the chart grids (2-col line charts, 4-col bar charts)
 */
export function SkeletonAnalytics() {
  const { t } = useTranslation()

  return (
    <SkeletonPage title={t('analytics')} fullWidth>
      <BlockStack gap="400">
        {/* Date range picker skeleton */}
        <InlineStack gap="200">
          <Box width="93px">
            <SkeletonDisplayText size="small" />
          </Box>
          <Box width="219px">
            <SkeletonDisplayText size="small" />
          </Box>
        </InlineStack>

        {/* Line charts (2 columns) */}
        <InlineGrid columns={{ xs: 1, md: 'repeat(2, 1fr)' }} gap="500">
          {[1, 2].map(index => (
            <Card key={index}>
              <BlockStack gap="400">
                <SkeletonDisplayText size="small" />
                <SkeletonBodyText lines={6} />
              </BlockStack>
            </Card>
          ))}
        </InlineGrid>

        {/* Bar charts (4 columns) */}
        <InlineGrid columns={{ xs: 1, md: 'repeat(2, 1fr)', xl: 'repeat(4, 1fr)' }} gap="500">
          {[1, 2, 3, 4].map(index => (
            <Card key={index}>
              <BlockStack gap="400">
                <SkeletonDisplayText size="small" />
                <SkeletonBodyText lines={4} />
              </BlockStack>
            </Card>
          ))}
        </InlineGrid>
      </BlockStack>
    </SkeletonPage>
  )
}
