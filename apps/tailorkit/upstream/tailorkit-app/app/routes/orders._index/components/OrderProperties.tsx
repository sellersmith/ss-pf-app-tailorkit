import { Box } from '@shopify/polaris'
import type { TFunction } from 'i18next'
import { Fragment, useEffect, useMemo, useState } from 'react'
import InlineLoading from '~/components/loading/InlineLoading'
import { mergeFulfillmentOrderLineItemsIntoOrderLineItems } from '~/routes/orders.$id/fns.client'
import { authenticatedFetch } from '~/shopify/fns.client'
import FulfillmentLineItemsPopoverCard from './OrderDetailPopoverCard'

export type OrderPropertiesProps = {
  t: TFunction
  order?: any
  shopData: any
  orderId: number
  lineItems?: any[]
  orderNumber: number
  PROPERTY_PREFIX: string
}

export default function OrderProperties(props: OrderPropertiesProps) {
  const { order, orderId, lineItems, PROPERTY_PREFIX } = props

  // Load print areas
  const [line_items, setItems] = useState<any[]>([])

  const { fulfillmentOrders, externalFulfillmentOrders } = useMemo(
    () => mergeFulfillmentOrderLineItemsIntoOrderLineItems({ ...order, line_items }, order.fulfillmentOrders),
    [order, line_items]
  )

  useEffect(() => {
    if (lineItems?.length) {
      setItems(lineItems)
    }

    if ((!order || !lineItems?.length) && orderId) {
      ;(async () => {
        const res = await authenticatedFetch(`/api/orders?filter__id=string__eq__${orderId}`, {
          preferCache: true,
        })

        if (!lineItems?.length) {
          setItems(res?.items?.[0]?.line_items)
        }
      })()
    }
  }, [lineItems, order, orderId])

  // Return loading if no line items
  if (!line_items.length) {
    return (
      <Box padding={'400'}>
        <InlineLoading />
      </Box>
    )
  }

  return (
    <Fragment>
      {fulfillmentOrders.map(fulfillmentOrder => {
        const { lineItems: line_items, status, requestStatus } = fulfillmentOrder

        // Get last item
        const last_item = line_items[line_items.length - 1]

        // Get vendor
        const vendor = last_item.vendor

        return (
          <FulfillmentLineItemsPopoverCard
            key={vendor}
            orderId={orderId}
            vendor={vendor}
            fulfillment_order_status={status}
            requestStatus={requestStatus}
            line_items={line_items}
            PROPERTY_PREFIX={PROPERTY_PREFIX}
          />
        )
      })}

      {externalFulfillmentOrders.map(fulfillmentOrder => {
        const { lineItems: line_items, status, requestStatus } = fulfillmentOrder

        // Get last item
        const last_item = line_items[line_items.length - 1]

        // Get vendor
        const vendor = last_item.vendor

        return (
          <FulfillmentLineItemsPopoverCard
            isInternalFulfillment={false}
            key={vendor}
            orderId={orderId}
            vendor={vendor}
            fulfillment_order_status={status}
            requestStatus={requestStatus}
            line_items={line_items}
            PROPERTY_PREFIX={PROPERTY_PREFIX}
          />
        )
      })}
    </Fragment>
  )
}
