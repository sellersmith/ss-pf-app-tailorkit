import type { UserJourneyDocument } from '~/models/UserJourney'

export type QuestionOption = {
  label: string
  value: string
}

export type FeedbackFormQuestion = {
  modalTitle?: string
  label: string
  description?: string
  key: string
  required?: boolean
  hideLabel?: boolean
  placeholder?: string
  requiredMessage?: string
  validationRegExpPattern?: string
  type: 'checkbox' | 'file' | 'radio' | 'select' | 'text' | 'textarea'
  // Options are required for the `checkbox`, `radio` and `select` field types
  options?: QuestionOption[]
  // Allowed file type for the `file` field
  fileType?: 'file' | 'image' | 'video'
  // Max. file size in bytes for the `file` field
  fileSize?: number
  // Max. length for the `text` and `textarea` field types
  maxLength?: number
}

export type FeedbackFormDocument = {
  _id: string
  title: string
  startAt?: Date
  endAt?: Date
  createdAt: Date
  updatedAt: Date
  postResponsesTo?: string
  status: 'active' | 'inactive'
  questions: FeedbackFormQuestion[]
  formType: string
  subInformation?: string
  formName?: string
  nextAtQuestions?: number[]
}

export type FeedbackResponseDocument = {
  _id: string
  formId: string
  createdAt: Date
  updatedAt: Date
  localTime?: String
  shopDomain: string
  responses: [
    {
      question: string
      answer: mongoose.Schema.Types.Mixed
    },
  ]
}

export type FeedbackComponentProps = ComponentProps<any> & {
  t: TFunction
  dataSource: string
  displayAs: 'modal' | 'popover'
  activator?: string | ReactNode
  addLocalTimeToResponse?: boolean
  localeToResponse?: string
  LoadingComponent?: FunctionComponent | ComponentClass
  userJourney?: UserJourneyDocument
  secondaryActions?: any
  footerMarkup?: ReactNode
  primaryActionContent?: string
  defaultOpen?: boolean
  showSubmitted?: boolean
  showDontShowAgain?: boolean
  onClose?: () => void
  onSuccess?: (data: any) => void
  onError?: (message: string) => void
  fetchFunction?: (url: string, options?: any) => Promise<any>
  onSave?: (responses: { [id: string]: any }, dataSource: string, onError?: (message: string) => void) => Promise<void>
}

export type FeedbackComponentState = ComponentState & {
  saving: boolean
  formIndex: number
  showForms: boolean
  submitted: boolean
  forms: FeedbackFormDocument[]
  missingFields: { [id: string]: string[] }
  responses: { [id: string]: FeedbackResponseDocument }
}

export type IPostFeedbackData = { [key: string]: any }
