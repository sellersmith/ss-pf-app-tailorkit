import { FEEDBACK_TYPE } from './common'
import { OVERALL_EXPERIENCE_FORM_API } from '~/routes/api.google-sheet/constants'
const OVERALL_EXPERIENCE_QUESTION_OPTIONS_VALUE = {
  OVERALL_EXPERIENCE_QUESTION_1: {
    OPTION_1: 'Excellent',
    OPTION_2: 'Good',
    OPTION_3: 'Neutral',
    OPTION_4: 'Needs improvement',
    OPTION_5: 'Poor',
  },
  OVERALL_EXPERIENCE_QUESTION_2: {
    OPTION_1: 'Very helpful',
    OPTION_2: 'Helpful',
    OPTION_3: 'Neutral',
    OPTION_4: 'Needs improvement',
    OPTION_5: 'Poor',
  },
}

// Overall Experience form
const OVERALL_EXPERIENCE_FORM = [
  {
    title: 'overall-experience-title',
    status: 'active',
    postResponsesTo: OVERALL_EXPERIENCE_FORM_API,
    subInformation: 'overall-experience-sub-information',
    formName: 'overall-experience-form-name',
    formType: FEEDBACK_TYPE.OVERALL_EXPERIENCE,
    questions: [
      {
        label: 'overall-experience-question-1-label',
        key: 'overall-experience-question-1-key',
        type: 'radio',
        required: true,
        options: [
          {
            label: 'overall-experience-question-1-option-label-1',
            value: OVERALL_EXPERIENCE_QUESTION_OPTIONS_VALUE.OVERALL_EXPERIENCE_QUESTION_1.OPTION_1,
          },
          {
            label: 'overall-experience-question-1-option-label-2',
            value: OVERALL_EXPERIENCE_QUESTION_OPTIONS_VALUE.OVERALL_EXPERIENCE_QUESTION_1.OPTION_2,
          },
          {
            label: 'overall-experience-question-1-option-label-3',
            value: OVERALL_EXPERIENCE_QUESTION_OPTIONS_VALUE.OVERALL_EXPERIENCE_QUESTION_1.OPTION_3,
          },
          {
            label: 'overall-experience-question-1-option-label-4',
            value: OVERALL_EXPERIENCE_QUESTION_OPTIONS_VALUE.OVERALL_EXPERIENCE_QUESTION_1.OPTION_4,
          },
          {
            label: 'overall-experience-question-1-option-label-5',
            value: OVERALL_EXPERIENCE_QUESTION_OPTIONS_VALUE.OVERALL_EXPERIENCE_QUESTION_1.OPTION_5,
          },
        ],
      },
      {
        label: 'overall-experience-question-2-label',
        key: 'overall-experience-question-2-key',
        type: 'radio',
        required: true,
        options: [
          {
            label: 'overall-experience-question-2-option-label-1',
            value: OVERALL_EXPERIENCE_QUESTION_OPTIONS_VALUE.OVERALL_EXPERIENCE_QUESTION_2.OPTION_1,
          },
          {
            label: 'overall-experience-question-2-option-label-2',
            value: OVERALL_EXPERIENCE_QUESTION_OPTIONS_VALUE.OVERALL_EXPERIENCE_QUESTION_2.OPTION_2,
          },
          {
            label: 'overall-experience-question-2-option-label-3',
            value: OVERALL_EXPERIENCE_QUESTION_OPTIONS_VALUE.OVERALL_EXPERIENCE_QUESTION_2.OPTION_3,
          },
          {
            label: 'overall-experience-question-2-option-label-4',
            value: OVERALL_EXPERIENCE_QUESTION_OPTIONS_VALUE.OVERALL_EXPERIENCE_QUESTION_2.OPTION_4,
          },
          {
            label: 'overall-experience-question-2-option-label-5',
            value: OVERALL_EXPERIENCE_QUESTION_OPTIONS_VALUE.OVERALL_EXPERIENCE_QUESTION_2.OPTION_5,
          },
        ],
      },
      {
        label: 'overall-experience-question-3-label',
        key: 'overall-experience-question-3-key',
        type: 'textarea',
        placeholder: 'overall-experience-question-3-placeholder',
      },
    ],
  },
]

export { OVERALL_EXPERIENCE_FORM }
