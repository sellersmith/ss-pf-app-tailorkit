import mongoose from '~/bootstrap/db/connect-db.server'
import type { IntegrationDataSaver } from '~/types/integration'
import type { VariantIntegrationDocument } from './VariantIntegration'
import type { ShopDocument } from './Shop'
import { convertCurrencyToDollar } from '~/utils/exchange-rates'

const VariantIntegrationSchema = new mongoose.Schema<VariantIntegrationDocument>(
  {
    _id: String,
    id: {
      type: String,
      index: true,
    },
    productId: {
      type: String,
      index: true,
      required: true,
    },
    printAreas: [
      {
        type: String,
        ref: 'PrintArea',
        index: true,
      },
    ],
    mockup: {
      type: String,
      index: true,
      required: true,
      ref: 'Mockup',
    },
    productActivated: {
      type: Boolean,
    },
    title: {
      type: String,
      index: true,
    },
    displayName: {
      type: String,
    },
    price: {
      type: String,
      default: '0',
    },
    priceInUSD: {
      type: Number,
      default: 0,
    },
    compareAtPrice: {
      type: String,
      default: '0',
    },
    compareAtPriceInUSD: {
      type: Number,
      default: 0,
    },
    sku: {
      type: String,
    },
    metafields: {
      type: [Object],
      default: [],
      index: true,
    },
    shineOnMapping: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    unavailable: {
      type: Boolean,
    },
    shopDomain: {
      type: String,
      index: true,
      required: true,
    },
  },
  { _id: false, timestamps: true }
)

const VariantIntegration
  = mongoose.models.VariantIntegration || mongoose.model('VariantIntegration', VariantIntegrationSchema)

export default VariantIntegration

export async function upsertVariantIntegration(
  variantIntegration: IntegrationDataSaver['variants'][0],
  shopDomain: string,
  shopData: ShopDocument
) {
  return new Promise(async (resolve, reject) => {
    // Convert price and compareAtPrice to number in order to potentially predict each store can gain how many attribute sales
    const price = Number(variantIntegration.price) || 0
    const compareAtPrice = Number(variantIntegration.compareAtPrice) || 0

    // Convert price and compareAtPrice from shop currency to USD
    const shopCurrency = shopData.shopConfig.currency
    const [priceInUSD, compareAtPriceInUSD] = await Promise.all([
      convertCurrencyToDollar(shopCurrency, price),
      convertCurrencyToDollar(shopCurrency, compareAtPrice),
    ])

    // Build update so that `_id` is ONLY set on insert to avoid ImmutableField errors
    const { _id, ...variantIntegrationWithoutId } = variantIntegration
    const update = {
      $set: {
        ...variantIntegrationWithoutId,
        priceInUSD,
        compareAtPriceInUSD,
        shopDomain,
      },
      // Ensure first insert uses the provided string _id; do not modify on updates
      ...(typeof _id === 'string' && _id
        ? { $setOnInsert: { _id } }
        : { $setOnInsert: { _id: variantIntegration.id } }),
    }

    VariantIntegration.findOneAndUpdate({ id: variantIntegration.id, shopDomain }, update, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    })
      .then(value => resolve(value))
      .catch(err => {
        console.error('❌ VariantIntegration upsert error:', err.message, {
          variantIntegrationId: variantIntegration.id,
        })
        reject(err)
      })
  })
}

export async function deleteProductActivatedByVariantId(id: string) {
  return new Promise((resolve, reject) => {
    VariantIntegration.findOneAndUpdate(
      { id }, // Query to find the document by ID
      { $unset: { productActivated: 1 } }, // Unset removes the field
      { new: true } // Return the updated document
    )
      .then(updatedDocument => resolve(updatedDocument))
      .catch(error => reject(error))
  })
}

/**
 * Gets integrated variants for a shop domain
 * @param shopDomain - Shop domain to get variants for
 */
export async function getProductVariantsIntegrated(shopDomain?: string): Promise<Record<string, string[]>> {
  if (!shopDomain) return {}

  const variants = await VariantIntegration.find({ shopDomain }, { id: 1, productId: 1, _id: 0 })

  // Pre-process variants into a map for O(1) lookup
  return variants.reduce((acc: Record<string, string[]>, variant: any) => {
    if (!acc[variant.productId]) {
      acc[variant.productId] = [variant.id]
    } else {
      acc[variant.productId].push(variant.id)
    }
    return acc
  }, {})
}

