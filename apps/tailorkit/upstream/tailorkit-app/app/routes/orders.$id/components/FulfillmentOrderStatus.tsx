import { Badge } from '@shopify/polaris'
import { Fragment } from 'react/jsx-runtime'
import { getFulfillmentStatus } from '../fns'

interface IFulfillmentOrderStatusProps {
  fulfillmentOrder: any
}

function FulfillmentOrderStatusComponent(props: IFulfillmentOrderStatusProps) {
  const { fulfillmentOrder } = props

  if (!fulfillmentOrder) {
    return null
  }

  const fulfillmentStatus = getFulfillmentStatus(fulfillmentOrder)

  if (!fulfillmentStatus?.content || !fulfillmentStatus?.tone) return <Fragment />

  return (
    <Badge tone={fulfillmentStatus.tone} size="small">
      {fulfillmentStatus.content}
    </Badge>
  )
}

export default FulfillmentOrderStatusComponent
