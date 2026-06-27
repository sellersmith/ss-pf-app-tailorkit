/**
 * ShopAccessLog daily cron job
 *
 * Takes a point-in-time snapshot of all active shops (uninstalledAt: null) once per day.
 * Enables "how many shops were active on date X" queries for retention and churn denominators.
 *
 * Schedule recommendation: 04:00 UTC (11:00 AM Saigon) — quiet window, not overlapping billing cron.
 * Idempotent: unique index { shopDomain, date } prevents duplicates on retry.
 */

import Shop from '~/models/Shop.server'
import ShopAccessLog from '~/models/ShopAccessLog.server'

/**
 * Snapshot all currently installed shops into ShopAccessLog for today.
 * Safe to call multiple times — duplicates are silently ignored via the unique index.
 */
export async function snapshotActiveShops(): Promise<void> {
  // Step 1: Compute today at midnight UTC (no time component)
  const now = new Date()
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

  // Step 2: Idempotency check — skip if snapshot already exists for today
  const existingCount = await ShopAccessLog.countDocuments({ date })
  if (existingCount > 0) {
    console.log(
      `[ShopAccessLog] Snapshot for ${date.toISOString()} already exists (${existingCount} entries). Skipping.`
    )
    return
  }

  // Step 3: Fetch all installed shops (uninstalledAt: null means currently installed)
  const shops = (await (Shop as any)
    .find({ uninstalledAt: null }, { shopDomain: 1, subscription: 1 })
    .lean()) as Array<{ shopDomain: string; subscription: unknown }>

  // Step 4: Build insert documents
  const docs = shops.map(shop => ({
    shopDomain: shop.shopDomain,
    date,
    hasSubscription: shop.subscription !== null,
  }))

  // Step 5: Bulk insert — ordered: false so duplicate key errors are skipped, not fatal
  try {
    await ShopAccessLog.insertMany(docs, { ordered: false })
    console.log(`[ShopAccessLog] Snapshotted ${docs.length} active shops for ${date.toISOString()}`)
  } catch (err: unknown) {
    // Duplicate key errors (E11000) from the unique index are expected on retry and can be ignored.
    // Any other errors are unexpected but should not crash the process.
    console.error('[ShopAccessLog] insertMany error (may include expected duplicate key errors):', err)
    console.log(`[ShopAccessLog] Completed with errors — ${docs.length} shops attempted for ${date.toISOString()}`)
  }
}
