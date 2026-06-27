import type { Connection } from 'mongoose'

export interface CliArgs {
  shop?: string
  all?: boolean
  dryRun?: boolean
  generation: number
  rollbackShop?: string
}

export interface RollbackShopOptions {
  shopDomain: string
  appPlatformConnection: Connection
  generation: number
  dryRun?: boolean
}

export interface RollbackShopResult {
  shopDomain: string
  generation: number
  /** Per-collection deleted record counts. */
  deleted: Array<{ collection: string; deletedCount: number }>
  totalDeleted: number
}

export interface RunShopMigrationOptions {
  shopDomain: string
  nativeConnection: Connection
  appPlatformConnection: Connection
  generation: number
  dryRun?: boolean
}

export interface MigrationCounts {
  integrations: number
  variants: number
  optionSets: number
  orders: number
  userJourneys: number
  settings: number
}

export interface MigrationSkipped {
  variants: number
  mockups: number
}

export interface RunShopMigrationResult {
  shopDomain: string
  counts: MigrationCounts
  skipped: MigrationSkipped
  /** Per-integration failures that did NOT abort the shop (id + message). */
  errors: Array<{ integrationId: string; message: string }>
}

export interface FailedShop {
  shop: string
  error: string
}
