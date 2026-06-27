/** @jsxImportSource preact */
import { Button } from '../../preact/commons/button'
import { translate } from '../../../libraries/translation'

export interface WizardNavigationProps {
  currentStep: number
  totalSteps: number
  isOptional: boolean
  onBack: () => void
  onSkip: () => void
  onNext: () => void
}

export function WizardNavigation({
  currentStep,
  totalSteps,
  isOptional,
  onBack,
  onSkip,
  onNext,
}: WizardNavigationProps) {
  const isLastStep = currentStep === totalSteps - 1

  return (
    <div className="emtlkit--wizard-nav">
      {currentStep > 0 && (
        <Button variant="outline" onClick={onBack}>
          {translate('wizard-back', 'Back')}
        </Button>
      )}

      {isOptional && (
        <Button variant="plain" onClick={onSkip}>
          {translate('wizard-skip', 'Skip')}
        </Button>
      )}

      {/* Hide Next on last step — buyer uses existing Add to Cart button */}
      {!isLastStep && (
        <div style={{ marginLeft: 'auto' }}>
          <Button variant="primary" onClick={onNext}>
            {translate('wizard-next', 'Next')}
          </Button>
        </div>
      )}
    </div>
  )
}

export default WizardNavigation
