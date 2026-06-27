import { GIVE_US_FEEDBACK_FORM_API } from '~/routes/api.google-sheet/constants'
import { FEEDBACK_TYPE } from './common'

// Give us Feedback form
const GIVE_USE_FEEDBACK_FORM = [
  {
    title: 'Give us your feedback',
    status: 'active',
    postResponsesTo: GIVE_US_FEEDBACK_FORM_API,
    questions: [
      {
        label: 'give-us-your-feedback-question-1-label',
        description: 'give-us-your-feedback-question-1-description',
        key: 'give-us-your-feedback-question-1-key',
        type: 'checkbox',
        options: [
          {
            label: 'give-us-your-feedback-question-1-option-label-1',
            value: 'Hard to understand how to create a personalized product',
          },
          {
            label: 'give-us-your-feedback-question-1-option-label-2',
            value: 'Limited design templates',
          },
          {
            label: 'give-us-your-feedback-question-1-option-label-3',
            value: 'Unrealistic product mockups',
          },
          {
            label: 'give-us-your-feedback-question-1-option-label-4',
            value: 'Confusing pricing',
          },
          {
            label: 'give-us-your-feedback-question-1-option-label-5',
            value: 'Slow or unstable app',
          },
          {
            label: 'give-us-your-feedback-question-1-option-label-6',
            value: 'Inefficient customer support',
          },
          {
            label: 'give-us-your-feedback-question-1-option-label-7',
            value: 'Others',
            hideLabel: true,
            type: 'textarea',
            placeholder: 'give-us-your-feedback-question-1-option-label-7-placeholder',
          },
        ],
      },
      {
        label: 'give-us-your-feedback-question-2-label',
        key: 'give-us-your-feedback-question-2-key',
        type: 'text',
        placeholder: 'give-us-your-feedback-question-2-placeholder',
      },
      {
        label: 'give-us-your-feedback-question-3-label',
        key: 'give-us-your-feedback-question-3-key',
        type: 'textarea',
        placeholder: 'give-us-your-feedback-question-3-placeholder',
      },
    ],
    formType: FEEDBACK_TYPE.GIVE_US_YOUR_FEEDBACK,
  },
]

export { GIVE_USE_FEEDBACK_FORM }
