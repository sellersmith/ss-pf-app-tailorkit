import { BlockStack, Card, IndexTable, Text } from '@shopify/polaris'

interface TopShop {
  shopDomain: string
  shopEmail?: string
  shopOwner?: string
  totalClicks: number
  totalAssets: number
}

interface TopShopsTableProps {
  shops: TopShop[]
}

export function TopShopsTable({ shops }: TopShopsTableProps) {
  return (
    <BlockStack gap="400">
      <Text variant="headingLg" as="h2">
        Top Shops by Activity
      </Text>

      {shops.length === 0 ? (
        <Card>
          <Text as="p">No data available</Text>
        </Card>
      ) : (
        <Card>
          <IndexTable
            resourceName={{ singular: 'shop', plural: 'shops' }}
            itemCount={shops.length}
            selectedItemsCount={0}
            onSelectionChange={() => {}}
            headings={[
              { title: 'Shop Domain' },
              { title: 'Email' },
              { title: 'Owner' },
              { title: 'Total Clicks' },
              { title: 'Total Assets Clicked' },
              { title: 'Avg Clicks/Asset' },
            ]}
          >
            {shops.map((shop, index) => (
              <IndexTable.Row id={shop.shopDomain} key={shop.shopDomain} position={index}>
                <IndexTable.Cell>
                  <Text variant="bodyMd" fontWeight="medium" as="span">
                    {shop.shopDomain}
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text variant="bodySm" as="span">
                    {shop.shopEmail || '-'}
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text variant="bodySm" as="span">
                    {shop.shopOwner || '-'}
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text variant="bodyMd" fontWeight="semibold" as="span">
                    {shop.totalClicks.toLocaleString()}
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>{shop.totalAssets}</IndexTable.Cell>
                <IndexTable.Cell>
                  {shop.totalAssets > 0 ? Math.round(shop.totalClicks / shop.totalAssets) : 0}
                </IndexTable.Cell>
              </IndexTable.Row>
            ))}
          </IndexTable>
        </Card>
      )}
    </BlockStack>
  )
}
