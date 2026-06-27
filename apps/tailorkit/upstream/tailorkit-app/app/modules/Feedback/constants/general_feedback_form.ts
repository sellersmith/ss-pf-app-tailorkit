import { FEEDBACK_TYPE } from './common'
import { GENERAL_FEEDBACK_FORM_API } from '~/routes/api.google-sheet/constants'
const GENERAL_FEEDBACK_QUESTION_OPTIONS_VALUE = {
  GENERAL_FEEDBACK_QUESTION_2: {
    OPTION_1: 'Definitely',
    OPTION_2: 'Likely',
    OPTION_3: 'Neutral',
    OPTION_4: 'Unlikely',
  },
}

const GENERAL_FEEDBACK_FORM = [
  {
    title: 'general-feedback-title',
    status: 'active',
    postResponsesTo: GENERAL_FEEDBACK_FORM_API,
    formName: 'general-feedback-form-name',
    formType: FEEDBACK_TYPE.OVERALL_EXPERIENCE,
    questions: [
      {
        label: 'general-feedback-question-1-label',
        key: 'general-feedback-question-1-key',
        type: 'textarea',
        placeholder: 'general-feedback-question-1-placeholder',
      },
      {
        label: 'general-feedback-question-2-label',
        key: 'general-feedback-question-2-key',
        type: 'radio',
        required: true,
        options: [
          {
            label: 'general-feedback-question-2-option-label-1',
            value: GENERAL_FEEDBACK_QUESTION_OPTIONS_VALUE.GENERAL_FEEDBACK_QUESTION_2.OPTION_1,
          },
          {
            label: 'general-feedback-question-2-option-label-2',
            value: GENERAL_FEEDBACK_QUESTION_OPTIONS_VALUE.GENERAL_FEEDBACK_QUESTION_2.OPTION_2,
          },
          {
            label: 'general-feedback-question-2-option-label-3',
            value: GENERAL_FEEDBACK_QUESTION_OPTIONS_VALUE.GENERAL_FEEDBACK_QUESTION_2.OPTION_3,
          },
          {
            label: 'general-feedback-question-2-option-label-4',
            value: GENERAL_FEEDBACK_QUESTION_OPTIONS_VALUE.GENERAL_FEEDBACK_QUESTION_2.OPTION_4,
          },
        ],
      },
    ],
  },
]

export { GENERAL_FEEDBACK_FORM }
