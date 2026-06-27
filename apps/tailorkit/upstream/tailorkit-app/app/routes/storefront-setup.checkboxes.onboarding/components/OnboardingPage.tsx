import { BlockStack, Page } from '@shopify/polaris'
import { lazy, Suspense, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ONBOARDING_STEPS } from '../constants'
import { useCheckboxOnboarding } from '../hooks/useCheckboxOnboarding'
import OnboardingFooter from './OnboardingFooter'
import BlockLoading from '~/components/loading/BlockLoading'

// Lazy load step components
const ShareKnowledgeStep = lazy(() => import('./ShareKnowledgeStep'))
const BasicSetupStep = lazy(() => import('./BasicSetupStep'))
const EnableThemeHelperStep = lazy(() => import('./EnableThemeHelperStep'))

/**
 * OnboardingPage - Main page layout for checkbox onboarding
 * Renders the current step component with header and footer
 */
export default function OnboardingPage() {
  const { t } = useTranslation()
  const { currentStep } = useCheckboxOnboarding()

  // Get step metadata
  const currentStepData = useMemo(() => {
    return ONBOARDING_STEPS.find(step => step.key === currentStep)
  }, [currentStep])

  // Get step title and subtitle
  const getStepTitle = () => {
    switch (currentStep) {
      case 'shareKnowledge':
        return t('know-your-customers-well')
      case 'basicSetup':
        return t('create-your-first-add-on')
      case 'enableThemeHelper':
        return t('enable-theme-helper')
      default:
        return currentStepData?.title || ''
    }
  }

  const getStepSubtitle = () => {
    switch (currentStep) {
      case 'shareKnowledge':
        return t('something-we-don-t-see-many-people-talk-about')
      case 'basicSetup':
        return t('select-a-product-to-offer-as-an-add-on')
      case 'enableThemeHelper':
        return t('final-step-to-display-your-add-on-products')
      default:
        return ''
    }
  }

  // Render current step component
  const renderStepComponent = () => {
    switch (currentStep) {
      case 'shareKnowledge':
        return <ShareKnowledgeStep />
      case 'basicSetup':
        return <BasicSetupStep />
      case 'enableThemeHelper':
        return <EnableThemeHelperStep />
      default:
        return null
    }
  }

  return (
    <Page title={getStepTitle()} subtitle={getStepSubtitle()}>
      <Suspense fallback={<BlockLoading />}>
        <BlockStack gap="300">
          {renderStepComponent()}
          <OnboardingFooter />
        </BlockStack>
      </Suspense>
    </Page>
  )
}
