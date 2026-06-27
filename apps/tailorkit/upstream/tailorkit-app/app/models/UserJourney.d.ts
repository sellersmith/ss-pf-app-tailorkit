import { type FEEDBACK_TYPE } from '~/modules/Feedback/constants'
import { type USER_JOURNEY_TYPE } from '~/routes/api.user-journey/constants'

interface UserJourneyDocument {
  shopDomain: string
  currentStep: string
  type: USER_JOURNEY_TYPE | FEEDBACK_TYPE
  progress?: number
  data?: OnboardingData[] | FeedbackData[]
  isFinished?: boolean
  showOnboarding?: boolean
}

interface OnboardingData {
  questionKey: string
  selectedValue: string
  customInput?: string
}
interface FeedbackData {
  formId: string
  data: OnboardingData[]
}

export { UserJourneyDocument, OnboardingData, FeedbackData }
