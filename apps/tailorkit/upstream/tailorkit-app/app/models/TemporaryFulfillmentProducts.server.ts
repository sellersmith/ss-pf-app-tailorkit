import mongoose from 'mongoose'
import type { TemporaryFulfillmentProductsDocument } from './TemporaryFulfillmentProducts'

const temporaryFulfillmentProductsSchema = new mongoose.Schema<TemporaryFulfillmentProductsDocument>(
  {
    shopDomain: {
      type: String,
      index: true,
      required: true,
    },
    data: {
      products: {
        type: [String],
        default: [],
      },
      confirmChoosePrintifyChoice: {
        type: Boolean,
        default: false,
      },
      showUnderstandAboutProviderModal: {
        type: Boolean,
        default: true,
      },
    },
    providerId: {
      type: String,
      index: true,
      required: true,
      ref: 'Provider',
    },
  },
  { timestamps: true }
)

const TemporaryFulfillmentProducts
  = mongoose.models.TemporaryFulfillmentProducts
  || mongoose.model<TemporaryFulfillmentProductsDocument>(
    'TemporaryFulfillmentProducts',
    temporaryFulfillmentProductsSchema,
    'temporary_fulfillment_products'
  )

export default TemporaryFulfillmentProducts
