import { openIDBDatabase, storeJSONFileToIDB, getJSONFromIDB, deleteFileFromIDB } from '~/bootstrap/db/index-db'
import { IDB_STORE_NAME, IDB_DATABASE_NAME } from '~/constants/index-db'
import type { Integration as TIntegration } from '~/types/integration'

/**
 * Store temporary integration in IndexedDB
 * @param integration - Integration object to store
 * @param mockupId - Mockup ID to use as storage key
 * @returns Promise that resolves when storage is complete
 */
export async function storeTemporaryIntegration(integration: TIntegration, mockupId: string): Promise<void> {
  const db = await openIDBDatabase(IDB_DATABASE_NAME.INTEGRATION, IDB_STORE_NAME.INTEGRATION_TEMPORARY)
  await storeJSONFileToIDB(db, IDB_STORE_NAME.INTEGRATION_TEMPORARY, integration, mockupId)
}

/**
 * Retrieve temporary integration from IndexedDB
 * @param mockupId - Mockup ID used as storage key
 * @returns Promise that resolves to integration object or null
 */
export async function getTemporaryIntegration(mockupId: string): Promise<TIntegration | null> {
  const db = await openIDBDatabase(IDB_DATABASE_NAME.INTEGRATION, IDB_STORE_NAME.INTEGRATION_TEMPORARY)
  return (await getJSONFromIDB(db, IDB_STORE_NAME.INTEGRATION_TEMPORARY, mockupId)) as TIntegration | null
}

/**
 * Remove temporary integration from IndexedDB
 * @param mockupId - Mockup ID used as storage key
 * @returns Promise that resolves when deletion is complete
 */
export async function deleteTemporaryIntegration(mockupId: string): Promise<void> {
  const db = await openIDBDatabase(IDB_DATABASE_NAME.INTEGRATION, IDB_STORE_NAME.INTEGRATION_TEMPORARY)
  await deleteFileFromIDB(db, IDB_STORE_NAME.INTEGRATION_TEMPORARY, mockupId)
}
