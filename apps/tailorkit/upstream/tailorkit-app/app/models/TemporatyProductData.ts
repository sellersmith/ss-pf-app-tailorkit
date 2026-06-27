import mongoose from 'mongoose'
import type { TemporaryProduct } from './TemporaryFulfillmentProducts'

const temporaryProductDataSchema = new mongoose.Schema<TemporaryProduct>(
  {
    shopDomain: {
      type: String,
      index: true,
      required: true,
    },
    productId: {
      type: String,
      index: true,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    images: [
      {
        type: String,
        required: true,
      },
    ],
    productProviderId: {
      type: String,
      index: true,
      required: true,
    },
    variants: [
      {
        id: {
          type: String,
          index: true,
          required: true,
        },
        title: {
          type: String,
          index: true,
          required: true,
        },
        cost: {
          type: Number,
          index: true,
          required: true,
          default: 0,
        },
        price: {
          type: Number,
          index: true,
          required: true,
          default: 0,
        },
        profitMargin: {
          type: Number,
          index: true,
          default: 0,
        },
        active: {
          type: Boolean,
          index: true,
          default: true,
        },
        options: {
          type: Object,
          default: {},
        },
        placeholders: {
          type: [
            {
              position: {
                type: String,
              },
              width: {
                type: Number,
              },
              height: {
                type: Number,
              },
            },
          ],
          default: [],
        },
      },
    ],
    providerId: {
      type: String,
      index: true,
      required: true,
      ref: 'Provider',
    },
    baseProfitMargin: {
      type: Number,
      index: true,
      default: 0,
    },
  },
  { timestamps: true }
)

const TemporaryProductData
  = mongoose.models.TemporaryProductData
  || mongoose.model<TemporaryProduct>('TemporaryProductData', temporaryProductDataSchema, 'temporary_product_data')

export default TemporaryProductData
