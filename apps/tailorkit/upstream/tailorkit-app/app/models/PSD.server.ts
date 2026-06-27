import mongoose from '~/bootstrap/db/connect-db.server'

const PSDSchema = new mongoose.Schema(
  {
    _id: String,
    name: {
      type: String,
    },
    layers: [
      {
        type: String,
        ref: 'Layer',
      },
    ],
    header: {},
    image: {
      width: Number,
      height: Number,
    },
    // The shop domain that owns the PSD
    shopDomain: {
      type: String,
      index: true,
      required: true,
    },
    deletedAt: {
      type: Date,
      index: true,
      default: null,
    },
  },
  { _id: false, timestamps: true, strict: false }
)

const PSD = mongoose.models.PSD || mongoose.model('PSD', PSDSchema)

export default PSD
