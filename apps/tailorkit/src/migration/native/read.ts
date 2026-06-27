// Read-only readers over the native TailorKit graph. Every query is find/lean — zero writes.
import type { Connection } from 'mongoose'
import type {
  NativeGlobalStyling,
  NativeIntegrationGraph,
  NativeOptionSet,
  NativeOrder,
  NativePersonalizerSettings,
  NativeUserJourney,
} from './native-graph'
import { INTEGRATION_POPULATE, registerNativeModels } from './schemas'

/** Loads all Integration docs for a shop with the full populated graph (variants→mockup→layers→template). */
export async function readIntegrationGraph(
  connection: Connection,
  shopDomain: string
): Promise<NativeIntegrationGraph[]> {
  const { Integration } = registerNativeModels(connection)
  // Capture the RAW variant GID list first: populate overwrites Integration.variants with resolved VI
  // objects and silently drops unmatched GIDs, so orphan refs can only be counted against this list.
  const rawDocs = await Integration.find({ shopDomain }, { variants: 1 }).lean().exec()
  const variantRefsById = new Map<string, string[]>(
    rawDocs.map(doc => {
      const record = doc as { _id?: unknown; variants?: unknown }
      const refs = Array.isArray(record.variants) ? record.variants.map(String) : []
      return [String(record._id), refs]
    })
  )
  // INTEGRATION_POPULATE sets strictPopulate:false on every node because loose schemas don't declare
  // ref paths; the join shape itself is pinned by localField/foreignField on the variants node.
  const docs = await Integration.find({ shopDomain }).populate(INTEGRATION_POPULATE).lean().exec()
  return docs.map(doc => {
    const graph = doc as unknown as NativeIntegrationGraph
    graph.variantRefs = variantRefsById.get(String(graph._id)) || []
    return graph
  })
}

export async function readOptionSets(connection: Connection, shopDomain: string): Promise<NativeOptionSet[]> {
  const { OptionSet } = registerNativeModels(connection)
  const docs = await OptionSet.find({ shopDomain }).lean().exec()
  return docs as unknown as NativeOptionSet[]
}

export async function readUserJourneys(connection: Connection, shopDomain: string): Promise<NativeUserJourney[]> {
  const { UserJourney } = registerNativeModels(connection)
  const docs = await UserJourney.find({ shopDomain }).lean().exec()
  return docs as unknown as NativeUserJourney[]
}

/** Personalizer settings is a single per-shop record (preferences/settings doc). */
export async function readPersonalizerSettings(
  connection: Connection,
  shopDomain: string
): Promise<NativePersonalizerSettings | null> {
  const { Shop } = registerNativeModels(connection)
  const doc = await Shop.findOne({ shopDomain }).lean().exec()
  return (doc as unknown as NativePersonalizerSettings) || null
}

export async function readGlobalStyling(connection: Connection, shopDomain: string): Promise<NativeGlobalStyling | null> {
  const { GlobalStyling } = registerNativeModels(connection)
  const doc = await GlobalStyling.findOne({ shopDomain }).lean().exec()
  return (doc as unknown as NativeGlobalStyling) || null
}

/** Returns a bounded cursor over a shop's orders so the runner can stream/batch them. */
export function createOrdersCursor(connection: Connection, shopDomain: string) {
  const { Order } = registerNativeModels(connection)
  return Order.find({ shopDomain }).lean().cursor()
}

/** Convenience: all orders for a shop as an array (small shops / tests only — runner uses the cursor). */
export async function readOrders(connection: Connection, shopDomain: string): Promise<NativeOrder[]> {
  const { Order } = registerNativeModels(connection)
  const docs = await Order.find({ shopDomain }).lean().exec()
  return docs as unknown as NativeOrder[]
}

/** Installed-shop filter: shops where uninstalledAt is null or missing. */
export async function listInstalledShopDomains(connection: Connection): Promise<string[]> {
  const { Shop } = registerNativeModels(connection)
  const docs = await Shop.find(
    { $or: [{ uninstalledAt: null }, { uninstalledAt: { $exists: false } }] },
    { shopDomain: 1, _id: 0 }
  )
    .lean()
    .exec()
  return dedupeDomains(docs.map(doc => (doc as { shopDomain?: string }).shopDomain))
}

/** Distinct shopDomain across integrations (used to validate a --shop target exists). */
export async function listNativeShopDomains(connection: Connection): Promise<string[]> {
  const { Integration } = registerNativeModels(connection)
  const domains = await Integration.distinct('shopDomain').exec()
  return dedupeDomains(domains as Array<string | undefined>)
}

function dedupeDomains(values: Array<string | undefined | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}
