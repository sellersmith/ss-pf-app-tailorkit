/**
 * Personalized defaults for the PricingCalculator when shown to a subscriber.
 *
 * The prospect calculator defaults to a generic 150 orders × $15 fee. For an
 * active subscriber we have real data — extrapolate their current cycle
 * order count to a 30-day projection so the calculator answers the question
 * "what's my next month going to look like?" rather than "what's a stranger
 * going to look like?".
 */

const DAYS_IN_CYCLE = 30
const MIN_DAYS_FOR_EXTRAPOLATION = 7

interface CalculatorDefaultsParams {
  /** Total orders the merchant has used in the current cycle. */
  currentOrderUsage: number
  /** Cycle anchor date (start of current billing cycle). */
  cycleStartDate?: Date | string | null
  /** "Now" override — for tests. */
  now?: Date
  /** Plan's included free orders quota; used to clamp absurd extrapolations. */
  includedQuota?: number
}

/**
 * Computes a sensible default monthly-order-volume for the subscriber
 * calculator, honoring the following rules:
 *  - If we can't determine days elapsed, use raw `currentOrderUsage`.
 *  - If days elapsed < MIN_DAYS_FOR_EXTRAPOLATION, use `currentOrderUsage`
 *    directly (avoid wild extrapolations like 1 day × 100 orders → 3000).
 *  - Otherwise extrapolate to a 30-day projection.
 *  - When the result exceeds 1.5× the included quota, clamp to the quota
 *    (defensive fallback for fresh-install spikes).
 */
export function computeMonthlyOrderEstimate(params: CalculatorDefaultsParams): number {
  const { currentOrderUsage, cycleStartDate, now = new Date(), includedQuota } = params

  if (!cycleStartDate) return Math.max(0, Math.round(currentOrderUsage))

  const start = new Date(cycleStartDate).getTime()
  const elapsedMs = now.getTime() - start
  const daysElapsed = Math.max(1, Math.floor(elapsedMs / (24 * 60 * 60 * 1000)))

  let estimate: number
  if (daysElapsed < MIN_DAYS_FOR_EXTRAPOLATION) {
    estimate = currentOrderUsage
  } else if (daysElapsed >= DAYS_IN_CYCLE) {
    estimate = currentOrderUsage
  } else {
    estimate = Math.round((currentOrderUsage / daysElapsed) * DAYS_IN_CYCLE)
  }

  // Clamp absurd extrapolations to the plan quota when we have one.
  if (includedQuota && includedQuota > 0 && estimate > includedQuota * 1.5) {
    return includedQuota
  }

  return Math.max(0, estimate)
}
