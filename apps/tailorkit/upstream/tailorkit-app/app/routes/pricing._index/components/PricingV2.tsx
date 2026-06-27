import { Page, Card, BlockStack, Text, Banner } from '@shopify/polaris'
import { useState, useCallback } from 'react'
import type { WithTranslationProps } from '~/bootstrap/hoc/withTranslation'
import type { PricingPlanDocument } from '~/models/PricingPlan'
import { PlanSelectionCards, UsageCard } from '.'
import { showToast } from '~/utils/toastEvents'
import { TOAST } from '~/constants/toasts'
import type { ShopDocument } from '~/models/Shop'

interface PricingV2Props extends WithTranslationProps {
  shopData: ShopDocument
  plans: PricingPlanDocument[]
  billingCycleBaseline: number
}

export function PricingV2({ shopData, plans, billingCycleBaseline, t }: PricingV2Props) {
  const [loadingPlanAlias, setLoadingPlanAlias] = useState<string>()

  const handleSelectPlan = useCallback(
    async (planAlias: string) => {
      setLoadingPlanAlias(planAlias)
      try {
        showToast(t('plan-selection-will-be-implemented-soon'))
      } catch (error) {
        showToast(t(TOAST.COMMON.ERROR_GENERIC), { isError: true })
      } finally {
        setLoadingPlanAlias(undefined)
      }
    },
    [t]
  )

  return (
    <Page title={t('pricing')}>
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="200">
            <Text as="h2" variant="headingLg">
              {t('choose-the-right-plan-for-your-business')}
            </Text>
            <Text as="p" tone="subdued">
              {t('simple-transparent-pricing-that-grows-with-you-all-plans-include-30-day-free-trial')}
            </Text>
          </BlockStack>
        </Card>

        <UsageCard shopData={shopData} t={t} billingCycleBaseline={billingCycleBaseline} />

        <Banner tone="info">
          {t('new-pricing-system-is-in-development-plan-selection-functionality-will-be-available-soon')}
        </Banner>

        <PlanSelectionCards
          plans={plans}
          onSelectPlan={handleSelectPlan}
          loadingPlanAlias={loadingPlanAlias}
          billingCycleBaseline={billingCycleBaseline}
          t={t}
        />
      </BlockStack>
    </Page>
  )
}
