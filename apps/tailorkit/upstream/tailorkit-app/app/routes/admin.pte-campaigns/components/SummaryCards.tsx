import { Card, InlineGrid, BlockStack, Text, InlineStack, Tooltip, Icon } from '@shopify/polaris'
import { InfoIcon } from '@shopify/polaris-icons'

/**
 * Summary metrics cards for campaign overview
 * Displays KPIs: participation, products, activity, engagement
 *
 * @param totalParticipatingStores - Stores with at least 1 published product
 * @param totalPublishedProducts - Sum of all products published in campaign
 * @param avgProductsPerStore - Average products per participating store
 * @param startAt - Campaign start date
 * @param endAt - Campaign end date
 * @param totalActiveStores - Total stores active in system during campaign
 * @param participationRate - Percentage of active stores participating
 * @param activeCount - Stores with publishes in last 7 days
 * @param dormantCount - Participating stores with no recent activity
 */
interface SummaryCardsProps {
  totalParticipatingStores: number
  totalPublishedProducts: number
  avgProductsPerStore: string
  startAt: Date
  endAt: Date
  totalActiveStores: number
  participationRate: string
  activeCount: number
  dormantCount: number
}

export function SummaryCards({
  totalParticipatingStores,
  totalPublishedProducts,
  avgProductsPerStore,
  startAt,
  endAt,
  totalActiveStores,
  participationRate,
  activeCount,
  dormantCount,
}: SummaryCardsProps) {
  return (
    <InlineGrid columns={{ xs: 1, md: 6 }} gap="400">
      <Card>
        <BlockStack gap="200">
          <InlineStack gap="200" blockAlign="center">
            <Text variant="headingXs" tone="subdued" as="p">
              Participating Stores
            </Text>
            <Tooltip content="Total number of unique stores that published at least 1 product">
              <Icon source={InfoIcon} tone="subdued" />
            </Tooltip>
          </InlineStack>
          <Text variant="heading2xl" as="h2">
            {totalParticipatingStores}
          </Text>
        </BlockStack>
      </Card>
      <Card>
        <BlockStack gap="200">
          <InlineStack gap="200" blockAlign="center">
            <Text variant="headingXs" tone="subdued" as="p">
              Total Products
            </Text>
            <Tooltip content="Sum of all products that are currently live in stores right now (this number goes down when products are unpublished)">
              <Icon source={InfoIcon} tone="subdued" />
            </Tooltip>
          </InlineStack>
          <Text variant="heading2xl" as="h2">
            {totalPublishedProducts}
          </Text>
        </BlockStack>
      </Card>
      <Card>
        <BlockStack gap="200">
          <InlineStack gap="200" blockAlign="center">
            <Text variant="headingXs" tone="subdued" as="p">
              Avg Per Store
            </Text>
            <Tooltip content="Total Products ÷ Participating Stores (shows how many products each store publishes on average)">
              <Icon source={InfoIcon} tone="subdued" />
            </Tooltip>
          </InlineStack>
          <Text variant="heading2xl" as="h2">
            {avgProductsPerStore}
          </Text>
        </BlockStack>
      </Card>
      <Card>
        <BlockStack gap="200">
          <Text variant="headingXs" tone="subdued" as="p">
            Campaign Period
          </Text>
          <Text variant="bodyMd" as="p">
            {new Date(startAt).toLocaleDateString()} - {new Date(endAt).toLocaleDateString()}
          </Text>
        </BlockStack>
      </Card>
      <Card>
        <BlockStack gap="200">
          <InlineStack gap="200" blockAlign="center">
            <Text variant="headingXs" tone="subdued" as="p">
              Participation Rate
            </Text>
            <Tooltip content="What % of stores with recent orders actually joined this campaign (measures campaign reach effectiveness)">
              <Icon source={InfoIcon} tone="subdued" />
            </Tooltip>
          </InlineStack>
          <Text variant="heading2xl" as="h2">
            {participationRate}%
          </Text>
          <Text variant="bodySm" tone="subdued" as="p">
            {totalParticipatingStores} / {totalActiveStores} stores
          </Text>
        </BlockStack>
      </Card>
      <Card>
        <BlockStack gap="200">
          <InlineStack gap="200" blockAlign="center">
            <Text variant="headingXs" tone="subdued" as="p">
              Active Stores
            </Text>
            <Tooltip content="How many stores published something in the past week vs stores that went inactive (7+ days since last publish)">
              <Icon source={InfoIcon} tone="subdued" />
            </Tooltip>
          </InlineStack>
          <Text variant="heading2xl" as="h2">
            {activeCount}
          </Text>
          <Text variant="bodySm" tone="subdued" as="p">
            {dormantCount} dormant (7+ days)
          </Text>
        </BlockStack>
      </Card>
    </InlineGrid>
  )
}
