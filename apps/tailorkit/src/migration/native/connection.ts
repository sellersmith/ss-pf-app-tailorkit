// Read-only mongoose connection to the TailorKit native database (the migration SOURCE).
// Owns its own handle, fully separate from the app-platform write connection. Never written to.
import mongoose, { type Connection } from 'mongoose'

export const DEFAULT_NATIVE_MONGODB_URI = 'mongodb://localhost:27017/tailorkit'

/** Redacts user:pass in a Mongo URI for safe logging. */
export function redactMongoUri(uri: string): string {
  return uri.replace(/\/\/([^:@/]+):([^@/]+)@/, '//***:***@')
}

/**
 * Resolves the TailorKit native (SOURCE) URI.
 *
 * IMPORTANT: reads a DEDICATED var, NOT `MONGODB_URI`. In PageFly `MONGODB_URI` is the PageFly CORE
 * database (Shop/Page/Section) — the TailorKit native standalone DB lives on a separate cluster, so it
 * must have its own var. Reading `MONGODB_URI` here would point the migration at the wrong database.
 */
export function resolveNativeMongoUri(env: NodeJS.ProcessEnv = process.env): string {
  return env.MONGODB_URI_TAILORKIT_NATIVE?.trim() || DEFAULT_NATIVE_MONGODB_URI
}

/**
 * Creates the dedicated read-only native connection.
 *
 * Uses mongoose.createConnection (not the global default) so the source URI is isolated and the
 * connection can be closed independently of the app-platform write pool.
 */
export async function createNativeReadConnection(uri = resolveNativeMongoUri()): Promise<Connection> {
  const connection = mongoose.createConnection(uri, {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 5,
  })
  connection.on('error', error => {
    console.error(`[tailorkit-migration][native] connection error ${redactMongoUri(uri)}`, error)
  })
  return connection.asPromise()
}

export async function closeNativeConnection(connection: Connection): Promise<void> {
  await connection.close()
}
