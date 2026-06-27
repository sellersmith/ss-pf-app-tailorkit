import { Button, InlineStack } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { Fragment } from 'react/jsx-runtime'
import { FULFILLMENT_PROVIDERS, type EPROVIDER } from '~/constants/fulfillment-providers'
import { FulfillmentOrderRequestStatus } from '~/models/Order.d'

interface IOrderFulfillActionsProps {
  vendor: EPROVIDER
  orderId: number
  fulfillmentOrder: any
  fulfillmentOrderId?: string
  shopId?: string
  requestingFulfillment: boolean
  onRequestFulfillment: (orderId: number, vendor: string) => Promise<void>
  openOrderDetail: () => void
  onOpenFulfillmentOrder: (fulfillmentOrderId: string, shopId: string, vendor: EPROVIDER) => Promise<void>
}

export function OrderFulfillActions(props: IOrderFulfillActionsProps) {
  const {
    vendor,
    orderId,
    fulfillmentOrder,
    fulfillmentOrderId,
    shopId,
    requestingFulfillment,
    onRequestFulfillment,
    onOpenFulfillmentOrder,
  } = props

  const { t } = useTranslation()

  const { requestStatus } = fulfillmentOrder

  // Check if the order can request fulfillment
  const inProgressOrder = requestStatus === FulfillmentOrderRequestStatus.SUBMITTED
  const acceptedOrder = requestStatus === FulfillmentOrderRequestStatus.ACCEPTED
  const submittedOrder = fulfillmentOrder && fulfillmentOrderId

  // Check if the order has been sent to production
  const sentOrderToProduction = acceptedOrder && submittedOrder && shopId
  const canRequestFulfill = !inProgressOrder && !sentOrderToProduction

  return (
    <InlineStack align="end">
      {FULFILLMENT_PROVIDERS.includes(vendor) ? (
        sentOrderToProduction ? (
          <Fragment>
            <Button
              onClick={() => {
                onOpenFulfillmentOrder(fulfillmentOrderId, shopId, vendor)
              }}
            >
              {t('view-fulfillment-order', { vendor })}
            </Button>
          </Fragment>
        ) : (
          canRequestFulfill && (
            <Button
              variant="primary"
              loading={requestingFulfillment}
              onClick={() => onRequestFulfillment(orderId, vendor)}
            >
              {t('request-fulfillment')}
            </Button>
          )
        )
      ) : null}
    </InlineStack>
  )
}
