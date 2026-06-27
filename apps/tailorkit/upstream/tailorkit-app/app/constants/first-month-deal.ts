/** Last date (exclusive) the $1 first month deal is available — shared between client & server */
export const FIRST_MONTH_DEAL_DEADLINE = new Date('2026-06-25')

/** Price charged for the first month when deal is active */
export const FIRST_MONTH_DEAL_PRICE = 1

/**
 * Capability-based check: returns true if the subscription was created with the $1 deal.
 * Pure function — safe for client and server.
 */
export function isFirstMonthDealSubscription(
  finalPrice: number | undefined | null,
  planPrice: number | undefined | null
): boolean {
  return finalPrice === FIRST_MONTH_DEAL_PRICE && (planPrice ?? 0) > FIRST_MONTH_DEAL_PRICE
}
