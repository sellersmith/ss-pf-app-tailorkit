import { Badge, BlockStack, Card, IndexTable, InlineStack, Text } from '@shopify/polaris'
import type { AssetType } from '~/models/ClipartClickEvent'

interface TopAsset {
  assetId: string
  assetName: string
  assetType: AssetType
  totalClicks: number
  uniqueShops: number
  clicksByContext: Array<{ context: string; count: number }>
}

interface TopAssetsTableProps {
  assets: TopAsset[]
}

export function TopAssetsTable({ assets }: TopAssetsTableProps) {
  return (
    <BlockStack gap="400">
      <Text variant="headingLg" as="h2">
        Top Clicked Assets
      </Text>

      {assets.length === 0 ? (
        <Card>
          <Text as="p">No data available</Text>
        </Card>
      ) : (
        <Card>
          <IndexTable
            resourceName={{ singular: 'asset', plural: 'assets' }}
            itemCount={assets.length}
            selectedItemsCount={0}
            onSelectionChange={() => {}}
            headings={[
              { title: 'Asset Name' },
              { title: 'Asset ID' },
              { title: 'Type' },
              { title: 'Total Clicks' },
              { title: 'Unique Shops' },
              { title: 'Top Contexts' },
            ]}
          >
            {assets.map((asset, index) => (
              <IndexTable.Row id={asset.assetId} key={asset.assetId} position={index}>
                <IndexTable.Cell>
                  {asset.assetName === 'Deleted' ? (
                    <Badge tone="warning">{asset.assetName}</Badge>
                  ) : (
                    <Text variant="bodyMd" fontWeight="medium" as="span">
                      {asset.assetName || '-'}
                    </Text>
                  )}
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text variant="bodySm" tone="subdued" as="span">
                    {asset.assetId}
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Badge>{asset.assetType}</Badge>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text variant="bodyMd" fontWeight="semibold" as="span">
                    {asset.totalClicks.toLocaleString()}
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>{asset.uniqueShops}</IndexTable.Cell>
                <IndexTable.Cell>
                  {asset.clicksByContext.length > 0 ? (
                    <InlineStack gap="100" wrap={false}>
                      {asset.clicksByContext.slice(0, 3).map(({ context, count }, idx) => (
                        <Badge key={`${context}-${idx}`}>{`${context}: ${count}`}</Badge>
                      ))}
                    </InlineStack>
                  ) : (
                    <Text variant="bodySm" tone="subdued" as="span">
                      No context data
                    </Text>
                  )}
                </IndexTable.Cell>
              </IndexTable.Row>
            ))}
          </IndexTable>
        </Card>
      )}
    </BlockStack>
  )
}
