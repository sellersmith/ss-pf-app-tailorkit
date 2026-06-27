import { FEEDBACK_TYPE } from './common'
import { PRODUCT_CATALOG_SUPPLIER_SELECTION_FORM_API } from '~/routes/api.google-sheet/constants'
const PRODUCT_CATALOG_SUPPLIER_SELECTION_QUESTION_OPTIONS_VALUE = {
  PRODUCT_CATALOG_SUPPLIER_SELECTION_QUESTION_1: {
    OPTION_1: 'Very comprehensive',
    OPTION_2: 'Sufficient',
    OPTION_3: 'Missing some elements',
    OPTION_4: 'Missing a lot',
  },
  PRODUCT_CATALOG_SUPPLIER_SELECTION_QUESTION_2: {
    OPTION_1: 'Very satisfied',
    OPTION_2: 'Satisfied',
    OPTION_3: 'Neutral',
    OPTION_4: 'Not satisfied',
  },
  PRODUCT_CATALOG_SUPPLIER_SELECTION_QUESTION_3: {
    OPTION_1: 'Very easy to use',
    OPTION_2: 'Fairly easy to use',
    OPTION_3: 'Average',
    OPTION_4: 'Difficult to use',
    OPTION_5: 'Very difficult to use',
  },
  PRODUCT_CATALOG_SUPPLIER_SELECTION_QUESTION_4: {
    OPTION_1: 'Very effective',
    OPTION_2: 'Fairly effective',
    OPTION_3: 'Average',
    OPTION_4: 'Ineffective',
    OPTION_5: 'Very ineffective and time-consuming',
  },
}

