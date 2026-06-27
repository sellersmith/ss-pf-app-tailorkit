import mongoose from '~/bootstrap/db/connect-db.server'

const MaskSchema = new mongoose.Schema(
  {
    _id: String,
    bottom: Number,
    left: Number,
    right: Number,
    top: Number,
    size: Number,
    relative: Boolean,
    defaultColor: Number,
    disabled: Boolean,
    external: Boolean,
    flags: Number,
    invert: Boolean,
    width: Number,
    height: Number,
    // The shop domain that owns the mask
    shopDomain: {
      type: String,
      index: true,
      required: true,
    },
  },
  { _id: false, timestamps: true, strict: false }
)

const Mask = mongoose.models.Mask || mongoose.model('Mask', MaskSchema)

export default Mask
