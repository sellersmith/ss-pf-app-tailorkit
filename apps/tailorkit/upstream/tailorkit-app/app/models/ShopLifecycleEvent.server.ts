import mongoose from '~/bootstrap/db/connect-db.server'

export enum LifecycleEventType {
  INSTALL = 'install',
  REINSTALL = 'reinstall',
  UNINSTALL = 'uninstall',
}

const ShopLifecycleEventSchema = new mongoose.Schema(
  {
    shopDomain: {
      type: String,
      required: true,
    },
    event: {
      type: String,
      enum: Object.values(LifecycleEventType),
      required: true,
    },
    // The actual timestamp of the event (not necessarily createdAt)
    timestamp: {
      type: Date,
      required: true,
    },
    // Optional metadata for future extensibility
    // e.g. { wasV1User: true }, { previousUninstalledAt: Date }
    metadata: {
      type: mongoose.SchemaTypes.Mixed,
      default: {},
    },
  },
  {
    timestamps: true, // createdAt for audit trail; updatedAt unused but harmless
  }
)

// Primary query: full history for a shop, sorted by time
ShopLifecycleEventSchema.index({ shopDomain: 1, timestamp: 1 })

// Analytics query: "how many uninstalls happened this week" (churn numerator)
ShopLifecycleEventSchema.index({ event: 1, timestamp: 1 })

const ShopLifecycleEvent
  = mongoose.models.ShopLifecycleEvent || mongoose.model('ShopLifecycleEvent', ShopLifecycleEventSchema)

export default ShopLifecycleEvent
