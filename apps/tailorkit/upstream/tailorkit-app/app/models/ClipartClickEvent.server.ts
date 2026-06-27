import mongoose from '~/bootstrap/db/connect-db.server'
import type { ClipartClickEventDocument } from './ClipartClickEvent'
import { AssetType, ClickContext } from './ClipartClickEvent'

const ClipartClickEventSchema = new mongoose.Schema<ClipartClickEventDocument>(
  {
    // Core identifiers
    assetId: {
      type: String,
      required: true,
      index: true,
    },
    assetType: {
      type: String,
      required: true,
      enum: Object.values(AssetType),
      default: AssetType.CLIPART,
      index: true,
    },
    shopDomain: {
      type: String,
      required: true,
      index: true,
    },

    // Context tracking
    clickedAt: {
      type: Date,
      required: true,
      index: true,
      default: Date.now,
    },
    context: {
      type: String,
      required: true,
      enum: Object.values(ClickContext),
      index: true,
    },
    category: {
      type: String,
      index: true,
    },
    searchQuery: {
      type: String,
      index: true,
    },
  },
  { timestamps: true }
)

// Compound indexes for efficient queries
ClipartClickEventSchema.index({ assetId: 1, clickedAt: -1 })
ClipartClickEventSchema.index({ shopDomain: 1, clickedAt: -1 })
ClipartClickEventSchema.index({ context: 1, clickedAt: -1 })
ClipartClickEventSchema.index({ assetType: 1, clickedAt: -1 })
ClipartClickEventSchema.index({ shopDomain: 1, assetId: 1, clickedAt: -1 })

const ClipartClickEventModel
  = mongoose.models.ClipartClickEvent
  || mongoose.model<ClipartClickEventDocument>('ClipartClickEvent', ClipartClickEventSchema)

export default ClipartClickEventModel

export async function createClickEvent(
  data: Omit<ClipartClickEventDocument, 'createdAt' | 'updatedAt'>
): Promise<ClipartClickEventDocument | null> {
  try {
    return await ClipartClickEventModel.create(data)
  } catch {
    return null
  }
}
