import mongoose from '~/bootstrap/db/connect-db.server'
import type { CheckboxDocument } from '~/types/checkbox'
import { ETriggerProductsType, EPlacementType } from '~/enums/checkbox'

const UpsellProductSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      required: true,
    },
    variantId: {
      type: String,
      required: true,
    },
  },
  { _id: false }
)

const CheckboxContentSchema = new mongoose.Schema(
  {
    contentType: {
      type: String,
      enum: ['heading_only', 'description_only', 'heading_and_description'],
      default: 'heading_only',
    },
    heading: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    imageUrl: {
      type: String,
      default: '',
    },
    showPrice: {
      type: Boolean,
      default: false,
    },
    showComparedPrice: {
      type: Boolean,
      default: false,
    },
    preCheck: {
      type: Boolean,
      default: false,
    },
    showVariantSelector: {
      type: Boolean,
      default: false,
    },
    showFeaturedImage: {
      type: Boolean,
      default: false,
    },
    showQuantitySelector: {
      type: Boolean,
      default: false,
    },
    showPersonalizeButton: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
)

const PopupSchema = new mongoose.Schema(
  {
    showPopup: {
      type: Boolean,
      default: false,
    },
    heading: {
      type: String,
      default: 'This is your popup heading.',
    },
    description: {
      type: String,
      default: 'This is your popup description.',
    },
  },
  { _id: false }
)

const CheckboxStyleSchema = new mongoose.Schema(
  {
    checkboxType: {
      type: String,
      default: '0px',
    },
    tickIcon: {
      type: String,
      default: '#FFFFFF',
    },
    defaultBackground: {
      type: String,
      default: '#FFFFFF',
    },
    activeBackground: {
      type: String,
      default: '#005EC2',
    },
    defaultBorder: {
      type: String,
      default: '#8A8A8A',
    },
    activeBorder: {
      type: String,
      default: '#FFFFFF',
    },
  },
  { _id: false }
)

const CheckboxSchema = new mongoose.Schema<CheckboxDocument>(
  {
    shopDomain: {
      type: String,
      required: true,
      index: true,
    },
    checkboxMetafieldId: {
      type: String,
      default: null,
    },
    title: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: false,
      index: true,
    },
    checkboxContent: {
      type: CheckboxContentSchema,
      default: () => ({}),
    },
    targetProducts: {
      type: [String],
      default: [],
    },
    triggerProductsType: {
      type: String,
      enum: [...Object.values(ETriggerProductsType), null],
      default: null,
      index: true,
    },
    upsellProducts: {
      type: [UpsellProductSchema],
      default: [],
    },
    excludeUpsellProducts: {
      type: Boolean,
      default: false,
    },
    excludeTriggerProductsType: {
      type: String,
      enum: [...Object.values(ETriggerProductsType), null],
      default: null,
    },
    excludeTriggerProducts: {
      type: [String],
      default: [],
    },
    checkboxStyle: {
      type: CheckboxStyleSchema,
      default: null,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    popup: {
      type: PopupSchema,
      default: () => ({}),
    },
    typePlacement: {
      type: String,
      enum: [...Object.values(EPlacementType), null],
      default: null,
      index: true,
    },
    hideCartDrawer: {
      type: Boolean,
      default: false,
    },
    canRemoveWhenTriggersCleared: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true }
)

// Compound indexes for common queries
CheckboxSchema.index({ shopDomain: 1, isActive: 1 })
CheckboxSchema.index({ shopDomain: 1, typePlacement: 1 })
CheckboxSchema.index({ shopDomain: 1, deletedAt: 1 })

export const CheckboxModel = mongoose.models.Checkbox || mongoose.model<CheckboxDocument>('Checkbox', CheckboxSchema)

export default CheckboxModel
