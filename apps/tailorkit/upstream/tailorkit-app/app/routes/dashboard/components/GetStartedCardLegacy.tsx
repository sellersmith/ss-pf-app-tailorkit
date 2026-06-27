import { BlockStack, Button, InlineStack, Text } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import CardWithDismiss from './CardWithDismiss'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOnboardingProgress } from '../hooks/useOnboardingProgress'
import { TASKS_ONBOARDING_STEPS } from '../constants'
import { FEEDBACK_TYPE } from '~/modules/Feedback/constants'
import { useGatherUserFeedbackForm } from '~/modules/Feedback/hooks/useGatherUserFeedbackForm'
import { SetupGuide } from '~/components/SetUpGuide'
import type { ISetupGuideItem } from '~/components/SetUpGuide/types'
import UserMilestonesCard from './UserMilestonesCard'
import { PrepareProductsModal } from './ModalPrepareProducts'
import { OCCURRED_EVENTS } from '~/routes/api.preferences/constants'

export default function GetStartedCard(props: {
  modalActive: boolean
  refresh?: boolean
  setOnboardingModalActive: (onboardingModalActive: boolean) => void
}) {
  const { t } = useTranslation()
  const { modalActive, refresh, setOnboardingModalActive } = props
  const {
    loading,
    isWelcomeDone,
    isSpecificationDone,
    isAchieveFirstSaleDone,
    isAllOnboardingDone,
    preparingProductsModalActive,
    handleContinueUserMilestone,
    togglePreparingProductsModal,
  } = useOnboardingProgress(modalActive, refresh)
  const { showFeedbackForm } = useGatherUserFeedbackForm({
    feedbackType: FEEDBACK_TYPE.OVERALL_EXPERIENCE,
  })

  const [preparingData, setPreparingData] = useState(false)

  const TASKS_ONBOARDING_COMPLETED = useMemo(() => {
    return {
      [TASKS_ONBOARDING_STEPS.WELCOME.id]: isWelcomeDone,
      [TASKS_ONBOARDING_STEPS.SPECIFICATIONS.id]: isSpecificationDone,
    }
  }, [isWelcomeDone, isSpecificationDone])

  const { title: milestoneTitle, description: milestoneDescription } = UserMilestonesCard()
  const listTasks: ISetupGuideItem[] = useMemo(
    () => [
      ...Object.values(TASKS_ONBOARDING_STEPS)
        .filter(task => task.id !== TASKS_ONBOARDING_STEPS.ACHIEVE_FIRST_SALE.id)
        .map(task => ({
          id: task.id,
          title: t(task.titleKey),
          complete: TASKS_ONBOARDING_COMPLETED[task.id],
          description: t(task.descriptionKey),
        })),
      {
        id: TASKS_ONBOARDING_STEPS.ACHIEVE_FIRST_SALE.id,
        complete: isAchieveFirstSaleDone,
        title: milestoneTitle,
        description: milestoneDescription,
      },
    ],
    [isAchieveFirstSaleDone, milestoneTitle, milestoneDescription, t, TASKS_ONBOARDING_COMPLETED]
  )

  const openOnboardingModal = useCallback(async () => {
    try {
      setPreparingData(true)

      // Check onboarding completion
      if (!isWelcomeDone || !isSpecificationDone) {
        setOnboardingModalActive(true)
        return
      }

      await handleContinueUserMilestone()
    } catch (error) {
      console.error('Error in openOnboardingModal:', error)
    } finally {
      setPreparingData(false)
    }
  }, [isWelcomeDone, isSpecificationDone, handleContinueUserMilestone, setOnboardingModalActive])

  useEffect(() => {
    if (isAllOnboardingDone) {
      showFeedbackForm()
    }
  }, [isAllOnboardingDone, showFeedbackForm])

  return (
    <CardWithDismiss
      title={t('get-started-with-tailorkit')}
      cardName={OCCURRED_EVENTS.GET_STARTED_WITH_TAILORKIT_CARD_DASHBOARD_DISMISSED}
    >
      <BlockStack gap={'300'}>
        <Text as="p" variant="bodyMd" tone="subdued">
          {t('use-this-personalized-guide-to-quickly-get-started-and-create-your-first-product')}
        </Text>

        <SetupGuide items={listTasks} />

        {!loading && !isAllOnboardingDone && (
          <InlineStack align="space-between" blockAlign="center">
            <Text as="p" variant="bodyMd">
              {t('complete-the-onboarding-flows-to-ensure-you-fully-understand-and-are-ready-to-use-the-app')}
            </Text>
            <Button onClick={openOnboardingModal} loading={preparingData}>
              {t('continue-onboarding')}
            </Button>
          </InlineStack>
        )}
        <PrepareProductsModal active={preparingProductsModalActive} onClose={togglePreparingProductsModal} />
      </BlockStack>
    </CardWithDismiss>
  )
}
