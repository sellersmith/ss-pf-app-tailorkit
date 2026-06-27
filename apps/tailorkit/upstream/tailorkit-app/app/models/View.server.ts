import mongoose from '~/bootstrap/db/connect-db.server'

const ViewSchema = new mongoose.Schema(
  {
    path: {
      type: String,
      index: true,
      required: true,
    },
    name: {
      type: String,
      index: true,
      required: true,
    },
    shopDomain: {
      type: String,
      index: true,
      required: true,
    },
    filters: Object,
  },
  {
    timestamps: true,
  }
)

const View = mongoose.models.View || mongoose.model('View', ViewSchema)

export default View
