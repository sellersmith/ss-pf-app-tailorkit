import { BlockStack, Box, Button, InlineStack, Text } from '@shopify/polaris'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { FulfillmentOrderStatus as EFulfillmentOrderStatus, FulfillmentOrderRequestStatus } from '~/models/Order.d'
import { FulfillmentOrderStatusBadge } from '~/routes/orders.$id/components/OrderStateBadge'
import { groupCharmLineItems } from '~/utils/charm-line-item-grouping'
import { useRequestFulfillment } from '../fns'
import OrderLineItemPopoverCard from './OrderLineItemPopoverCard'

interface OrderDetailPopoverCardProps {
  orderId: number
  vendor: string
  fulfillment_order_status: EFulfillmentOrderStatus
  requestStatus: FulfillmentOrderRequestStatus
  line_items: any[]
  isInternalFulfillment?: boolean
  PROPERTY_PREFIX?: string
}

function FulfillmentLineItemsPopoverCard(props: OrderDetailPopoverCardProps) {
  const {
    orderId,
    vendor,
    fulfillment_order_status,
    requestStatus,
    line_items,
    isInternalFulfillment = true,
    PROPERTY_PREFIX,
  } = props
  const { t } = useTranslation()

  const { requestingFulfillment, onRequestFulfillment } = useRequestFulfillment()

  // Group charm items under their parent products
  const { groupedItems } = useMemo(
    () =>
      PROPERTY_PREFIX
        ? groupCharmLineItems(line_items, PROPERTY_PREFIX)
        : { groupedItems: line_items.map((item: any) => ({ item, charms: [] })) },
    [line_items, PROPERTY_PREFIX]
  )

  // Check if the order can request fulfillment
  const isFulfillmentOrderOpen = fulfillment_order_status === 'OPEN'
  const isUnsubmitted = requestStatus !== 'SUBMITTED'
  const canRequestFulfillment = isFulfillmentOrderOpen && isUnsubmitted && isInternalFulfillment

  return (
    <BlockStack>
      <Box paddingInline={'400'} paddingBlock={'200'} borderColor="border" borderBlockEndWidth="025">
        <InlineStack align="space-between">
          <Text as="p" fontWeight="semibold">
            {vendor}
          </Text>
          <Box>
            <FulfillmentOrderStatusBadge status={fulfillment_order_status} requestStatus={requestStatus} />
          </Box>
        </InlineStack>
      </Box>
      <BlockStack gap="200">
        {groupedItems.map(({ item, charms }: any) => {
          const { id } = item
          return <OrderLineItemPopoverCard key={id} line_item={item} charmCount={charms.length} />
        })}

        {canRequestFulfillment && (
          <Box paddingInline={'400'} paddingBlockEnd={'200'}>
            <InlineStack align="end">
              <Box>
                <Button
                  loading={requestingFulfillment}
                  variant="plain"
                  onClick={() => onRequestFulfillment(orderId, vendor)}
                >
                  {t('request-fulfillment')}
                </Button>
              </Box>
            </InlineStack>
          </Box>
        )}
      </BlockStack>
    </BlockStack>
  )
}

export default FulfillmentLineItemsPopoverCard
