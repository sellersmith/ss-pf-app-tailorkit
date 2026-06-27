import { Badge, BlockStack, Card, IndexTable, Text } from '@shopify/polaris'
import type { AssetType } from '~/models/ClipartClickEvent'

interface RecentActivityEvent {
  assetId: string
  assetName?: string
  assetType: AssetType
  shopDomain: string
  shopEmail?: string
  shopOwner?: string
  clickedAt: Date | string
  context: string
}

interface RecentActivityTableProps {
  events: RecentActivityEvent[]
}

export function RecentActivityTable({ events }: RecentActivityTableProps) {
  return (
    <BlockStack gap="400">
      <Text variant="headingLg" as="h2">
        Recent Click Activity
      </Text>

      {events.length === 0 ? (
        <Card>
          <Text as="p">No recent activity</Text>
        </Card>
      ) : (
        <Card>
          <IndexTable
            resourceName={{ singular: 'event', plural: 'events' }}
            itemCount={events.length}
            selectedItemsCount={0}
            onSelectionChange={() => {}}
            headings={[
              { title: 'Time' },
              { title: 'Asset Name' },
              { title: 'Asset ID' },
              { title: 'Type' },
              { title: 'Shop' },
              { title: 'Email' },
              { title: 'Owner' },
              { title: 'Context' },
            ]}
          >
            {events.map((event, index) => (
              <IndexTable.Row id={`${event.assetId}-${index}`} key={`${event.assetId}-${index}`} position={index}>
                <IndexTable.Cell>
                  <Text variant="bodySm" as="span">
                    {new Date(event.clickedAt).toLocaleString()}
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  {event.assetName === 'Deleted' ? (
                    <Badge tone="warning">{event.assetName}</Badge>
                  ) : (
                    <Text variant="bodyMd" fontWeight="medium" as="span">
                      {event.assetName || '-'}
                    </Text>
                  )}
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text variant="bodySm" tone="subdued" as="span">
                    {event.assetId}
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Badge>{event.assetType}</Badge>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text variant="bodySm" as="span">
                    {event.shopDomain}
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text variant="bodySm" as="span">
                    {event.shopEmail || '-'}
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text variant="bodySm" as="span">
                    {event.shopOwner || '-'}
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Badge>{event.context}</Badge>
                </IndexTable.Cell>
              </IndexTable.Row>
            ))}
          </IndexTable>
        </Card>
      )}
    </BlockStack>
  )
}
