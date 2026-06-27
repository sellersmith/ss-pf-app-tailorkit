import { useMemo } from 'react'
import { useRootLoaderData } from '~/root'
import { calculateAiCreditBalance } from '~/models/helpers/ai-credit-utils'
import { AI_CREDIT_PER_MONTH } from '~/constants/ai-assistant'

/**
 * Client-side hook that mirrors `checkAiCreditPerMonthExceeded()` from Shop.server.ts.
 * Reads aiCredit data and plan allocation from the root loader (no extra API calls).
 *
 * @returns Credit status including whether the shop has remaining credits
 */
export function useAiCreditsStatus() {
  const rootData = useRootLoaderData()
  const aiCredit = rootData?.shopData?.usages?.aiCredit
  const plan = (rootData?.shopData?.subscription as any)?.plan
  const allocation = plan?.aiCreditsPerMonth || AI_CREDIT_PER_MONTH

  return useMemo(() => {
    const balance = calculateAiCreditBalance(aiCredit, allocation)

    return {
      hasCredits: balance.hasCredits,
      totalAvailable: balance.totalAvailable,
      remainingMonthly: balance.remainingMonthly,
      purchasedCredits: balance.purchasedCredits,
      monthlyAllocation: balance.monthlyAllocation,
      monthlyUsage: balance.monthlyUsage,
    }
  }, [aiCredit, allocation])
}
