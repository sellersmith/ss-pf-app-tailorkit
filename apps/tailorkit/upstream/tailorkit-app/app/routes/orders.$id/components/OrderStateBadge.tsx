import { Badge, type BadgeProps } from '@shopify/polaris'
import {
  DisplayFulfillmentStatus,
  type FulfillmentOrderStatus as EFulfillmentOrderStatus,
  type FulfillmentOrderRequestStatus,
} from '~/models/Order.d'
import {
  CANCELED,
  FULFILLED,
  FULFILLING,
  ON_HOLD,
  UNFULFILLED,
  type FulfillmentOrderStatus,
} from '~/constants/fulfillment-providers'
import { formatOrderStatus } from '~/routes/orders._index/fns'

function OrderStateBadge(props: BadgeProps & { status: FulfillmentOrderStatus | DisplayFulfillmentStatus | string }) {
  const status = props.status || 'unfulfilled'

  let tone: BadgeProps['tone'] = 'attention'
  let progress: BadgeProps['progress'] = 'incomplete'

  switch (status) {
    case UNFULFILLED: {
      break
    }

    case DisplayFulfillmentStatus.IN_PROGRESS:
    case FULFILLING: {
      tone = 'info'
      progress = 'partiallyComplete'
      break
    }

    case FULFILLED: {
      tone = 'success'
      progress = 'complete'
      break
    }

    case DisplayFulfillmentStatus.REQUEST_DECLINED: {
      tone = 'warning'
      progress = 'incomplete'
      break
    }

    case ON_HOLD: {
      tone = 'attention'
      progress = 'partiallyComplete'
      break
    }

    case CANCELED: {
      tone = 'critical-strong'
      progress = 'incomplete'
      break
    }
  }

  return (
    <Badge tone={tone} progress={progress}>
      {formatOrderStatus(status)}
    </Badge>
  )
}
export default OrderStateBadge

interface IFulfillmentOrderStatusBadgeProps {
  status: EFulfillmentOrderStatus
  requestStatus?: FulfillmentOrderRequestStatus
}

export function FulfillmentOrderStatusBadge(props: IFulfillmentOrderStatusBadgeProps) {
  const { status = 'OPEN', requestStatus } = props

  let tone: BadgeProps['tone'] = 'attention'
  let progress: BadgeProps['progress'] = 'incomplete'

  // Create display fulfillment order status
  let displayFulfillmentOrderStatus: string = status

  switch (status) {
    case 'OPEN': {
      if (requestStatus === 'UNSUBMITTED') {
        tone = 'attention'
        progress = 'incomplete'

        displayFulfillmentOrderStatus = 'Unfulfilled'
      }

      if (requestStatus === 'SUBMITTED') {
        displayFulfillmentOrderStatus = 'Fulfillment in progress'

        tone = 'info'
        progress = 'partiallyComplete'
      }

      if (requestStatus === 'REJECTED') {
        tone = 'warning'
        progress = 'incomplete'

        displayFulfillmentOrderStatus = 'Request declined'
      }

      break
    }
    case 'IN_PROGRESS':
    case 'SCHEDULED': {
      tone = 'info'
      progress = 'partiallyComplete'
      break
    }

    case 'CLOSED': {
      tone = 'success'
      progress = 'complete'
      displayFulfillmentOrderStatus = 'Fulfilled'

      break
    }
    case 'CANCELLED': {
      tone = 'critical-strong'
      progress = 'incomplete'
      break
    }

    case 'INCOMPLETE': {
      tone = 'attention'
      progress = 'partiallyComplete'
      break
    }
  }

  return (
    <Badge tone={tone} progress={progress}>
      {formatOrderStatus(displayFulfillmentOrderStatus)}
    </Badge>
  )
}
