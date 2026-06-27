import {
  GIVE_USE_FEEDBACK_FORM,
  FEEDBACK_TYPE,
  ONBOARDING_FORM,
  TEMPLATE_EDITOR_FUNCTIONALITY_FORM,
  GENERAL_FEEDBACK_FORM,
  INTEGRATION_FUNCTIONALITY_FORM,
  PRODUCT_CATALOG_SUPPLIER_SELECTION_FORM,
  PRINT_AREA_SETUP_AND_MANAGEMENT_FORM,
  OVERALL_EXPERIENCE_FORM,
} from '../constants'
import type { FeedbackFormDocument } from '../types'
import mongoose from 'mongoose'

const FeedbackFormSchema = new mongoose.Schema<Omit<FeedbackFormDocument, ''>>(
  {
    title: {
      type: String,
      index: true,
      unique: true,
      required: true,
    },
    startAt: {
      type: Date,
      index: true,
    },
    endAt: {
      type: Date,
      index: true,
    },
    status: {
      type: String,
      index: true,
      required: true,
      enum: ['active', 'inactive'],
    },
    nextAtQuestions: [
      {
        type: [Number],
        index: true,
      },
    ],
    questions: [
      {
        label: {
          type: String,
          required: true,
        },
        key: {
          type: String,
          required: true,
        },
        type: {
          type: String,
          required: true,
          enum: ['checkbox', 'file', 'radio', 'select', 'text', 'textarea'],
        },
        options: [
          {
            label: String,
            value: String,
          },
        ],
        fileType: {
          type: String,
          enum: ['file', 'image', 'video'],
        },
        fileSize: Number,
        required: Boolean,
        maxLength: Number,
        hideLabel: Boolean,
        placeholder: String,
        requiredMessage: String,
        validationRegExpPattern: String,
      },
    ],
    postResponsesTo: String,
    formType: {
      type: String,
      enum: Object.values(FEEDBACK_TYPE),
      index: true,
    },
    subInformation: {
      type: String,
      index: true,
    },
    formName: {
      type: String,
      index: true,
    },
  },
  { timestamps: true, strict: false }
)

const FeedbackForm
  = mongoose.models.FeedbackForm || mongoose.model('FeedbackForm', FeedbackFormSchema, 'feedback_forms')

export default FeedbackForm

/**
 * @description Create the very first feedback form
 */
export async function runCreateFirstFeedbackForm() {
  if (!process.env.FIRST_FEEDBACK_FORM_DEPLOYED) {
    ;(async function () {
      const FEEDBACK_LIST = [
        ...GIVE_USE_FEEDBACK_FORM,
        ...ONBOARDING_FORM,
        ...TEMPLATE_EDITOR_FUNCTIONALITY_FORM,
        ...INTEGRATION_FUNCTIONALITY_FORM,
        ...PRODUCT_CATALOG_SUPPLIER_SELECTION_FORM,
        ...PRINT_AREA_SETUP_AND_MANAGEMENT_FORM,
        ...OVERALL_EXPERIENCE_FORM,
        ...GENERAL_FEEDBACK_FORM,
      ]

      await FeedbackForm.bulkWrite(
        FEEDBACK_LIST.map(feedback => {
          return {
            updateOne: {
              filter: { title: feedback.title },
              update: {
                ...feedback,
              },
              upsert: true,
            },
          }
        })
      )
    })()

    process.env.FIRST_FEEDBACK_FORM_DEPLOYED = 'yes'
  }
}
