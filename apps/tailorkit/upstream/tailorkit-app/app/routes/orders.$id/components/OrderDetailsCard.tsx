import { BlockStack, Box } from '@shopify/polaris'
import type { Dispatch, SetStateAction } from 'react'
import { useCallback, useMemo } from 'react'
import { EPROVIDER } from '~/constants/fulfillment-providers'
import {
  getStatusFulfillmentOrder,
  mergeFulfillmentOrderLineItemsIntoOrderLineItems,
  openFulfillmentProvider,
} from '../fns.client'
import OrderDetailCard from './OrderDetailCard'
import { DisplayFulfillmentStatus } from '~/models/Order.d'
import { getEnumKeyByValue } from '~/utils/typescript'
import { useRequestFulfillment } from '~/routes/orders._index/fns'

interface IOrderDetailsCardProps {
  line_items: any[]
  PROPERTY_PREFIX: string
  order: any
  shopData: any
  openOrderDetail: () => void
  fulfillProgress: any
  setFulfillProgress: Dispatch<
    SetStateAction<{
      id: string
      loading: boolean
      errorMessage: string
    }>
  >
}

export const OrderDetailsCard = (props: IOrderDetailsCardProps) => {
  const { PROPERTY_PREFIX, order, shopData, openOrderDetail } = props

  const { requestingFulfillment, onRequestFulfillment } = useRequestFulfillment()

  const onOpenFulfillmentOrder = useCallback(async (fulfillmentOrderId: string, shopId: string, vendor: EPROVIDER) => {
    openFulfillmentProvider(fulfillmentOrderId, shopId, vendor)
  }, [])

  // Set a backward function if print image is not available
  const openPreviewPrintImageModal = useCallback((id: string) => {
    const modal = document.getElementById(`tailorkit-modal-${id}`)

    if (modal) {
      // @ts-ignore
      return modal.show()
    }
  }, [])

  const { line_items: unfulfilledLineItems, fulfillmentOrders, externalFulfillmentOrders } = useMemo(
    () => mergeFulfillmentOrderLineItemsIntoOrderLineItems(order, order.fulfillmentOrders),
    [order]
  )

  // 1. Prioritize render the fulfillment order line items
  // 2. Render other line items in order
  //
  // PageFly app-platform: captured TailorKit orders carry no fulfillment orders (fulfillment is out of
  // scope for the migrated capture), so both fulfillment arrays are empty. Render the personalization
  // line items directly from the merge fallback so the detail screen shows print images + properties.
  // `OrderDetailCard`'s own `fulfillmentOrder ?` guards drop the fulfillment chrome when it's absent.
  const hasFulfillmentOrders = fulfillmentOrders.length > 0 || externalFulfillmentOrders.length > 0

  return (
    <Box>
      <BlockStack gap={'400'}>
        {!hasFulfillmentOrders && unfulfilledLineItems?.length ? (
          <OrderDetailCard
            shopData={shopData}
            vendor={'' as EPROVIDER}
            status={DisplayFulfillmentStatus.UNFULFILLED}
            order={order}
            line_items={unfulfilledLineItems}
            PROPERTY_PREFIX={PROPERTY_PREFIX}
            requestingFulfillment={requestingFulfillment}
            handle={unfulfilledLineItems[unfulfilledLineItems.length - 1]?.product?.handle}
            openPreviewPrintImageModal={openPreviewPrintImageModal}
            onRequestFulfillment={onRequestFulfillment}
            openOrderDetail={openOrderDetail}
            onOpenFulfillmentOrder={onOpenFulfillmentOrder}
          />
        ) : null}
        {fulfillmentOrders.map(fulfillmentOrder => {
          const { lineItems: line_items, status: _status, requestStatus } = fulfillmentOrder

          // Get last item
          const last_item = line_items[line_items.length - 1]

          // Get vendor
          const vendor = last_item.vendor
          const handle = last_item.product?.handle

          // Check if vendor is not included in EPROVIDER
          if (!Object.values(EPROVIDER).includes(vendor as EPROVIDER)) return null

          // Get fulfillment order id
          const fulfillmentOrderId = last_item.fulfillment_order_submitted?.orderId

          // Get fulfillment shop id
          const shopId = last_item.fulfillment_order_submitted?.shop_id

          let status = _status

          // Revaluate the status
          if (_status === 'OPEN' && requestStatus === 'SUBMITTED') {
            status = getEnumKeyByValue(DisplayFulfillmentStatus, DisplayFulfillmentStatus.IN_PROGRESS)
          }

          return (
            <OrderDetailCard
              key={fulfillmentOrder.id}
              shopData={shopData}
              shopId={shopId}
              vendor={vendor}
              status={status}
              order={order}
              fulfillmentOrder={fulfillmentOrder}
              line_items={line_items}
              fulfillmentOrderId={fulfillmentOrderId}
              PROPERTY_PREFIX={PROPERTY_PREFIX}
              requestingFulfillment={requestingFulfillment}
              handle={handle}
              openPreviewPrintImageModal={openPreviewPrintImageModal}
              onRequestFulfillment={onRequestFulfillment}
              openOrderDetail={openOrderDetail}
              onOpenFulfillmentOrder={onOpenFulfillmentOrder}
            />
          )
        })}
        {externalFulfillmentOrders.map(fulfillmentOrder => {
          const { lineItems: line_items } = fulfillmentOrder

          // Get last item
          const last_item = line_items[line_items.length - 1]

          // Get vendor
          const vendor = last_item.vendor
          const handle = last_item.product?.handle

          // Get status order of fulfillment
          const status = getStatusFulfillmentOrder(line_items)

          return (
            <OrderDetailCard
              key={vendor}
              shopData={shopData}
              vendor={vendor as EPROVIDER}
              status={status}
              order={order}
              line_items={line_items}
              PROPERTY_PREFIX={PROPERTY_PREFIX}
              requestingFulfillment={requestingFulfillment}
              handle={handle}
              openPreviewPrintImageModal={openPreviewPrintImageModal}
              onRequestFulfillment={onRequestFulfillment}
              openOrderDetail={openOrderDetail}
              onOpenFulfillmentOrder={onOpenFulfillmentOrder}
            />
          )
        })}
      </BlockStack>
    </Box>
  )
}
