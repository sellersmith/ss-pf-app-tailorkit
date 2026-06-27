import { FEEDBACK_TYPE } from './common'
import { INTEGRATION_FUNCTIONALITY_FORM_API } from '~/routes/api.google-sheet/constants'
const INTEGRATION_FUNCTIONALITY_QUESTION_OPTIONS_VALUE = {
  INTEGRATION_FUNCTIONALITY_QUESTION_1: {
    OPTION_1: 'Very comprehensive',
    OPTION_2: 'Sufficient',
    OPTION_3: 'Missing some elements',
    OPTION_4: 'Missing a lot',
  },
}

// Template Integration Functionality form
const INTEGRATION_FUNCTIONALITY_FORM = [
  {
    title: 'integration-functionality-title',
    status: 'active',
    postResponsesTo: INTEGRATION_FUNCTIONALITY_FORM_API,
    formType: FEEDBACK_TYPE.INTEGRATION_FUNCTIONALITY,
    subInformation: 'integration-functionality-sub-information',
    formName: 'integration-functionality-form-name',
    questions: [
      {
        label: 'integration-functionality-question-1-label',
        key: 'integration-functionality-question-1-key',
        type: 'radio',
        required: true,
        options: [
          {
            label: 'integration-functionality-question-1-option-label-1',
            value: INTEGRATION_FUNCTIONALITY_QUESTION_OPTIONS_VALUE.INTEGRATION_FUNCTIONALITY_QUESTION_1.OPTION_1,
          },
          {
            label: 'integration-functionality-question-1-option-label-2',
            value: INTEGRATION_FUNCTIONALITY_QUESTION_OPTIONS_VALUE.INTEGRATION_FUNCTIONALITY_QUESTION_1.OPTION_2,
          },
          {
            label: 'integration-functionality-question-1-option-label-3',
            value: INTEGRATION_FUNCTIONALITY_QUESTION_OPTIONS_VALUE.INTEGRATION_FUNCTIONALITY_QUESTION_1.OPTION_3,
          },
          {
            label: 'integration-functionality-question-1-option-label-4',
            value: INTEGRATION_FUNCTIONALITY_QUESTION_OPTIONS_VALUE.INTEGRATION_FUNCTIONALITY_QUESTION_1.OPTION_4,
          },
        ],
      },
      {
        label: 'integration-functionality-question-2-label',
        key: 'integration-functionality-question-2-key',
        type: 'textarea',
        placeholder: 'integration-functionality-question-2-placeholder',
      },
      {
        label: 'integration-functionality-question-3-label',
        key: 'integration-functionality-question-3-key',
        type: 'textarea',
        placeholder: 'integration-functionality-question-3-placeholder',
      },
    ],
  },
]

export { INTEGRATION_FUNCTIONALITY_FORM }
