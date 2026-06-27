import type { FeedbackResponseDocument } from '../types'
import mongoose from 'mongoose'

const FeedbackResponseSchema = new mongoose.Schema<Omit<FeedbackResponseDocument, ''>>(
  {
    formId: {
      type: String,
      ref: 'FeedbackForm',
    },
    localTime: {
      type: String,
      index: true,
    },
    shopDomain: {
      type: String,
      index: true,
    },
    responses: [
      {
        question: {
          type: String,
          required: true,
        },
        answer: {
          type: mongoose.Schema.Types.Mixed,
          required: true,
        },
      },
    ],
  },
  { timestamps: true }
)

const FeedbackResponse
  = mongoose.models.FeedbackResponse || mongoose.model('FeedbackResponse', FeedbackResponseSchema, 'feedback_responses')

export default FeedbackResponse