/**
 * Find ObjectId documents, delete them, then upsert with string IDs
 * This approach is much simpler and reuses existing upsert logic
 */
export async function migrateVariantIntegrationToObjectIdToStringId() {
  console.log('🔄 Starting VariantIntegration ObjectId to String migration...')

  if (process.env.MIGRATE_VARIANT_INTEGRATION_TO_OBJECT_ID_TO_STRING_ID !== 'yes') {
    try {
      // Find all variants with ObjectId _id
      const objectIdVariants = await VariantIntegration.find({
        _id: { $type: 'objectId' },
      })

      if (objectIdVariants.length === 0) {
        console.log('No VariantIntegration documents with ObjectId _id found')
        return
      }

      console.log(`Found ${objectIdVariants.length} VariantIntegration documents with ObjectId _id`)

      // Process in batches to avoid memory issues
      const BATCH_SIZE = 500
      let migratedCount = 0
      let errorCount = 0

      for (let i = 0; i < objectIdVariants.length; i += BATCH_SIZE) {
        const batch = objectIdVariants.slice(i, i + BATCH_SIZE)

        // Step 1: Store ONLY ObjectId variants data for recreation with string IDs
        const objectIdVariantsToRecreate = batch
          .map(variant => {
            // Verify this is actually an ObjectId variant
            if (!mongoose.Types.ObjectId.isValid(variant._id)) {
              console.warn(`Skipping non-ObjectId variant: ${variant._id}`)
              return null
            }

            const variantData = variant.toObject()
            // Fix: Remove __v field that can cause issues
            delete variantData.__v
            const originalObjectId = variant._id

            // Convert ObjectId _id to string _id for recreation
            variantData._id = originalObjectId.toString()

            return {
              data: variantData,
              originalObjectId,
              stringId: originalObjectId.toString(),
            }
          })
          .filter(item => item !== null)

        console.log(`Preparing to migrate ${objectIdVariantsToRecreate.length} ObjectId variants to string IDs`)

        // Step 2: Delete ALL ObjectId variants in this batch using original ObjectId values
        const objectIds = batch.map(variant => variant._id) // Use original ObjectId values directly

        await VariantIntegration.deleteMany({
          _id: { $type: 'objectId' },
        })

        // Step 2.1: Verify all ObjectId variants are actually deleted
        const remainingObjectIdCount = await VariantIntegration.countDocuments({
          _id: { $in: objectIds },
        })

        if (remainingObjectIdCount > 0) {
          errorCount += remainingObjectIdCount
          continue
        }

        // Step 3: Recreate ONLY the ObjectId variants with string IDs
        if (objectIdVariantsToRecreate.length > 0) {
          // Fix: Use insertMany instead of bulkWrite for simplicity
          try {
            const documentsToInsert = objectIdVariantsToRecreate.map(({ data }) => data)
            const insertResult = await VariantIntegration.insertMany(documentsToInsert, {
              ordered: false,
            })
            migratedCount += insertResult.length
            console.log(`✅ Successfully recreated ${insertResult.length} variants with string IDs`)
          } catch (insertError) {
            console.error('Insert failed, trying individual inserts...', insertError)

            // Fallback: Insert individually if bulk fails
            for (const { data, stringId } of objectIdVariantsToRecreate) {
              try {
                await VariantIntegration.create(data)
                migratedCount++
                console.log(`✅ Individually recreated variant with string ID: ${stringId}`)
              } catch (individualError) {
                console.error(`❌ Failed to recreate variant ${stringId}:`, individualError)
                errorCount++
              }
            }
          }
        }
      }

      console.log(`Migration completed: ${migratedCount} variants migrated, ${errorCount} errors`)
    } catch (error) {
      console.error('Error during VariantIntegration migration:', error)
      console.log('Migration failed, but application will continue.')
    }

    process.env.MIGRATE_VARIANT_INTEGRATION_TO_OBJECT_ID_TO_STRING_ID = 'yes'
  }
}

// serverInitiator.addInitiator(migrateVariantIntegrationToObjectIdToStringId)
