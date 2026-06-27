import mongoose from '~/bootstrap/db/connect-db.server'

/**
 * Stores a pending install source attribution waiting to be consumed by the
 * next OAuth `afterAuth` for that shop. Used by partner integrations
 * (e.g. PageFly) to attribute installs without cookies. PF marks the source
 * BEFORE redirecting the merchant to the App Store; the OAuth callback
 * picks it up, copies onto Shop.metadata, and deletes the doc.
 *
 * TTL index auto-expires unconsumed docs after 30 minutes.
 */
export interface PendingInstallSourceDocument extends mongoose.Document {
  shopDomain: string
  source: string
  metadata?: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
  expiresAt: Date
}

const schema = new mongoose.Schema<PendingInstallSourceDocument>(
  {
    shopDomain: { type: String, required: true, unique: true, index: true },
    source: { type: String, required: true },
    metadata: { type: Object, default: {} },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
)

// MongoDB TTL: doc auto-deleted when expiresAt passes (background job runs ~every 60s)
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

const PendingInstallSource
  = (mongoose.models.PendingInstallSource as mongoose.Model<PendingInstallSourceDocument>)
  || mongoose.model<PendingInstallSourceDocument>('PendingInstallSource', schema)

export default PendingInstallSource
