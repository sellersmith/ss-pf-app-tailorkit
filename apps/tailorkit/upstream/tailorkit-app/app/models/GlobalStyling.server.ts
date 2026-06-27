import type { AdminApiContext } from '@shopify/shopify-app-remix/server'
import mongoose from '~/bootstrap/db/connect-db.server'
import type { GlobalStylingDocument } from './GlobalStyling'
import {
  createDefaultGlobalStyling,
  defaultCheckboxStyling,
  type GlobalStyling as GlobalStylingConfig,
} from '~/types/global-styling'
import { updateGlobalStylingToAppMetafields } from '~/routes/api.preferences/fns.server'

const GlobalStylingSchema = new mongoose.Schema<GlobalStylingDocument>(
  {
    shopDomain: {
      type: String,
      index: true,
      unique: true,
      required: true,
    },
    styling: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {},
    },
  },
  { timestamps: true }
)

const GlobalStylingModel
  = (mongoose.models.GlobalStyling as mongoose.Model<GlobalStylingDocument>)
  || mongoose.model<GlobalStylingDocument>('GlobalStyling', GlobalStylingSchema)

export default GlobalStylingModel

export async function getGlobalStyling(shopDomain: string): Promise<GlobalStylingDocument | null> {
  return GlobalStylingModel.findOne({ shopDomain }).lean()
}

export async function saveGlobalStyling(shopDomain: string, styling: GlobalStylingConfig) {
  await GlobalStylingModel.updateOne(
    { shopDomain },
    {
      $set: {
        styling,
      },
    },
    { upsert: true }
  )
}

/**
 * Initialize GlobalStyling with defaults if it doesn't exist.
 * Also handles migration for existing shops by adding checkbox styling if missing.
 * Always syncs to Shopify metafield to ensure consistency.
 *
 * @param shopDomain - The shop domain
 * @param admin - Shopify Admin API context for metafield sync
 */
export async function initGlobalStylingIfNotExists(shopDomain: string, admin: AdminApiContext): Promise<void> {
  // Use findOneAndUpdate with $setOnInsert for atomic read-then-update operation
  const result = await GlobalStylingModel.findOneAndUpdate(
    { shopDomain },
    {
      $setOnInsert: {
        styling: createDefaultGlobalStyling(),
      },
    },
    { upsert: true, new: true, includeResultMetadata: true }
  )

  const wasInserted = !result.lastErrorObject?.updatedExisting
  let styling = result.value?.styling as GlobalStylingConfig

  if (wasInserted) {
    // New document was created with defaults
    console.log('[GlobalStyling] Created new GlobalStyling with checkbox defaults for:', shopDomain)
  } else if (!styling?.checkbox) {
    // Migration: add checkbox styling to existing records
    styling = { ...styling, checkbox: defaultCheckboxStyling }
    await GlobalStylingModel.updateOne({ shopDomain }, { $set: { styling } })
    console.log('[GlobalStyling] Added checkbox styling to existing GlobalStyling for:', shopDomain)
  } else {
    console.log('[GlobalStyling] Synced existing GlobalStyling to Shopify metafield for:', shopDomain)
  }

  // Always sync to Shopify metafield to ensure consistency
  await updateGlobalStylingToAppMetafields(admin, styling)
}
