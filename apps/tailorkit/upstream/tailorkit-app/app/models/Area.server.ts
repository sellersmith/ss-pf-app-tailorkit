import mongoose from '~/bootstrap/db/connect-db.server'

const AreaSchema = new mongoose.Schema(
  {
    _id: String,
    title: String,
    variantId: String,

    /** Preview media is responsible for representing the preview media image */
    previewMedia: {
      id: String,
      originalSrc: {
        type: String,
        index: true,
      },
      order: Number,
      altText: String,
    },

    /** Media config is the selected media from product media */
    mediaConfig: {
      media: {
        originalSrc: {
          type: String,
          index: true,
        },
        altText: { type: String, default: '' },
        width: Number,
        height: Number,
        id: String,
      },
    },

    templateConfig: {
      template: {
        type: String,
        index: true,
        ref: 'Template',
      },
      x: Number,
      y: Number,
      width: Number,
      height: Number,
      rotation: Number,
    },
    // For future
    // cornerRadius: { left: Number, top: Number, right: Number, bottom: Number}
    // templateSetting: {
    //     blendMode: String
    //     objectFit: String,
    //     exposure: Number (-1 -> 1),
    //     contrast: Number (-1 -> 1),
    //     saturation: Number (-1 -> 1)
    //     temperature: Number (-1 -> 1)
    //     tint: Number (-1 -> 1)
    //     highlights: Number (-1 -> 1)
    //     shadows: Number (-1 -> 1)
    // }
    // stroke: Object
    // effects: Object
    // opacity: Number
    // The shop domain that owns the area
    shopDomain: {
      type: String,
      index: true,
      required: true,
    },
  },
  { _id: false, timestamps: true, strict: false }
)

const Area = mongoose.models.Area || mongoose.model('Area', AreaSchema)

export default Area
