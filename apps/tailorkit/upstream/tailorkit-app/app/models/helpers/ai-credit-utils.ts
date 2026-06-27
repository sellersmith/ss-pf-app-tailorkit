import { AI_CREDIT_PER_MONTH } from '~/constants/ai-assistant'

interface AiCreditData {
  monthlyUsage?: number
  purchasedCredits?: number

  /** @deprecated */
  requestUsage?: number
  /** @deprecated */
  maxRequestUsage?: number
}

interface AiCreditBalance {
  monthlyUsage: number
  monthlyAllocation: number
  purchasedCredits: number
  remainingMonthly: number
  totalAvailable: number
  hasCredits: boolean
}

interface AiCreditBalanceSummary {
  monthly: number
  purchased: number
  total: number
}

/**
 * Single source of truth for AI credit balance calculation.
 *
 * Formula:
 *   remainingMonthly = max(0, monthlyAllocation - monthlyUsage)
 *   totalAvailable   = max(0, (monthlyAllocation - monthlyUsage) + purchasedCredits)
 *
 * @param aiCredit - Raw credit data from Shop.usages.aiCredit
 * @param allocation - Monthly allocation from plan.aiCreditsPerMonth (defaults to AI_CREDIT_PER_MONTH)
 */
export function calculateAiCreditBalance(
  aiCredit?: AiCreditData | null,
  allocation: number = AI_CREDIT_PER_MONTH
): AiCreditBalance {
  const monthlyUsage = aiCredit?.monthlyUsage ?? aiCredit?.requestUsage ?? 0
  const monthlyAllocation = allocation
  const purchasedCredits = aiCredit?.purchasedCredits ?? 0

  const remainingMonthly = Math.max(0, monthlyAllocation - monthlyUsage)
  const totalAvailable = Math.max(0, monthlyAllocation - monthlyUsage + purchasedCredits)

  return {
    monthlyUsage,
    monthlyAllocation,
    purchasedCredits,
    remainingMonthly,
    totalAvailable,
    hasCredits: totalAvailable > 0,
  }
}

/**
 * Check if shop has enough AI credits for N operations.
 * Drop-in replacement for the core logic of `checkAiCreditPerMonthExceeded`.
 */
export function hasEnoughAiCredits(
  aiCredit?: AiCreditData | null,
  required = 1,
  allocation: number = AI_CREDIT_PER_MONTH
): boolean {
  const { totalAvailable } = calculateAiCreditBalance(aiCredit, allocation)
  return totalAvailable >= required
}

/**
 * Compute balance summary for purchase transaction logging.
 * Returns `{ monthly, purchased, total }` — the shape used in ai-credits-purchase.server.ts.
 */
export function getAiCreditBalanceSummary(
  aiCredit?: AiCreditData | null,
  allocation: number = AI_CREDIT_PER_MONTH
): AiCreditBalanceSummary {
  const { remainingMonthly, purchasedCredits, totalAvailable } = calculateAiCreditBalance(aiCredit, allocation)
  return {
    monthly: remainingMonthly,
    purchased: purchasedCredits,
    total: totalAvailable,
  }
}

export type AiCreditBannerState = 'none' | 'warning' | 'critical'

/**
 * Determine the AI credit banner state for the pricing page.
 *
 * - 'critical': no credits available at all (monthly + purchased depleted)
 * - 'warning': monthly credits at or below 20% AND total credits won't cover another full billing cycle
 * - 'none': credits are sufficient
 */
export function getAiCreditBannerState(
  aiCredit?: AiCreditData | null,
  allocation: number = AI_CREDIT_PER_MONTH
): AiCreditBannerState {
  const balance = calculateAiCreditBalance(aiCredit, allocation)

  if (balance.totalAvailable === 0) {
    return 'critical'
  }

  const monthlyLow = balance.monthlyAllocation > 0 && balance.remainingMonthly / balance.monthlyAllocation <= 0.2
  const totalLow = balance.totalAvailable <= balance.monthlyAllocation

  if (monthlyLow && totalLow) {
    return 'warning'
  }

  return 'none'
}
