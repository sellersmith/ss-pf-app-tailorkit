import mongoose from '~/bootstrap/db/connect-db.server'

const ImageSchema = new mongoose.Schema(
  {
    _id: String,
    originalSrc: String,
    src: {
      type: String,
      index: true,
    },
    width: Number,
    height: Number,
    opacity: Number,
    channelData: {},
    channelLength: Number,
    channelsInfo: [{}],
    hasMask: Boolean,
    clipGroup: {
      absoluteWidth: Number,
      absoluteHeight: Number,
      absoluteX: Number,
      absoluteY: Number,
      rotation: Number,
      x: Number,
      y: Number,
      width: Number,
      height: Number,
    },
    generativeOptions: {
      type: Object,
      default: {},
    },
    // The shop domain that owns the image
    shopDomain: {
      type: String,
      index: true,
      required: true,
    },
  },
  { _id: false, timestamps: true, strict: false }
)

const Image = mongoose.models.Image || mongoose.model('Image', ImageSchema)

export default Image
