import mongoose from '~/bootstrap/db/connect-db.server'

export interface IRedirectTracking {
  _id: string
  fullUrl: string
  destinationUrl: string
  queryParams: Record<string, string>
  referer?: string
  userAgent?: string
  clientIp?: string
  couponCode?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmContent?: string
  timestamp: Date
  appliedCoupon?: string
}

const redirectTrackingSchema = new mongoose.Schema<IRedirectTracking>(
  {
    fullUrl: {
      type: String,
      required: true,
      index: true,
    },
    destinationUrl: {
      type: String,
      required: true,
      index: true,
    },
    queryParams: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    referer: {
      type: String,
      index: true,
    },
    userAgent: {
      type: String,
    },
    clientIp: {
      type: String,
      index: true,
    },
    couponCode: {
      type: String,
      index: true,
    },
    utmSource: {
      type: String,
      index: true,
    },
    utmMedium: {
      type: String,
      index: true,
    },
    utmCampaign: {
      type: String,
      index: true,
    },
    utmContent: {
      type: String,
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    appliedCoupon: {
      type: String,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
)

// Create indexes for better query performance
redirectTrackingSchema.index({ clientIp: 1, userAgent: 1, appliedCoupon: 1 })

const RedirectTracking
  = mongoose.models.RedirectTracking
  || mongoose.model<IRedirectTracking>('RedirectTracking', redirectTrackingSchema, 'redirect_tracking')

export default RedirectTracking
