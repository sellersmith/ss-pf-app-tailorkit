import mongoose from '~/bootstrap/db/connect-db.server'

const ShopAccessLogSchema = new mongoose.Schema(
  {
    // The shop domain (e.g. "my-store.myshopify.com")
    shopDomain: {
      type: String,
      required: true,
    },
    // The snapshot date (midnight UTC, no time component)
    // Always set to YYYY-MM-DDT00:00:00.000Z
    date: {
      type: Date,
      required: true,
    },
    // Whether the shop had an active subscription at snapshot time
    // true = has subscription, false = installed but no subscription
    hasSubscription: {
      type: Boolean,
      required: true,
    },
  },
  {
    timestamps: true, // createdAt for audit trail
  }
)

// Primary query index: "how many shops were active on date X"
// Also enforces one entry per shop per day (prevents duplicates on cron retry)
ShopAccessLogSchema.index({ shopDomain: 1, date: 1 }, { unique: true })

// Date-first index for aggregate queries: "all active shops on date X"
ShopAccessLogSchema.index({ date: 1, hasSubscription: 1 })

// TTL index: auto-delete after 730 days (2 years) to bound collection growth
ShopAccessLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 730 * 24 * 60 * 60 })

const ShopAccessLog = mongoose.models.ShopAccessLog || mongoose.model('ShopAccessLog', ShopAccessLogSchema)

export default ShopAccessLog
