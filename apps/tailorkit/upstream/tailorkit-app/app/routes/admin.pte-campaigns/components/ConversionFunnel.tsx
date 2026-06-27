import { Card, BlockStack, Text, InlineStack, ProgressBar, Tooltip, Icon } from '@shopify/polaris'
import { InfoIcon } from '@shopify/polaris-icons'
import { PTE_BADGE_THRESHOLDS } from '~/bootstrap/constants/achievements'
import { useTranslation } from 'react-i18next'

/**
 * Displays a conversion funnel showing progression through PTE badge tiers
 *
 * @param totalParticipating - Total stores that published at least 1 product in campaign
 * @param noBadge - Stores with 1-2 products (below Creator threshold)
 * @param creatorOnly - Stores with Creator badge only (3-4 products)
 * @param artisanOnly - Stores with Artisan badge only (5-6 products)
 * @param master - Stores with Master badge (7+ products)
 */
interface ConversionFunnelProps {
  totalParticipating: number
  noBadge: number
  creatorOnly: number
  artisanOnly: number
  master: number
}

export function ConversionFunnel({
  totalParticipating,
  noBadge,
  creatorOnly,
  artisanOnly,
  master,
}: ConversionFunnelProps) {
  const { t } = useTranslation()

  const creatorTotal = creatorOnly + artisanOnly + master
  const artisanTotal = artisanOnly + master

  const creatorRate = totalParticipating > 0 ? ((creatorTotal / totalParticipating) * 100).toFixed(1) : '0'
  const artisanRate = creatorTotal > 0 ? ((artisanTotal / creatorTotal) * 100).toFixed(1) : '0'
  const masterRate = artisanTotal > 0 ? ((master / artisanTotal) * 100).toFixed(1) : '0'

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack gap="200" blockAlign="center">
          <Text variant="headingMd" as="h3">
            {t('conversion-funnel')}
          </Text>
          <Tooltip content={t('conversion-funnel-tooltip')}>
            <Icon source={InfoIcon} tone="subdued" />
          </Tooltip>
        </InlineStack>

        {/* No Badge */}
        <BlockStack gap="200">
          <InlineStack align="space-between">
            <Text variant="bodyMd" as="p">
              No Badge (0-{PTE_BADGE_THRESHOLDS.CREATOR - 1} products)
            </Text>
            <Text variant="bodyMd" fontWeight="semibold" as="p">
              {noBadge} ({totalParticipating > 0 ? ((noBadge / totalParticipating) * 100).toFixed(1) : '0'}%)
            </Text>
          </InlineStack>
          <ProgressBar progress={totalParticipating > 0 ? (noBadge / totalParticipating) * 100 : 0} size="small" />
        </BlockStack>

        {/* Creator */}
        <BlockStack gap="200">
          <InlineStack align="space-between">
            <Text variant="bodyMd" as="p">
              Creator ({PTE_BADGE_THRESHOLDS.CREATOR}-{PTE_BADGE_THRESHOLDS.ARTISAN - 1} products)
            </Text>
            <Text variant="bodyMd" fontWeight="semibold" as="p">
              {creatorOnly} ({totalParticipating > 0 ? ((creatorOnly / totalParticipating) * 100).toFixed(1) : '0'}%)
            </Text>
          </InlineStack>
          <ProgressBar progress={totalParticipating > 0 ? (creatorOnly / totalParticipating) * 100 : 0} size="small" />
        </BlockStack>

        {/* Artisan */}
        <BlockStack gap="200">
          <InlineStack align="space-between">
            <Text variant="bodyMd" as="p">
              Artisan ({PTE_BADGE_THRESHOLDS.ARTISAN}-{PTE_BADGE_THRESHOLDS.MASTER - 1} products)
            </Text>
            <Text variant="bodyMd" fontWeight="semibold" as="p">
              {artisanOnly} ({totalParticipating > 0 ? ((artisanOnly / totalParticipating) * 100).toFixed(1) : '0'}%)
            </Text>
          </InlineStack>
          <ProgressBar progress={totalParticipating > 0 ? (artisanOnly / totalParticipating) * 100 : 0} size="small" />
        </BlockStack>

        {/* Master */}
        <BlockStack gap="200">
          <InlineStack align="space-between">
            <Text variant="bodyMd" as="p">
              Master ({PTE_BADGE_THRESHOLDS.MASTER}+ products)
            </Text>
            <Text variant="bodyMd" fontWeight="semibold" as="p">
              {master} ({totalParticipating > 0 ? ((master / totalParticipating) * 100).toFixed(1) : '0'}%)
            </Text>
          </InlineStack>
          <ProgressBar
            progress={totalParticipating > 0 ? (master / totalParticipating) * 100 : 0}
            tone="success"
            size="small"
          />
        </BlockStack>

        {/* Conversion Rates */}
        <BlockStack gap="100">
          <Text variant="headingSm" as="h4">
            Conversion Rates
          </Text>
          <Text variant="bodySm" tone="subdued" as="p">
            Participating → Creator: {creatorRate}%
          </Text>
          <Text variant="bodySm" tone="subdued" as="p">
            Creator → Artisan: {artisanRate}%
          </Text>
          <Text variant="bodySm" tone="subdued" as="p">
            Artisan → Master: {masterRate}%
          </Text>
        </BlockStack>
      </BlockStack>
    </Card>
  )
}
