import { Button, ButtonGroup, InlineStack } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { useCheckboxOnboarding } from '../hooks/useCheckboxOnboarding'

/**
 * OnboardingFooter - Navigation buttons for onboarding steps
 * Provides Skip and Next/Complete buttons based on current step
 */
export default function OnboardingFooter() {
  const { t } = useTranslation()
  const {
    currentStep,
    isLoading,
    isSaving,
    isLastStep,
    canProceedToNextStep,
    goToNextStep,
    skipStep,
    completeOnboarding,
    themeConfig,
  } = useCheckboxOnboarding()

  const isProcessing = isLoading || isSaving

  // Determine primary action based on step
  const getPrimaryActionLabel = () => {
    if (isLastStep) {
      return t('complete')
    }
    if (currentStep === 'basicSetup') {
      return t('create-and-continue')
    }
    return t('next')
  }

  const handlePrimaryAction = () => {
    if (isLastStep) {
      completeOnboarding()
    } else {
      goToNextStep()
    }
  }

  // On basicSetup step, disable primary if no product selected
  const isPrimaryDisabled = () => {
    if (currentStep === 'basicSetup') {
      return !canProceedToNextStep
    }
    return false
  }

  // Show skip on theme helper step only if helper is not enabled
  const showSkip = currentStep === 'enableThemeHelper' && !themeConfig.enabledOneTickHelper

  return (
    <InlineStack align="end">
      <ButtonGroup>
        {showSkip && (
          <Button onClick={skipStep} variant="tertiary" disabled={isProcessing}>
            {t('skip')}
          </Button>
        )}

        <Button
          onClick={handlePrimaryAction}
          variant="primary"
          disabled={isPrimaryDisabled() || isProcessing}
          loading={isProcessing}
        >
          {getPrimaryActionLabel()}
        </Button>
      </ButtonGroup>
    </InlineStack>
  )
}
