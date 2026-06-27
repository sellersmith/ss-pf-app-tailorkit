// Composite write path: repo.update derives the 7 per-entity collections from one composite, then a
// migration-state patch forces the record unpublished in PageFly. Native publishedAt means "published in
// standalone TailorKit"; migration does NOT run PageFly publish side effects or create a publishSnapshot,
// so preserving native published status would show dangerous false-published products after migration.
import type { AppContext } from '../../../../../web/server/src/app-platform/contracts'
import type { ScopedAppDataPort } from '../../../../../web/server/src/app-platform/contracts'
import type { Connection } from 'mongoose'
import type { NativeIntegrationGraph } from '../native/native-graph'
import type { TailorKitIntegrationRecord } from '../../domain/product-personalizer'
import {
  TAILORKIT_INTEGRATION_COLLECTION,
  TAILORKIT_STOREFRONT_SNAPSHOT_COLLECTION,
} from '../../domain/product-personalizer'
import { createTailorKitProductPersonalizerRepository } from '../../backend/product-personalizer-repository'
import { buildSavePayloadFromNativeGraph } from '../inverter/build-save-payload'
import { createMinimalMigrationPorts } from './minimal-ports'

export interface WriteCompositeResult {
  record: TailorKitIntegrationRecord
  skippedVariants: string[]
  skippedMockups: string[]
}

export async function writeComposite(
  graph: NativeIntegrationGraph,
  appData: ScopedAppDataPort,
  ctx: AppContext
): Promise<WriteCompositeResult> {
  const { payload, skipped } = buildSavePayloadFromNativeGraph(graph)
  const ports = createMinimalMigrationPorts(appData)
  const repo = createTailorKitProductPersonalizerRepository(ports, ctx)
  const record = await repo.update(graph._id, { tailorkitSavePayload: payload })
  if (!record) throw new Error(`repo.update returned null for integration ${graph._id}`)
  return { record, skippedVariants: skipped.variants, skippedMockups: skipped.mockups }
}

/**
 * Migration must never mark records as PageFly-published. The native app may have publishedAt, but this
 * CLI intentionally avoids repo.publish() (Shopify metafields + credit side effects), so there is no
 * PageFly publishSnapshot to serve or withdraw. Force every migrated product into the safe unpublished
 * state; merchants can publish explicitly after reviewing migrated editor data.
 */
export async function resetPublishedFieldsForMigration(
  appData: ScopedAppDataPort,
  ctx: AppContext,
  record: TailorKitIntegrationRecord,
  _graph: NativeIntegrationGraph
): Promise<void> {
  const unpublishedRecord = {
    ...record,
    status: 'unpublished',
    publishedAt: null,
    unpublishedAt: null,
    variantIdsPublished: [],
    publishSnapshot: undefined,
  }

  if (
    record.status !== 'unpublished' ||
    record.publishedAt ||
    record.variantIdsPublished.length ||
    record.publishSnapshot
  ) {
    await appData.put(ctx, TAILORKIT_INTEGRATION_COLLECTION, record.id, unpublishedRecord)
  }

  await appData.put(ctx, TAILORKIT_STOREFRONT_SNAPSHOT_COLLECTION, record.id, {
    integrationId: record.id,
    title: record.title,
    status: 'unpublished',
    generatedAt: record.updatedAt,
    variants: [],
    mockups: [],
    templates: [],
    printAreas: [],
    layerIntegrations: [],
    mockupViews: [],
    updatedAt: record.updatedAt,
  })
}

/** Exposed for the CLI: assertFresh no-ops unless getCurrentSubscriptionGeneration is passed. */
export function buildMinimalAppData(connection: Connection, getConnection: () => Promise<Connection>) {
  // The runner builds the real scoped port externally; this helper is here for symmetry / future use.
  return { connection, getConnection }
}
