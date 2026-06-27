import mongoose from 'mongoose'
import type { ProviderIntegrationDocument } from './ProviderIntegration'

const providerIntegrationSchema = new mongoose.Schema<ProviderIntegrationDocument>(
  {
    shopDomain: {
      type: String,
      index: true,
      required: true,
    },
    apiToken: {
      type: String,
      index: true,
      required: true,
    },
    shopId: {
      type: String,
      index: true,
      required: true,
    },
    autoFulfill: {
      type: Boolean,
      index: true,
      default: false,
    },
    providerId: {
      type: String,
      index: true,
      required: true,
      ref: 'Provider',
    },
    connectionStatus: {
      type: String,
      enum: ['connected', 'disconnected'],
    },
  },
  { timestamps: true }
)

const ProviderIntegration
  = mongoose.models.ProviderIntegration
  || mongoose.model<ProviderIntegrationDocument>('ProviderIntegration', providerIntegrationSchema, 'provider_integrations')

export default ProviderIntegration

export async function getProviderIntegrationByShopId(shop_id: string) {
  const providerIntegration = await ProviderIntegration.findOne({
    $or: [
      { shopId: shop_id }, // Matches directly
      { shopId: Number(shop_id) }, // If `shop_id` is string, try matching it as a number
      { shopId: String(shop_id) }, // If `shop_id` is number, try matching it as a string
    ],
  })

  return providerIntegration
}
