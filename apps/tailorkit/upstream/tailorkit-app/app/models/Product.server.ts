import mongoose from '~/bootstrap/db/connect-db.server'

const CountFieldSchema = {
  count: Number,
  precision: {
    type: String,
    enum: ['AT_LEAST', 'EXACT'],
  },
}

const ImageFieldSchema = {
  url: String,
  width: Number,
  height: Number,
  altText: String,
}

const PriceFieldSchema = {
  amount: Number,
  currencyCode: String,
}

const ProductSchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true,
  },
  tags: {
    type: [String],
    index: true,
  },
  title: {
    type: String,
    index: true,
  },
  handle: {
    type: String,
    index: true,
  },
  status: {
    type: String,
    index: true,
    enum: ['ACTIVE', 'ARCHIVED', 'DRAFT'],
  },
  vendor: {
    type: String,
    index: true,
  },
  createdAt: {
    type: Date,
    index: true,
  },
  updatedAt: {
    type: Date,
    index: true,
  },
  publishedAt: {
    type: Date,
    index: true,
  },
  productType: {
    type: String,
    index: true,
  },
  description: {
    type: String,
    index: true,
  },
  onlineStoreUrl: String,
  templateSuffix: String,
  totalInventory: Number,
  tracksInventory: Boolean,
  legacyResourceId: Number,
  requiresSellingPlan: Boolean,
  hasOnlyDefaultVariant: Boolean,
  hasOutOfStockVariants: Boolean,
  onlineStorePreviewUrl: {
    type: String,
    index: true,
  },
  seo: {
    title: String,
    description: String,
  },
  category: {
    name: {
      type: String,
      index: true,
    },
    fullName: {
      type: String,
      index: true,
    },
  },
  images: [ImageFieldSchema],
  mediaCount: CountFieldSchema,
  featuredImage: ImageFieldSchema,
  featuredMedia: {
    alt: String,
    preview: {
      image: ImageFieldSchema,
    },
  },
  variantsCount: CountFieldSchema,
  priceRangeV2: {
    maxVariantPrice: PriceFieldSchema,
    minVariantPrice: PriceFieldSchema,
  },
  compareAtPriceRange: {
    maxVariantCompareAtPrice: PriceFieldSchema,
    minVariantCompareAtPrice: PriceFieldSchema,
  },
  sellingPlanGroupsCount: CountFieldSchema,
  collections: [
    {
      id: {
        type: String,
        index: true,
      },
      title: {
        type: String,
        index: true,
      },
      handle: {
        type: String,
        index: true,
      },
      legacyResourceId: {
        type: Number,
        index: true,
      },
      image: ImageFieldSchema,
    },
  ],
  variants: [
    {
      id: {
        type: String,
        index: true,
      },
      price: {
        type: Number,
        index: true,
      },
      title: {
        type: String,
        index: true,
      },
      displayName: {
        type: String,
        index: true,
      },
      legacyResourceId: {
        type: Number,
        index: true,
      },
      image: ImageFieldSchema,
      selectedOptions: {
        name: String,
        value: String,
      },
    },
  ],
  // The shop domain that owns the product
  shopDomain: {
    type: String,
    index: true,
    required: true,
  },
  productImportedFrom: {
    type: String,
    index: true,
  },
  printArea: {
    type: String,
    ref: 'PrintArea',
  },
})

/**
 * @deprecated No longer saves products information of mechants
 */
const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema)

export default Product
