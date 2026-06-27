import mongoose from '~/bootstrap/db/connect-db.server'
import type { IntegrationDataSaver } from '~/types/integration'

const PrintAreaSchema = new mongoose.Schema(
  {
    _id: String,
    /** Name of print area */
    name: {
      type: String,
      index: true,
    },
    /** Template that connect to print area */
    template: {
      type: String,
      index: true,
      ref: 'Template',
    },
    /**
     * Preview product image for this print area.
     * Stored per print area (not in template) to prevent sharing between products using the same template.
     */
    previewProductImage: {
      type: Object,
      default: null,
    },
    shopDomain: {
      type: String,
      index: true,
      required: true,
    },
  },
  { _id: false, timestamps: true, strict: false }
)

const PrintArea = mongoose.models.PrintArea || mongoose.model('PrintArea', PrintAreaSchema)

export default PrintArea

export async function upsertPrintArea(printArea: IntegrationDataSaver['printAreas'][0], shopDomain: string) {
  return new Promise((resolve, reject) => {
    // Exclude _id from update data to avoid MongoDB ImmutableField error
    const { _id, ...printAreaWithoutId } = printArea
    const updateData = { ...printAreaWithoutId, shopDomain }

    PrintArea.findOneAndUpdate({ _id: printArea._id }, updateData, { upsert: true, new: true })
      .then(value => resolve(value))
      .catch(err => {
        console.error('❌ PrintArea upsert error:', err.message, { printAreaId: printArea._id })
        reject(err)
      })
  })
}
