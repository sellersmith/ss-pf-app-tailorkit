import { BlockStack, ProgressBar, Text } from '@shopify/polaris'
import type { TFunction } from 'i18next'
import { Trans } from 'react-i18next'

interface TrialProgressSectionProps {
  currentDay: number
  totalDays: number
  startDate: string
  endDate: string
  planName: string
  planPrice: number
  isFirstMonthDeal?: boolean
  t: TFunction
}

export function TrialProgressSection(props: TrialProgressSectionProps) {
  const { currentDay, totalDays, startDate, endDate, planName, planPrice, isFirstMonthDeal, t } = props

  const progress = (currentDay / totalDays) * 100

  // When $1 deal is active, show deal-specific description
  const descriptionKey = isFirstMonthDeal ? 'free-trial-description-with-deal' : 'free-trial-description'
  const descriptionParams = isFirstMonthDeal
    ? { trialDays: totalDays, startDate, endDate, dealPrice: '$1.00', amount: `$${planPrice.toFixed(2)}`, planName }
    : { trialDays: totalDays, startDate, endDate, amount: `$${planPrice.toFixed(2)}`, planName }

  return (
    <BlockStack gap="200">
      <Text as="p" variant="headingSm">
        {t('count-day-free-trial', { count: totalDays })}
      </Text>
      <Text as="p" variant="bodyMd">
        {currentDay} {t('of')} {totalDays}
      </Text>
      <ProgressBar progress={progress} tone="primary" size="small" />
      <Text as="p" variant="bodyMd">
        <Trans t={t} components={{ b: <strong /> }}>
          {t(descriptionKey, descriptionParams)}
        </Trans>
      </Text>
    </BlockStack>
  )
}
