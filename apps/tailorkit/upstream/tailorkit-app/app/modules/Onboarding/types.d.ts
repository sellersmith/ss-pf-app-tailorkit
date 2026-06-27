import type { OnboardingData } from '~/models/UserJourney'
import type { FeedbackFormDocument, FeedbackFormQuestion, FeedbackResponseDocument } from '../Feedback/types'

type OnboardingComponentProps = ComponentProps<any> & {
  t: TFunction
  dataSource: string
  activator?: string | ReactNode
  addLocalTimeToResponse?: boolean
  LoadingComponent?: FunctionComponent | ComponentClass
  onSuccess?: () => void
  onError?: (message: string) => void
  fetchFunction?: (url: string, options?: any) => Promise<any>
  onSave?: (responses: { [id: string]: any }, dataSource: string, onError?: (message: string) => void) => Promise<void>
}

type OnboardingComponentState = ComponentState & {
  saving: boolean
  formIndex: number
  showForms: boolean
  submitted: boolean
  forms: FeedbackFormDocument[]
  missingFields: { [id: string]: string[] }
  responses: { [id: string]: FeedbackResponseDocument }
}

type OnboardingQuestion = FeedbackFormQuestion & {
  thumbnailSrc: string
}

type OnboardingForm = {
  questions: OnboardingQuestion[]
  isFinished: boolean
  currentStep: string
  formId: string
  currentStepData: OnboardingData[]
  isShowFirstTime: boolean
}

export { OnboardingComponentProps, OnboardingComponentState, OnboardingForm, OnboardingQuestion }