// Product Catalog & Supplier Selection form
const PRODUCT_CATALOG_SUPPLIER_SELECTION_FORM = [
  {
    title: 'product-catalog-supplier-selection-title',
    status: 'active',
    postResponsesTo: PRODUCT_CATALOG_SUPPLIER_SELECTION_FORM_API,
    subInformation: 'product-catalog-supplier-selection-sub-information',
    formName: 'product-catalog-supplier-selection-form-name',
    formType: FEEDBACK_TYPE.PRODUCT_CATALOG_SUPPLIER_SELECTION,
    nextAtQuestions: [3],
    questions: [
      {
        label: 'product-catalog-supplier-selection-question-1-label',
        key: 'product-catalog-supplier-selection-question-1-key',
        type: 'radio',
        required: true,
        options: [
          {
            label: 'product-catalog-supplier-selection-question-1-option-label-1',
            value:
              PRODUCT_CATALOG_SUPPLIER_SELECTION_QUESTION_OPTIONS_VALUE.PRODUCT_CATALOG_SUPPLIER_SELECTION_QUESTION_1
                .OPTION_1,
          },
          {
            label: 'product-catalog-supplier-selection-question-1-option-label-2',
            value:
              PRODUCT_CATALOG_SUPPLIER_SELECTION_QUESTION_OPTIONS_VALUE.PRODUCT_CATALOG_SUPPLIER_SELECTION_QUESTION_1
                .OPTION_2,
          },
          {
            label: 'product-catalog-supplier-selection-question-1-option-label-3',
            value:
              PRODUCT_CATALOG_SUPPLIER_SELECTION_QUESTION_OPTIONS_VALUE.PRODUCT_CATALOG_SUPPLIER_SELECTION_QUESTION_1
                .OPTION_3,
          },
          {
            label: 'product-catalog-supplier-selection-question-1-option-label-4',
            value:
              PRODUCT_CATALOG_SUPPLIER_SELECTION_QUESTION_OPTIONS_VALUE.PRODUCT_CATALOG_SUPPLIER_SELECTION_QUESTION_1
                .OPTION_4,
          },
        ],
      },
      {
        label: 'product-catalog-supplier-selection-question-2-label',
        key: 'product-catalog-supplier-selection-question-2-key',
        type: 'radio',
        required: true,
        options: [
          {
            label: 'product-catalog-supplier-selection-question-2-option-label-1',
            value:
              PRODUCT_CATALOG_SUPPLIER_SELECTION_QUESTION_OPTIONS_VALUE.PRODUCT_CATALOG_SUPPLIER_SELECTION_QUESTION_2
                .OPTION_1,
          },
          {
            label: 'product-catalog-supplier-selection-question-2-option-label-2',
            value:
              PRODUCT_CATALOG_SUPPLIER_SELECTION_QUESTION_OPTIONS_VALUE.PRODUCT_CATALOG_SUPPLIER_SELECTION_QUESTION_2
                .OPTION_2,
          },
          {
            label: 'product-catalog-supplier-selection-question-2-option-label-3',
            value:
              PRODUCT_CATALOG_SUPPLIER_SELECTION_QUESTION_OPTIONS_VALUE.PRODUCT_CATALOG_SUPPLIER_SELECTION_QUESTION_2
                .OPTION_3,
          },
          {
            label: 'product-catalog-supplier-selection-question-2-option-label-4',
            value:
              PRODUCT_CATALOG_SUPPLIER_SELECTION_QUESTION_OPTIONS_VALUE.PRODUCT_CATALOG_SUPPLIER_SELECTION_QUESTION_2
                .OPTION_4,
          },
        ],
      },
      {
        label: 'product-catalog-supplier-selection-question-3-label',
        key: 'product-catalog-supplier-selection-question-3-key',
        type: 'radio',
        required: true,
        options: [
          {
            label: 'product-catalog-supplier-selection-question-3-option-label-1',
            value:
              PRODUCT_CATALOG_SUPPLIER_SELECTION_QUESTION_OPTIONS_VALUE.PRODUCT_CATALOG_SUPPLIER_SELECTION_QUESTION_3
                .OPTION_1,
          },
          {
            label: 'product-catalog-supplier-selection-question-3-option-label-2',
            value:
              PRODUCT_CATALOG_SUPPLIER_SELECTION_QUESTION_OPTIONS_VALUE.PRODUCT_CATALOG_SUPPLIER_SELECTION_QUESTION_3
                .OPTION_2,
          },
          {
            label: 'product-catalog-supplier-selection-question-3-option-label-3',
            value:
              PRODUCT_CATALOG_SUPPLIER_SELECTION_QUESTION_OPTIONS_VALUE.PRODUCT_CATALOG_SUPPLIER_SELECTION_QUESTION_3
                .OPTION_3,
          },
          {
            label: 'product-catalog-supplier-selection-question-3-option-label-4',
            value:
              PRODUCT_CATALOG_SUPPLIER_SELECTION_QUESTION_OPTIONS_VALUE.PRODUCT_CATALOG_SUPPLIER_SELECTION_QUESTION_3
                .OPTION_4,
          },
          {
            label: 'product-catalog-supplier-selection-question-3-option-label-5',
            value:
              PRODUCT_CATALOG_SUPPLIER_SELECTION_QUESTION_OPTIONS_VALUE.PRODUCT_CATALOG_SUPPLIER_SELECTION_QUESTION_3
                .OPTION_5,
          },
        ],
      },
      {
        label: 'product-catalog-supplier-selection-question-4-label',
        key: 'product-catalog-supplier-selection-question-4-key',
        type: 'radio',
        required: true,
        options: [
          {
            label: 'product-catalog-supplier-selection-question-4-option-label-1',
            value:
              PRODUCT_CATALOG_SUPPLIER_SELECTION_QUESTION_OPTIONS_VALUE.PRODUCT_CATALOG_SUPPLIER_SELECTION_QUESTION_4
                .OPTION_1,
          },
          {
            label: 'product-catalog-supplier-selection-question-4-option-label-2',
            value:
              PRODUCT_CATALOG_SUPPLIER_SELECTION_QUESTION_OPTIONS_VALUE.PRODUCT_CATALOG_SUPPLIER_SELECTION_QUESTION_4
                .OPTION_2,
          },
          {
            label: 'product-catalog-supplier-selection-question-4-option-label-3',
            value:
              PRODUCT_CATALOG_SUPPLIER_SELECTION_QUESTION_OPTIONS_VALUE.PRODUCT_CATALOG_SUPPLIER_SELECTION_QUESTION_4
                .OPTION_3,
          },
          {
            label: 'product-catalog-supplier-selection-question-4-option-label-4',
            value:
              PRODUCT_CATALOG_SUPPLIER_SELECTION_QUESTION_OPTIONS_VALUE.PRODUCT_CATALOG_SUPPLIER_SELECTION_QUESTION_4
                .OPTION_4,
          },
          {
            label: 'product-catalog-supplier-selection-question-4-option-label-5',
            value:
              PRODUCT_CATALOG_SUPPLIER_SELECTION_QUESTION_OPTIONS_VALUE.PRODUCT_CATALOG_SUPPLIER_SELECTION_QUESTION_4
                .OPTION_5,
          },
        ],
      },
      {
        label: 'product-catalog-supplier-selection-question-5-label',
        key: 'product-catalog-supplier-selection-question-5-key',
        type: 'textarea',
        placeholder: 'product-catalog-supplier-selection-question-5-placeholder',
      },
      {
        label: 'product-catalog-supplier-selection-question-6-label',
        key: 'product-catalog-supplier-selection-question-6-key',
        type: 'textarea',
        placeholder: 'product-catalog-supplier-selection-question-6-placeholder',
      },
    ],
  },
]

export { PRODUCT_CATALOG_SUPPLIER_SELECTION_FORM }
