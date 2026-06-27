import { useMemo } from 'react'
import withFeedback from '~/bootstrap/hoc/withFeedback'
import { FEEDBACK_TYPE } from '../Feedback/constants'
// import { OnboardingCard } from './components/OnboardingCard'
import withCurrentStep, { type IOnboardingWithCurrentStepProps } from './hoc/withCurrentStep'
import { OnboardingHighLight } from './components/HighLight'

interface IOnboardingTourProps extends IOnboardingWithCurrentStepProps {
  onRefresh: () => void
}

const ACTIVE_ONBOARDING_FLAG = false

const OnboardingTourContent = ACTIVE_ONBOARDING_FLAG
  ? withCurrentStep((props: IOnboardingTourProps) => {
      return <OnboardingHighLight />
    })
  : OnboardingHighLight

function OnboardingTour(props: { onRefresh: () => void }) {
  const EnhancedComponent = useMemo(() => withFeedback(OnboardingTourContent, FEEDBACK_TYPE.OVERALL_EXPERIENCE), [])

  return <EnhancedComponent {...props} />
}

export default OnboardingTour
