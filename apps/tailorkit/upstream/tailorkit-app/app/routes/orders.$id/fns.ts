import type { BadgeProps } from '@shopify/polaris'

/**
 * Get fulfillment status for the fulfillment order
 *
 * @param fulfillmentOrder
 * @returns
 */
export const getFulfillmentStatus = (fulfillmentOrder: any) => {
  const { status, requestStatus } = fulfillmentOrder

  const fulfillmentStatus: { tone: BadgeProps['tone']; content: string } | null = (() => {
    if (status === 'OPEN' && requestStatus === 'SUBMITTED') {
      return { tone: 'info', content: 'Requested' }
    }
    switch (requestStatus) {
      case 'REJECTED':
        return { tone: 'attention', content: 'Rejected' }
      case 'ACCEPTED':
        return { tone: 'info', content: 'Accepted' }
      default:
        return null
    }
  })()

  return fulfillmentStatus
}
