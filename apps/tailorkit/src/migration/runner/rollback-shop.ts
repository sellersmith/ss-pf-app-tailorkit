// Per-shop rollback: wipe every TailorKit app-platform collection for one {shopDomain, generation}.
//
// SCOPE-SAFE: deleteCollection filters on {shopDomain, appId:'tailorkit', subscriptionGeneration}, so
// this can NEVER touch another app's envelopes or another shop — even though the app-platform DB is
// shared across apps. This is why mongorestore --drop is the WRONG revert primitive here (it would nuke
// sibling apps); a scoped deleteMany is the only correct one.
//
// Source-safe by construction: this never opens the native connection. The TailorKit native DB is the
// migration source and is never read or written here — re-migrating after a rollback is always possible.
import type { AppContext } from '../../../../../web/server/src/app-platform/contracts'
import { createMongoScopedAppDataPort } from '../../../../../web/server/src/app-platform/ports/mongo-scoped-app-data-port'
import { tailorkitAppDataCollections } from '../../domain/migration-boundary'
import type { RollbackShopOptions, RollbackShopResult } from './runner.d'

export async function rollbackShopMigration(opts: RollbackShopOptions): Promise<RollbackShopResult> {
  const { shopDomain, appPlatformConnection, generation, dryRun } = opts
  const appData = createMongoScopedAppDataPort({ getConnection: async () => appPlatformConnection })
  const ctx: AppContext = { shopDomain, appId: 'tailorkit', subscriptionGeneration: generation, actor: 'system' }

  const deleted: RollbackShopResult['deleted'] = []
  for (const def of tailorkitAppDataCollections) {
    await appData.registerCollection(ctx, def)
    if (dryRun) {
      // Count what WOULD be deleted via summary, write nothing.
      const summary = await appData.summary(ctx)
      const entry = summary.find(s => s.collection === def.collection)
      deleted.push({ collection: def.collection, deletedCount: entry?.recordCount || 0 })
      continue
    }
    const result = await appData.deleteCollection(ctx, def.collection)
    deleted.push({ collection: def.collection, deletedCount: result.deletedCount })
  }

  const totalDeleted = deleted.reduce((sum, d) => sum + d.deletedCount, 0)
  return { shopDomain, generation, deleted, totalDeleted }
}
