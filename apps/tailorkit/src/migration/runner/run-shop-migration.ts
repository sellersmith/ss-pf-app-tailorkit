// Per-shop orchestrator: read native graph → build composite → repo.update → data-only published patch,
// then write standalone records. Per-integration try/catch so one bad integration never aborts the shop.
// Honors dryRun (count + skip writes). assertFresh NO-OPS because we never pass getCurrentSubscriptionGeneration.
import type { AppContext } from '../../../../../web/server/src/app-platform/contracts'
import { createMongoScopedAppDataPort } from '../../../../../web/server/src/app-platform/ports/mongo-scoped-app-data-port'
import { tailorkitAppDataCollections } from '../../domain/migration-boundary'
import {
  TAILORKIT_INTEGRATION_COLLECTION,
  TAILORKIT_STOREFRONT_SNAPSHOT_COLLECTION,
} from '../../domain/product-personalizer'
import {
  readIntegrationGraph,
  readOptionSets,
  readUserJourneys,
  readPersonalizerSettings,
  readGlobalStyling,
  createOrdersCursor,
} from '../native/read'
import { writeComposite, resetPublishedFieldsForMigration } from './write-composite'
import { mapOptionSet } from '../standalone/map-option-set'
import { mapUserJourney } from '../standalone/map-user-journey'
import { mapPersonalizerSettings } from '../standalone/map-personalizer-settings'
import { mapGlobalStyling } from '../standalone/map-global-styling'
import { mapOrdersBatched } from '../standalone/map-order'
import type { MigrationCounts, MigrationSkipped, RunShopMigrationOptions, RunShopMigrationResult } from './runner.d'

export async function runShopMigration(opts: RunShopMigrationOptions): Promise<RunShopMigrationResult> {
  const { shopDomain, nativeConnection, appPlatformConnection, generation, dryRun } = opts
  const counts: MigrationCounts = { integrations: 0, variants: 0, optionSets: 0, orders: 0, userJourneys: 0, settings: 0 }
  const skipped: MigrationSkipped = { variants: 0, mockups: 0 }
  const errors: RunShopMigrationResult['errors'] = []
  const logIntegrations = process.env.TAILORKIT_MIGRATION_LOG_INTEGRATIONS === '1'
  const skipExisting = process.env.TAILORKIT_MIGRATION_SKIP_EXISTING === '1'

  // Native readers (read-only).
  const [integrationGraphs, optionSets, userJourneys, personalizer, globalStyling] = await Promise.all([
    readIntegrationGraph(nativeConnection, shopDomain),
    readOptionSets(nativeConnection, shopDomain),
    readUserJourneys(nativeConnection, shopDomain),
    readPersonalizerSettings(nativeConnection, shopDomain),
    readGlobalStyling(nativeConnection, shopDomain),
  ])

  if (dryRun) {
    counts.integrations = integrationGraphs.length
    counts.variants = integrationGraphs.reduce((sum, g) => sum + (g.variantRefs || []).length, 0)
    counts.optionSets = optionSets.length
    counts.userJourneys = userJourneys.length
    counts.settings = (personalizer?.appConfig && Object.keys(((personalizer.appConfig as Record<string, unknown>).appMetafields as Record<string, unknown>) || {}).length ? 1 : 0)
      + (globalStyling?.styling && Object.keys(globalStyling.styling).length ? 1 : 0)
    return { shopDomain, counts, skipped, errors }
  }

  // Write port: real mongo scoped port, no getCurrentSubscriptionGeneration → assertFresh no-ops.
  const appData = createMongoScopedAppDataPort({ getConnection: async () => appPlatformConnection, slowQueryMs: 100000 })
  // Register collections up front (idempotent per port instance).
  const ctx: AppContext = { shopDomain, appId: 'tailorkit', subscriptionGeneration: generation, actor: 'system' }
  for (const def of tailorkitAppDataCollections) {
    await appData.registerCollection(ctx, def)
  }

  // Per-integration composite write (try/catch — one bad integ never aborts the shop).
  for (const [index, graph] of integrationGraphs.entries()) {
    if (logIntegrations) console.log(`[migrate] integration ${shopDomain} ${index + 1}/${integrationGraphs.length} ${graph._id}`)
    try {
      if (skipExisting) {
        const [existingRecord, existingSnapshot] = await Promise.all([
          appData.get(ctx, TAILORKIT_INTEGRATION_COLLECTION, graph._id),
          appData.get(ctx, TAILORKIT_STOREFRONT_SNAPSHOT_COLLECTION, graph._id),
        ])
        if (existingRecord && existingSnapshot) {
          counts.integrations += 1
          counts.variants += (graph.variantRefs || []).length
          if (logIntegrations) console.log(`[migrate] integration-skip-existing ${shopDomain} ${graph._id}`)
          continue
        }
      }
      const { record, skippedVariants, skippedMockups } = await writeComposite(graph, appData, ctx)
      counts.integrations += 1
      counts.variants += (graph.variantRefs || []).length
      skipped.variants += skippedVariants.length
      skipped.mockups += skippedMockups.length
      await resetPublishedFieldsForMigration(appData, ctx, record, graph)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      errors.push({ integrationId: graph._id, message })
      if (logIntegrations) console.log(`[migrate] integration-error ${shopDomain} ${graph._id}: ${message}`)
    }
  }

  // Standalone records (option-sets, journeys, settings) — each write is its own try/catch.
  for (const native of optionSets) {
    try {
      const r = mapOptionSet(shopDomain, native)
      if (r) await appData.put(ctx, r.collection, r.id, r.value)
      counts.optionSets += 1
    } catch (e) {
      errors.push({ integrationId: `option-set:${(native as { _id?: string })?._id}`, message: e instanceof Error ? e.message : String(e) })
    }
  }
  for (const native of userJourneys) {
    try {
      const r = mapUserJourney(shopDomain, native)
      if (r) await appData.put(ctx, r.collection, r.id, r.value)
      counts.userJourneys += 1
    } catch (e) {
      errors.push({ integrationId: `user-journey:${(native as { _id?: string })?._id}`, message: e instanceof Error ? e.message : String(e) })
    }
  }
  try {
    const r = mapPersonalizerSettings(personalizer)
    if (r) {
      await appData.put(ctx, r.collection, r.id, r.value)
      counts.settings += 1
    }
  } catch (e) {
    errors.push({ integrationId: 'personalizer-settings', message: e instanceof Error ? e.message : String(e) })
  }
  try {
    const r = mapGlobalStyling(globalStyling)
    if (r) {
      await appData.put(ctx, r.collection, r.id, r.value)
      counts.settings += 1
    }
  } catch (e) {
    errors.push({ integrationId: 'global-styling', message: e instanceof Error ? e.message : String(e) })
  }

  // Orders: streamed in batches to bound memory.
  const orderCursor = createOrdersCursor(nativeConnection, shopDomain)
  for await (const batch of mapOrdersBatched(shopDomain, orderCursor, 200)) {
    for (const r of batch) {
      try {
        await appData.put(ctx, r.collection, r.id, r.value)
        counts.orders += 1
      } catch (e) {
        errors.push({ integrationId: `order:${r.id}`, message: e instanceof Error ? e.message : String(e) })
      }
    }
  }

  return { shopDomain, counts, skipped, errors }
}
