import { THIRTY_DAYS_BILLING_CYCLE_INTERVAL } from '~/constants/shopify'

/**
 * Get the billing cycle from and to date based on the activation date and billing cycle interval.
 *
 * @param {string} activated_on - The date when the subscription was activated.
 * @param {number} [cycle=30] - The number of days for the billing cycle (default is 30).
 * @returns {{from: Date, to: Date}} - The calculated `from` and `to` date for the billing cycle.
 * @throws {Error} - Throws if the date is invalid.
 */
export function getBillingCycleDate(activated_on: string, cycle = THIRTY_DAYS_BILLING_CYCLE_INTERVAL) {
  const activateOnDate = new Date(activated_on)

  // Check if the provided date is valid
  if (isNaN(activateOnDate.getTime())) {
    throw new Error('Invalid Date')
  }

  // Set 'from' as the beginning of the day of the activation date
  const from = new Date(`${activateOnDate.toISOString().substring(0, 10)}T00:00:00.000Z`)

  // Create the 'to' date by adding the cycle (days) to the 'from' date
  const now = new Date().toISOString().substring(0, 10)
  const to = new Date(from)

  to.setUTCDate(to.getUTCDate() + cycle)

  while (to.toISOString().substring(0, 10) < now) {
    to.setUTCDate(to.getUTCDate() + cycle)
    from.setUTCDate(from.getUTCDate() + cycle)
  }

  // Set the 'to' date to the end of the day (23:59:59.999)
  to.setUTCMilliseconds(999)
  to.setUTCSeconds(59)
  to.setUTCMinutes(59)
  to.setUTCHours(23)

  return { from, to }
}
