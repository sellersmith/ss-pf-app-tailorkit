import { Badge, BlockStack, Card, InlineGrid, InlineStack, Text } from '@shopify/polaris'

interface AnalyticsOverviewProps {
  summary: {
    totalClicks: number
    totalAssets: number
    totalShops: number
    clicksByContext: Array<{ context: string; count: number }>
  }
}

export function AnalyticsOverview({ summary }: AnalyticsOverviewProps) {
  return (
    <BlockStack gap="400">
      <Text variant="headingLg" as="h2">
        Clipart Analytics Overview
      </Text>
      <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
        {[
          { title: 'Total Clicks', value: summary.totalClicks.toLocaleString() },
          { title: 'Total Assets', value: summary.totalAssets.toLocaleString() },
          { title: 'Total Shops', value: summary.totalShops.toLocaleString() },
          {
            title: 'Avg Clicks/Asset',
            value: summary.totalAssets > 0 ? Math.round(summary.totalClicks / summary.totalAssets).toLocaleString() : 0,
          },
        ].map(({ title, value }) => (
          <Card key={title}>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h3">
                {title}
              </Text>
              <Text variant="heading2xl" as="p">
                {value}
              </Text>
            </BlockStack>
          </Card>
        ))}
      </InlineGrid>
      <Card>
        <BlockStack gap="300">
          <Text variant="headingMd" as="h3">
            Clicks by Context
          </Text>
          {summary.clicksByContext.length === 0 ? (
            <Text variant="bodySm" as="p" tone="subdued">
              No context data available
            </Text>
          ) : (
            <BlockStack gap="200">
              {summary.clicksByContext.map(({ context, count }) => (
                <InlineStack key={context} align="space-between">
                  <Text variant="bodySm" as="span">
                    {context}
                  </Text>
                  <Badge>{count.toLocaleString()}</Badge>
                </InlineStack>
              ))}
            </BlockStack>
          )}
        </BlockStack>
      </Card>
    </BlockStack>
  )
}
