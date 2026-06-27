import { authenticatedFetch } from '~/shopify/fns.client'
import { getJSONFromIDB, openIDBDatabase } from '~/bootstrap/db/index-db'
import { IDB_STORE_NAME, IDB_DATABASE_NAME } from '~/constants/index-db'
import type { PrintArea } from '~/types/integration'

/**
 * Get all variants integrated from API
 */
export async function getAllVariantsIntegrated(): Promise<any[]> {
  const res = await authenticatedFetch('/api/variants-integrations')
  return res?.success ? res.variants : []
}

/**
 * Get variants selected from IDB
 */
export async function getVariantsSelected(
  integrationId: string
): Promise<{ variantsSelected: any[]; prebuiltPrintAreasByVariantId?: Record<string, PrintArea[]> }> {
  const db = await openIDBDatabase(IDB_DATABASE_NAME.VARIANTS_SELECTED, IDB_STORE_NAME.INTEGRATION)
  const data = (await getJSONFromIDB(db, IDB_STORE_NAME.INTEGRATION, integrationId)) as any
  return {
    variantsSelected: data?.variants || [],
    prebuiltPrintAreasByVariantId: data?.prebuiltPrintAreasByVariantId,
  }
}

/**
 * Get template selected from IDB
 */
export async function getTemplateSelected(integrationId: string): Promise<any | null> {
  try {
    const templateDb = await openIDBDatabase(IDB_DATABASE_NAME.TEMPLATE_SELECTED, IDB_STORE_NAME.INTEGRATION)
    const data = (await getJSONFromIDB(templateDb, IDB_STORE_NAME.INTEGRATION, integrationId)) as any
    return data?.template || null
  } catch (error) {
    console.error('[integrationData] Error getting template selected:', error)
    return null
  }
}

/**
 * Get temporary integration from IDB
 */
export async function getTemporaryIntegration(mockupId: string): Promise<any | null> {
  try {
    const db = await openIDBDatabase(IDB_DATABASE_NAME.INTEGRATION, IDB_STORE_NAME.INTEGRATION_TEMPORARY)
    return await getJSONFromIDB(db, IDB_STORE_NAME.INTEGRATION_TEMPORARY, mockupId)
  } catch (error) {
    console.error('[integrationData] Error getting temporary integration:', error)
    return null
  }
}
