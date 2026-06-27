import Subscription from '~/models/Subscription.server'
import { getBillingCycleDate } from '~/utils/getBillingCycleDate'

/**
 * Get subscription billing cycle
 * This function calculate the subscription price and current usage charge fee
 *
 * @param shopDomain string
 * @param activated_on string
 * @returns
 */
export async function getSubscriptionBillingCycle(shopDomain: string, activated_on: string) {
  const { from, to } = getBillingCycleDate(activated_on)

  try {
    // Perform the aggregation query on the Subscription collection
    const result = await Subscription.aggregate([
      {
        // Match subscriptions by shopDomain and activated dates
        $match: {
          shopDomain,
          from,
          to,
          status: 'active',
        },
      },
      {
        // Group by periodical billing cycle (monthly, annually, etc.)
        $group: {
          _id: '$periodical', // Group by periodical (monthly, annually, etc.)
          finalPrice: { $sum: '$finalPrice' }, // Sum up the finalPrice for each periodical
          shopDomain: { $first: '$shopDomain' },
          from: { $first: '$from' },
          to: { $first: '$to' },
        },
      },
    ])

    // Return the first result directly if present, or null if empty
    return result.length > 0 ? result[0] : null
  } catch (err) {
    console.error('Error in getting subscription billing cycle:', err)
    throw new Error('Unable to fetch subscription billing cycle data.')
  }
}

/**
 * Get billing subscription time
 *
 * @param shopifyCharge
 * @returns
 */
export function getBillingSubscriptionTime(shopifyCharge: any) {
  // We should get the trial_ends_on date because this date starts the billing cycle
  const shopifyChargeBillingTime
    = getTrialEndsOn(shopifyCharge) || shopifyCharge?.activated_on || shopifyCharge?.billing_on

  return shopifyChargeBillingTime
}

/**
 * Get trial ends on date
 *
 * @param shopifyCharge
 * @returns
 */
export function getTrialEndsOn(shopifyCharge: any) {
  return shopifyCharge?.trial_ends_on
}
