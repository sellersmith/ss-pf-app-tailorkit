import type { AiCreditPurchaseDocument } from './AiCreditPurchase'
import mongoose from '~/bootstrap/db/connect-db.server'

const aiCreditPurchaseSchema = new mongoose.Schema<AiCreditPurchaseDocument>(
  {
    shopDomain: {
      type: String,
      index: true,
      required: true,
    },
    /**
     * `package` is the `_id` of a document in the `ai_credit_packages` collection.
     */
    package: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AiCreditPackage',
      index: true,
      required: true,
    },
    credits: {
      type: Number,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    couponCode: {
      type: String,
      index: true,
    },
    finalPrice: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      index: true,
      default: 'pending',
      enum: ['pending', 'completed', 'failed', 'refunded'],
    },
    shopifyCharge: mongoose.Schema.Types.Mixed,
    /**
     * Flag to prevent double-crediting
     * Set to true when credits are added to shop.usages.aiCredit.purchasedCredits
     */
    appliedToShop: {
      type: Boolean,
      index: true,
      default: false,
    },
  },
  { timestamps: true }
)

const AiCreditPurchase
  = mongoose.models.AiCreditPurchase
  || mongoose.model<AiCreditPurchaseDocument>('AiCreditPurchase', aiCreditPurchaseSchema, 'ai_credit_purchases')

export default AiCreditPurchase
