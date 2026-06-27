import type { AiCreditPackageDocument } from './AiCreditPackage'
import mongoose from '~/bootstrap/db/connect-db.server'
import aiCreditPackages from './AiCreditPackage.define.server'

const aiCreditPackageSchema = new mongoose.Schema<AiCreditPackageDocument>(
  {
    packageId: {
      type: String,
      index: true,
      unique: true,
      required: true,
    },
    name: {
      type: String,
      index: true,
      required: true,
    },
    credits: {
      type: Number,
      index: true,
      required: true,
    },
    price: {
      type: Number,
      index: true,
      required: true,
    },
    status: {
      type: String,
      index: true,
      default: 'active',
      enum: ['active', 'inactive'],
    },
    popular: {
      type: Boolean,
      default: false,
    },
    displayOrder: {
      type: Number,
      index: true,
      default: 0,
    },
    description: String,
  },
  { timestamps: true }
)

const AiCreditPackage
  = mongoose.models.AiCreditPackage
  || mongoose.model<AiCreditPackageDocument>('AiCreditPackage', aiCreditPackageSchema, 'ai_credit_packages')

/**
 * Initialize default AI credit packages in database
 *
 * Creates/updates the 5 predefined AI credit packages:
 * - starter: 100 credits - $1
 * - small: 500 credits - $5
 * - popular: 1200 credits - $10 (best value)
 * - large: 3000 credits - $20
 * - enterprise: 9000 credits - $50
 *
 * Uses packageId as stable unique identifier:
 * - Allows updating name, credits, price without creating duplicates
 * - Safe to run multiple times (upsert based on packageId)
 *
 * Call this during app initialization or database seeding.
 *
 * @returns Promise that resolves when packages are created/updated
 */
export async function runCreateDefaultAiCreditPackages() {
  if (!process.env.DEFAULT_AI_CREDIT_PACKAGES_IMPORTED) {
    for (const packageData of aiCreditPackages) {
      const { packageId, ...rest } = packageData as AiCreditPackageDocument

      // Upsert based on stable packageId (allows updating name, credits, price)
      await AiCreditPackage.updateOne({ packageId }, { ...rest, packageId }, { upsert: true })
    }

    console.log('[AiCreditPackage] Default packages initialized successfully')
    process.env.DEFAULT_AI_CREDIT_PACKAGES_IMPORTED = 'yes'
  }
}

export default AiCreditPackage
