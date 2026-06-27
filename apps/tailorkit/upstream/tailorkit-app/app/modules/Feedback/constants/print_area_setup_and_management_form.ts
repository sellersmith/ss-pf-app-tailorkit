import { FEEDBACK_TYPE } from './common'
import { PRINT_AREA_SETUP_AND_MANAGEMENT_FORM_API } from '~/routes/api.google-sheet/constants'

const PRINT_AREA_SETUP_AND_MANAGEMENT_QUESTION_OPTIONS_VALUE = {
  PRINT_AREA_SETUP_AND_MANAGEMENT_QUESTION_1: {
    OPTION_1: 'Very easy to understand',
    OPTION_2: 'Fairly easy to understand',
    OPTION_3: 'Average',
    OPTION_4: 'Difficult to understand',
    OPTION_5: 'Very difficult to understand',
  },
  PRINT_AREA_SETUP_AND_MANAGEMENT_QUESTION_2: {
    OPTION_1: 'Very effective',
    OPTION_2: 'Effective',
    OPTION_3: 'Average',
    OPTION_4: 'Ineffective',
    OPTION_5: 'Very ineffective',
  },
}

// Print Area Setup and Management form
const PRINT_AREA_SETUP_AND_MANAGEMENT_FORM = [
  {
    title: 'print-area-setup-and-management-title',
    status: 'active',
    postResponsesTo: PRINT_AREA_SETUP_AND_MANAGEMENT_FORM_API,
    formType: FEEDBACK_TYPE.INTEGRATION_FUNCTIONALITY,
    formName: 'print-area-setup-and-management-form-name',
    questions: [
      {
        label: 'print-area-setup-and-management-question-1-label',
        key: 'print-area-setup-and-management-question-1-key',
        type: 'radio',
        required: true,
        options: [
          {
            label: 'print-area-setup-and-management-question-1-option-label-1',
            value:
              PRINT_AREA_SETUP_AND_MANAGEMENT_QUESTION_OPTIONS_VALUE.PRINT_AREA_SETUP_AND_MANAGEMENT_QUESTION_1
                .OPTION_1,
          },
          {
            label: 'print-area-setup-and-management-question-1-option-label-2',
            value:
              PRINT_AREA_SETUP_AND_MANAGEMENT_QUESTION_OPTIONS_VALUE.PRINT_AREA_SETUP_AND_MANAGEMENT_QUESTION_1
                .OPTION_2,
          },
          {
            label: 'print-area-setup-and-management-question-1-option-label-3',
            value:
              PRINT_AREA_SETUP_AND_MANAGEMENT_QUESTION_OPTIONS_VALUE.PRINT_AREA_SETUP_AND_MANAGEMENT_QUESTION_1
                .OPTION_3,
          },
          {
            label: 'print-area-setup-and-management-question-1-option-label-4',
            value:
              PRINT_AREA_SETUP_AND_MANAGEMENT_QUESTION_OPTIONS_VALUE.PRINT_AREA_SETUP_AND_MANAGEMENT_QUESTION_1
                .OPTION_4,
          },
          {
            label: 'print-area-setup-and-management-question-1-option-label-5',
            value:
              PRINT_AREA_SETUP_AND_MANAGEMENT_QUESTION_OPTIONS_VALUE.PRINT_AREA_SETUP_AND_MANAGEMENT_QUESTION_1
                .OPTION_5,
          },
        ],
      },
      {
        label: 'print-area-setup-and-management-question-2-label',
        key: 'print-area-setup-and-management-question-2-key',
        type: 'radio',
        required: true,
        options: [
          {
            label: 'print-area-setup-and-management-question-2-option-label-1',
            value:
              PRINT_AREA_SETUP_AND_MANAGEMENT_QUESTION_OPTIONS_VALUE.PRINT_AREA_SETUP_AND_MANAGEMENT_QUESTION_2
                .OPTION_1,
          },
          {
            label: 'print-area-setup-and-management-question-2-option-label-2',
            value:
              PRINT_AREA_SETUP_AND_MANAGEMENT_QUESTION_OPTIONS_VALUE.PRINT_AREA_SETUP_AND_MANAGEMENT_QUESTION_2
                .OPTION_2,
          },
          {
            label: 'print-area-setup-and-management-question-2-option-label-3',
            value:
              PRINT_AREA_SETUP_AND_MANAGEMENT_QUESTION_OPTIONS_VALUE.PRINT_AREA_SETUP_AND_MANAGEMENT_QUESTION_2
                .OPTION_3,
          },
          {
            label: 'print-area-setup-and-management-question-2-option-label-4',
            value:
              PRINT_AREA_SETUP_AND_MANAGEMENT_QUESTION_OPTIONS_VALUE.PRINT_AREA_SETUP_AND_MANAGEMENT_QUESTION_2
                .OPTION_4,
          },
          {
            label: 'print-area-setup-and-management-question-2-option-label-5',
            value:
              PRINT_AREA_SETUP_AND_MANAGEMENT_QUESTION_OPTIONS_VALUE.PRINT_AREA_SETUP_AND_MANAGEMENT_QUESTION_2
                .OPTION_5,
          },
        ],
      },
      {
        label: 'print-area-setup-and-management-question-3-label',
        key: 'print-area-setup-and-management-question-3-key',
        type: 'textarea',
        placeholder: 'print-area-setup-and-management-question-3-placeholder',
      },
    ],
  },
]

export { PRINT_AREA_SETUP_AND_MANAGEMENT_FORM }
