import { openIDBDatabase, storeJSONFileToIDB, getJSONFromIDB, deleteFileFromIDB } from '~/bootstrap/db/index-db'
import { IDB_DATABASE_NAME, IDB_STORE_NAME } from '~/constants/index-db'
import type { TemporaryProductData } from '~/types/integration'
import {
  TEMP_VARIANT_PREFIX,
  createTempVariantId as _createTempVariantId,
  createTempProductId as _createTempProductId,
} from '~/constants/temporary-product'

// Re-export helper functions
export const createTempVariantId = _createTempVariantId
export const createTempProductId = _createTempProductId

export async function storeTemporaryProduct(data: TemporaryProductData): Promise<void> {
  const db = await openIDBDatabase(IDB_DATABASE_NAME.TEMPORARY_PRODUCTS, IDB_STORE_NAME.TEMPORARY_PRODUCT_DATA)
  await storeJSONFileToIDB(db, IDB_STORE_NAME.TEMPORARY_PRODUCT_DATA, data, data.id)
}

export async function getTemporaryProduct(integrationId: string): Promise<TemporaryProductData | null> {
  try {
    const db = await openIDBDatabase(IDB_DATABASE_NAME.TEMPORARY_PRODUCTS, IDB_STORE_NAME.TEMPORARY_PRODUCT_DATA)
    return (await getJSONFromIDB(
      db,
      IDB_STORE_NAME.TEMPORARY_PRODUCT_DATA,
      integrationId
    )) as TemporaryProductData | null
  } catch (error) {
    console.error('[temporaryProduct] Failed to get:', error)
    return null
  }
}

export async function deleteTemporaryProduct(integrationId: string): Promise<void> {
  try {
    const db = await openIDBDatabase(IDB_DATABASE_NAME.TEMPORARY_PRODUCTS, IDB_STORE_NAME.TEMPORARY_PRODUCT_DATA)
    await deleteFileFromIDB(db, IDB_STORE_NAME.TEMPORARY_PRODUCT_DATA, integrationId)
  } catch (error) {
    console.error('[temporaryProduct] Failed to delete:', error)
  }
}

export function isTemporaryVariant(variantId: string): boolean {
  return variantId?.startsWith(TEMP_VARIANT_PREFIX) || false
}
