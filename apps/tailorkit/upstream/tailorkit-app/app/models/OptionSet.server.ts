import { Schema } from 'mongoose'
import mongoose from '~/bootstrap/db/connect-db.server'
import { EOptionSet } from '~/types/psd'
import type { OptionSetDocument } from './OptionSet'

const OptionSetSchema = new mongoose.Schema<Omit<OptionSetDocument, 'id'>>(
  {
    _id: String,
    type: {
      type: String,
      index: true,
      enum: Object.values(EOptionSet), // Restrict to enum values
      required: true,
    },
    label: {
      type: String,
      default: '',
      index: true,
    },
    labelOnStoreFront: {
      type: String,
      default: '',
    },
    values: [mongoose.SchemaTypes.Mixed],
    data: {
      type: Schema.Types.Mixed, // Use Mixed to store any sub-schema dynamically
      index: true,
      required: false,
    },
    editingMode: {
      type: String,
      enum: ['sync', 'individual'],
      default: 'sync',
    },
    additionalPricingEnabled: {
      type: Boolean,
    },
    // Original base layer state when entering individual mode (for image options)
    originalBaseState: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    // Original clipGroup state when entering individual mode (for image options)
    originalClipGroup: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    // The shop domain that owns the option set
    shopDomain: {
      type: String,
      index: true,
      required: true,
    },
  },
  { timestamps: true }
)

const OptionSet = mongoose.models.OptionSet || mongoose.model('OptionSet', OptionSetSchema)

export default OptionSet
