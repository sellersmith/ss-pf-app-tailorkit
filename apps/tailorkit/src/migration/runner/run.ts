// TailorKit standalone → app-platform migration CLI.
//
// Usage:
//   node dist/apps/tailorkit/migration/runner/run.js --shop=<domain>          # migrate one shop
//   node dist/apps/tailorkit/migration/runner/run.js --all                   # migrate installed shops
//   node dist/apps/tailorkit/migration/runner/run.js --all --dry-run         # count + skip writes
//   node dist/apps/tailorkit/migration/runner/run.js --rollback-shop=<domain> # wipe one shop's TailorKit envelopes
//   --generation=<n>     override subscriptionGeneration (default 1)
//   --dry-run            with --rollback-shop: count what WOULD be deleted, delete nothing
//
// Env: MONGODB_URI_TAILORKIT_NATIVE (native source), MONGODB_URI_APP_PLATFORM (target).
// Native connection is READ-ONLY. Rollback never opens the native connection (target-only).

import { createAppPlatformMongooseConnection, resolveAppPlatformMongoUri } from '../../../../../web/server/src/app-platform/data/app-platform-mongoose'
import { createNativeReadConnection, closeNativeConnection, resolveNativeMongoUri } from '../native/connection'
import { listInstalledShopDomains } from '../native/read'
import { runShopMigration } from './run-shop-migration'
import { rollbackShopMigration } from './rollback-shop'
import type { CliArgs, FailedShop, RollbackShopResult, RunShopMigrationResult } from './runner.d'

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { generation: 1 }
  for (const raw of argv) {
    if (raw === '--all') args.all = true
    else if (raw === '--dry-run') args.dryRun = true
    else if (raw.startsWith('--shop=')) args.shop = raw.slice('--shop='.length)
    else if (raw.startsWith('--rollback-shop=')) args.rollbackShop = raw.slice('--rollback-shop='.length)
    else if (raw.startsWith('--generation=')) {
      const n = Number(raw.slice('--generation='.length))
      if (Number.isFinite(n) && n > 0) args.generation = Math.floor(n)
    }
  }
  return args
}

function redactMongoUri(uri: string): string {
  return uri.replace(/mongodb(\+srv)?:\/\/[^@]+@/g, 'mongodb$1://***:***@')
}

async function runRollback(args: CliArgs): Promise<void> {
  console.log(`[rollback] shop=${args.rollbackShop} generation=${args.generation} dryRun=${Boolean(args.dryRun)}`)
  console.log(`[rollback] app-platform uri=${redactMongoUri(resolveAppPlatformMongoUri())}`)
  const appConn = await createAppPlatformMongooseConnection()
  let result: RollbackShopResult
  try {
    result = await rollbackShopMigration({
      shopDomain: args.rollbackShop as string,
      appPlatformConnection: appConn,
      generation: args.generation,
      dryRun: args.dryRun,
    })
  } finally {
    await appConn.close()
  }
  const verb = args.dryRun ? 'would delete' : 'deleted'
  console.log(`--- rollback ${result.shopDomain} (generation ${result.generation}) ---`)
  for (const d of result.deleted) {
    if (d.deletedCount) console.log(`  ${d.collection}: ${verb} ${d.deletedCount}`)
  }
  console.log(`--- total ${verb}: ${result.totalDeleted} ---`)
}

function printSummary(results: RunShopMigrationResult[], failedShops: FailedShop[]): void {
  const totals = results.reduce(
    (acc, r) => ({
      integrations: acc.integrations + r.counts.integrations,
      variants: acc.variants + r.counts.variants,
      optionSets: acc.optionSets + r.counts.optionSets,
      orders: acc.orders + r.counts.orders,
      userJourneys: acc.userJourneys + r.counts.userJourneys,
      settings: acc.settings + r.counts.settings,
      skippedVariants: acc.skippedVariants + r.skipped.variants,
      skippedMockups: acc.skippedMockups + r.skipped.mockups,
    }),
    { integrations: 0, variants: 0, optionSets: 0, orders: 0, userJourneys: 0, settings: 0, skippedVariants: 0, skippedMockups: 0 }
  )
  console.log('--- per-shop ---')
  for (const r of results) {
    const errs = r.errors.length ? ` errors=${r.errors.length}` : ''
    console.log(
      `  ${r.shopDomain}: integrations=${r.counts.integrations} variants=${r.counts.variants} ` +
        `optionSets=${r.counts.optionSets} orders=${r.counts.orders} ` +
        `userJourneys=${r.counts.userJourneys} settings=${r.counts.settings} ` +
        `skipped(orphan/mockup)=${r.skipped.variants}/${r.skipped.mockups}${errs}`
    )
    for (const err of r.errors.slice(0, 20)) {
      console.log(`    error ${err.integrationId}: ${err.message}`)
    }
    if (r.errors.length > 20) console.log(`    ... ${r.errors.length - 20} more errors`)
  }
  console.log('--- totals ---')
  console.log(JSON.stringify(totals, null, 2))
  if (failedShops.length) {
    console.log('--- failed shops (re-run with --shop=<domain>) ---')
    for (const f of failedShops) console.log(`  ${f.shop}: ${f.error}`)
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))

  // Rollback is target-only and mutually exclusive with migration modes.
  if (args.rollbackShop) {
    if (args.shop || args.all) {
      console.error('--rollback-shop cannot be combined with --shop or --all')
      process.exit(2)
    }
    await runRollback(args)
    return
  }

  if (!args.shop && !args.all) {
    console.error('Usage: --shop=<domain> | --all [--dry-run] [--generation=<n>] | --rollback-shop=<domain> [--dry-run]')
    process.exit(2)
  }
  if (args.shop && args.all) {
    console.error('Specify --shop=<domain> OR --all, not both')
    process.exit(2)
  }

  console.log(`[migrate] generation=${args.generation} dryRun=${Boolean(args.dryRun)}`)
  console.log(`[migrate] native uri=${redactMongoUri(resolveNativeMongoUri())}`)
  console.log(`[migrate] app-platform uri=${redactMongoUri(resolveAppPlatformMongoUri())}`)

  const nativeConn = await createNativeReadConnection()
  const appConn = await createAppPlatformMongooseConnection()
  const results: RunShopMigrationResult[] = []
  const failedShops: FailedShop[] = []

  try {
    const shops = args.all ? await listInstalledShopDomains(nativeConn) : [args.shop as string]
    console.log(`[migrate] shops=${shops.length}${args.dryRun ? ' (dry-run)' : ''}`)

    for (const [index, shop] of shops.entries()) {
      console.log(`[migrate] shop ${index + 1}/${shops.length} ${shop}`)
      try {
        const r = await runShopMigration({
          shopDomain: shop,
          nativeConnection: nativeConn,
          appPlatformConnection: appConn,
          generation: args.generation,
          dryRun: args.dryRun,
        })
        results.push(r)
        console.log(`[migrate] done ${shop} integrations=${r.counts.integrations} errors=${r.errors.length}`)
      } catch (e) {
        // Per-shop isolation: one bad shop never aborts the batch. Operator re-runs targeted via --shop.
        failedShops.push({ shop, error: e instanceof Error ? e.message : String(e) })
        console.log(`[migrate] failed ${shop}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  } finally {
    await closeNativeConnection(nativeConn)
    await appConn.close()
  }

  printSummary(results, failedShops)
  if (failedShops.length) process.exit(1)
}

main().catch(e => {
  console.error('[migrate] fatal:', e)
  process.exit(1)
})
