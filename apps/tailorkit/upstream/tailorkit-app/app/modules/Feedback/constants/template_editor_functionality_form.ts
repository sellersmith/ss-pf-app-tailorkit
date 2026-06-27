import { FEEDBACK_TYPE } from './common'
import { TEMPLATE_EDITOR_FUNCTIONALITY_FORM_API } from '~/routes/api.google-sheet/constants'

const TEMPLATE_EDITOR_FUNCTIONALITY_QUESTION_OPTIONS_VALUE = {
  TEMPLATE_EDITOR_FUNCTIONALITY_QUESTION_1: {
    OPTION_1: '100%',
    OPTION_2: '75%',
    OPTION_3: '50%',
    OPTION_4: '25%',
    OPTION_5: '0%',
  },
}

// Template Editor Functionality form
const TEMPLATE_EDITOR_FUNCTIONALITY_FORM = [
  {
    title: 'template-editor-functionality-title',
    status: 'active',
    postResponsesTo: TEMPLATE_EDITOR_FUNCTIONALITY_FORM_API,
    formType: FEEDBACK_TYPE.TEMPLATE_EDITOR_FUNCTIONALITY,
    subInformation: 'template-editor-functionality-sub-information',
    formName: 'template-editor-functionality-form-name',
    questions: [
      {
        label: 'template-editor-functionality-question-1-label',
        key: 'template-editor-functionality-question-1-key',
        type: 'radio',
        required: true,
        options: [
          {
            label: 'template-editor-functionality-question-1-option-label-1',
            value:
              TEMPLATE_EDITOR_FUNCTIONALITY_QUESTION_OPTIONS_VALUE.TEMPLATE_EDITOR_FUNCTIONALITY_QUESTION_1.OPTION_1,
          },
          {
            label: 'template-editor-functionality-question-1-option-label-2',
            value:
              TEMPLATE_EDITOR_FUNCTIONALITY_QUESTION_OPTIONS_VALUE.TEMPLATE_EDITOR_FUNCTIONALITY_QUESTION_1.OPTION_2,
          },
          {
            label: 'template-editor-functionality-question-1-option-label-3',
            value:
              TEMPLATE_EDITOR_FUNCTIONALITY_QUESTION_OPTIONS_VALUE.TEMPLATE_EDITOR_FUNCTIONALITY_QUESTION_1.OPTION_3,
          },
          {
            label: 'template-editor-functionality-question-1-option-label-4',
            value:
              TEMPLATE_EDITOR_FUNCTIONALITY_QUESTION_OPTIONS_VALUE.TEMPLATE_EDITOR_FUNCTIONALITY_QUESTION_1.OPTION_4,
          },
          {
            label: 'template-editor-functionality-question-1-option-label-5',
            value:
              TEMPLATE_EDITOR_FUNCTIONALITY_QUESTION_OPTIONS_VALUE.TEMPLATE_EDITOR_FUNCTIONALITY_QUESTION_1.OPTION_5,
          },
        ],
      },
      {
        label: 'template-editor-functionality-question-2-label',
        key: 'template-editor-functionality-question-2-key',
        type: 'textarea',
        placeholder: 'template-editor-functionality-question-2-placeholder',
      },
      {
        label: 'template-editor-functionality-question-3-label',
        key: 'template-editor-functionality-question-3-key',
        type: 'textarea',
        placeholder: 'template-editor-functionality-question-3-placeholder',
      },
    ],
  },
]

export { TEMPLATE_EDITOR_FUNCTIONALITY_FORM }
