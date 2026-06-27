import { useMemo, useState, type ReactNode } from 'react'
import { getAiCreditBannerState } from '~/models/helpers/ai-credit-utils'
import { AiCreditExhaustedBanner } from '~/components/common/AiCreditExhaustedBanner'
import { AI_CREDIT_PER_MONTH } from '~/constants/ai-assistant'

interface AiCreditBannerSectionProps {
  aiCredit?: { monthlyUsage?: number; purchasedCredits?: number } | null
  allocation?: number
  fallback?: ReactNode
}

export function AiCreditBannerSection({ aiCredit, allocation, fallback }: AiCreditBannerSectionProps) {
  const bannerState = useMemo(
    () => getAiCreditBannerState(aiCredit, allocation || AI_CREDIT_PER_MONTH),
    [aiCredit, allocation]
  )
  const [isDismissed, setIsDismissed] = useState(false)

  const showBanner = bannerState !== 'none' && !isDismissed

  if (!showBanner) return fallback ?? null

  return (
    <AiCreditExhaustedBanner
      tone={bannerState === 'critical' ? 'critical' : 'warning'}
      onDismiss={() => setIsDismissed(true)}
      wrapInCard={false}
    />
  )
}
