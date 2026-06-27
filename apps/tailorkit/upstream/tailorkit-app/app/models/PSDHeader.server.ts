import mongoose from '~/bootstrap/db/connect-db.server'

const PSDHeaderSchema = new mongoose.Schema(
  {
    _id: String,
    name: {
      type: String,
    },
    layer: [
      {
        type: String,
        ref: 'Layer',
      },
    ],
    header: {
      type: String,
      ref: 'PSDHeader',
    },
    image: {
      type: String,
      ref: 'Image',
    },
    // The shop domain that owns the PSD header
    shopDomain: {
      type: String,
      index: true,
      required: true,
    },
  },
  {
    timestamps: true,
  }
)

const PSDHeader = mongoose.models.PSDHeader || mongoose.model('PSDHeader', PSDHeaderSchema)

export default PSDHeader
