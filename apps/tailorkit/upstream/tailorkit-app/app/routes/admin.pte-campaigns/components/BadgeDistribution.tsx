import { Card, Badge, InlineGrid, BlockStack, Text, InlineStack, Tooltip, Icon } from '@shopify/polaris'
import { InfoIcon } from '@shopify/polaris-icons'

/**
 * Badge distribution chart showing count of stores at each badge level
 * Displays Creator, Artisan, and Master badge achievements
 *
 * @param creator - Stores with Creator badge (3+ products)
 * @param artisan - Stores with Artisan badge (5+ products)
 * @param master - Stores with Master badge (7+ products)
 */
interface BadgeDistributionProps {
  creator: number
  artisan: number
  master: number
}

export function BadgeDistribution({ creator, artisan, master }: BadgeDistributionProps) {
  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack gap="200" blockAlign="center">
          <Text variant="headingMd" as="h3">
            Badge Distribution
          </Text>
          <Tooltip content="Number of stores that achieved each badge level based on their highest published product count">
            <Icon source={InfoIcon} tone="subdued" />
          </Tooltip>
        </InlineStack>
        <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
          <BlockStack gap="200">
            <Badge tone="info" size="large">
              Creator (3+ products)
            </Badge>
            <Text variant="heading2xl" as="p">
              {creator}
            </Text>
          </BlockStack>
          <BlockStack gap="200">
            <Badge tone="warning" size="large">
              Artisan (5+ products)
            </Badge>
            <Text variant="heading2xl" as="p">
              {artisan}
            </Text>
          </BlockStack>
          <BlockStack gap="200">
            <Badge tone="success" size="large">
              Master (7+ products)
            </Badge>
            <Text variant="heading2xl" as="p">
              {master}
            </Text>
          </BlockStack>
        </InlineGrid>
      </BlockStack>
    </Card>
  )
}
