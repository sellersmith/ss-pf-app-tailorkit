import { Badge, BlockStack, Box, Card, InlineStack, Text } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import type { LineItem } from '~/models/Order.server'
import type { BulkGroupSummary } from '~/utils/bulk-line-item-grouping'

interface BulkOrderGroupBannerProps {
  groups: BulkGroupSummary[]
}

/**
 * LEGACY SUPPORT ONLY (kept after bulk-personalize-v2 revert on 2026-05-21).
 *
 * The bulk-personalize-v2 feature was live on master between 2026-05-19 08:57
 * UTC (PR #1307) and 2026-05-21 ~07:00 UTC (PR #1317 revert). Customer orders
 * placed during that 46-hour window may carry `_TLK_bulk_group` line-item
 * properties. This component renders a small grouping banner so merchants
 * can still recognize those legacy orders in the admin Order Detail UI.
 *
 * Renders nothing when no bulk groups are found, so it is a no-op for the
 * vast majority of post-revert orders. Delete once the 46h window orders
 * are all fulfilled.
 *
 * Banner shows a "Legacy bulk × N" badge so the merchant knows this is from
 * the temporary 46h v2 window and not an in-flight feature.
 */
export function BulkOrderGroupBanner({ groups }: BulkOrderGroupBannerProps) {
  const { t } = useTranslation()
  if (!groups?.length) return null

  return (
    <Box paddingBlockEnd="300">
      <BlockStack gap="200">
        {groups.map(group => {
          const firstItem = group.items[0] as LineItem | undefined
          const productTitle = firstItem?.title || t('product')
          const shortId = group.groupId.split('-')[0] || group.groupId
          return (
            <Card key={group.groupId}>
              <InlineStack align="space-between" blockAlign="center" wrap={false} gap="200">
                <BlockStack gap="100">
                  <InlineStack gap="200" blockAlign="center">
                    <Badge tone="info">{`Legacy bulk × ${group.total}`}</Badge>
                    <Text as="span" variant="headingSm">
                      {productTitle}
                    </Text>
                  </InlineStack>
                  <Text as="span" tone="subdued" variant="bodySm">
                    {t('customer-personalized-each-unit-individually-see-per-unit-details-below')}
                  </Text>
                </BlockStack>
                <Text as="span" tone="subdued" variant="bodySm">
                  {`#${shortId}`}
                </Text>
              </InlineStack>
            </Card>
          )
        })}
      </BlockStack>
    </Box>
  )
}

export default BulkOrderGroupBanner
