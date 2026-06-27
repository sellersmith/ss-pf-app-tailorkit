import mongoose from '~/bootstrap/db/connect-db.server'
import type { LayerIntegration as LayerIntegrationType } from '~/types/integration'

type LayerIntegrationDocument = Partial<LayerIntegrationType> & {
  _id: string
  name: string
  layerId: string
  type: 'template' | 'image' | 'mask'
  width?: number
  height?: number
  x?: number
  y?: number
  rotation?: number
  mask?: {
    width: Number
    height: Number
    x: Number
    y: Number
    rotation: Number
  }
  printAreaId: string
  data?: {
    src?: string
    alt?: string
    templateId?: string
  }
  shopDomain: string
}

const LayerIntegrationSchema = new mongoose.Schema<Omit<LayerIntegrationDocument, ''>>(
  {
    _id: String,
    name: {
      type: String,
      index: true,
    },
    layerId: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
    },
    width: Number,
    height: Number,
    x: Number,
    y: Number,
    rotation: Number,
    visible: {
      type: Boolean,
      default: true,
    },
    mask: {
      width: Number,
      height: Number,
      x: Number,
      y: Number,
      rotation: Number,
    },
    printAreaId: {
      type: String,
      index: true,
      ref: 'PrintArea',
    },
    data: {
      src: {
        type: String,
        index: true,
      },
      alt: String,
      templateId: {
        type: String,
        ref: 'Template',
      },
    },
    shopDomain: {
      type: String,
      index: true,
      required: true,
    },
  },
  { _id: false, timestamps: true }
)

// Create compound index for nested templateId
LayerIntegrationSchema.index({ 'data.templateId': 1 })

const LayerIntegration = mongoose.models.LayerIntegration || mongoose.model('LayerIntegration', LayerIntegrationSchema)

export default LayerIntegration

export async function upsertLayerIntegration(layerIntegration: LayerIntegrationType, shopDomain: string) {
  return new Promise((resolve, reject) => {
    // Exclude _id from update data to avoid MongoDB ImmutableField error
    const { _id, ...layerIntegrationWithoutId } = layerIntegration
    const updateData = { ...layerIntegrationWithoutId, shopDomain }

    LayerIntegration.findOneAndUpdate({ _id: layerIntegration._id }, updateData, { upsert: true, new: true })
      .then(value => resolve(value))
      .catch(err => {
        console.error('❌ LayerIntegration upsert error:', err.message, { layerIntegrationId: layerIntegration._id })
        reject(err)
      })
  })
}
