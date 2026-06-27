import mongoose from '~/bootstrap/db/connect-db.server'
import { ONE_DAY_IN_MILLISECONDS } from '~/constants'

const WebhookLogSchema = new mongoose.Schema(
  {
    topic: {
      type: String,
      require: true,
      index: true,
    },
    payload: mongoose.SchemaTypes.Mixed,
    shopDomain: {
      type: String,
      index: true,
      required: true,
    },
    admin: {
      type: String,
      enum: ['AUTHENTICATED', 'UNAUTHENTICATED'],
    },
    // Idempotency and processing tracking
    status: {
      type: String,
      enum: ['processing', 'completed', 'failed'],
      default: 'processing',
      index: true,
    },
    webhookId: {
      type: String,
      index: true,
      sparse: true, // Allow null, but unique when present
    },
    error: mongoose.SchemaTypes.Mixed, // Error details if status='failed'
    processedAt: Date, // When webhook processing completed
    expireAt: {
      type: Date,
      default: Date.now,
      expires: ONE_DAY_IN_MILLISECONDS / 1000,
    },
  },
  {
    timestamps: true,
  }
)

// Compound index for idempotency check (topic + webhookId + shopDomain)
// UNIQUE index ensures database-level deduplication (prevents race conditions)
WebhookLogSchema.index({ topic: 1, webhookId: 1, shopDomain: 1 }, { unique: true, sparse: true })

const WebhookLog = mongoose.models.WebhookLog || mongoose.model('WebhookLog', WebhookLogSchema, 'webhook_logs')

export default WebhookLog
