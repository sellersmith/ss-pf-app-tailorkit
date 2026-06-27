import {
  DEFAULT_TAILORKIT_PROPERTY_PREFIX,
  type TailorKitCartLineItem,
  createTailorKitCartSyncPlan,
} from './cart-sync-plan'

export interface TailorKitCartFetchInit {
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: string
}

export interface TailorKitCartFetchResponse {
  ok: boolean
  status: number
  statusText?: string
  json: () => Promise<unknown>
}

export type TailorKitCartFetcher = (
  url: string,
  init?: TailorKitCartFetchInit
) => Promise<TailorKitCartFetchResponse>

export interface TailorKitCartSyncRuntimeOptions {
  fetcher?: TailorKitCartFetcher
  refreshCart?: (cart: unknown) => void | Promise<void>
  propertyPrefix?: string
  operationType?: string
}

export interface TailorKitCartSyncRuntimeResult {
  quantityUpdates: number
  orphanRemovals: number
  refreshes: number
}

function defaultFetcher(): TailorKitCartFetcher {
  if (typeof globalThis.fetch !== 'function') {
    throw new Error('[TailorKit] Cart sync requires a fetch implementation.')
  }

  return globalThis.fetch as TailorKitCartFetcher
}

async function readCartJson(response: TailorKitCartFetchResponse, endpoint: string): Promise<unknown> {
  if (!response.ok) {
    throw new Error(`[TailorKit] Cart sync request failed for ${endpoint}: ${response.status} ${response.statusText || ''}`)
  }

  return response.json()
}

async function postCartJson(fetcher: TailorKitCartFetcher, endpoint: string, body: unknown): Promise<unknown> {
  const response = await fetcher(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  return readCartJson(response, endpoint)
}

async function fetchCartJson(fetcher: TailorKitCartFetcher): Promise<unknown> {
  const endpoint = '/cart.js'
  const response = await fetcher(endpoint)

  return readCartJson(response, endpoint)
}

async function refreshCart(
  cart: unknown,
  refresh: TailorKitCartSyncRuntimeOptions['refreshCart']
): Promise<number> {
  if (!refresh) return 0

  await refresh(cart)
  return 1
}

/** Executes TailorKit hidden-pricing cart sync operations through injectable Shopify Ajax APIs. */
export async function syncTailorKitHiddenPricingCart(
  items: TailorKitCartLineItem[],
  options: TailorKitCartSyncRuntimeOptions = {}
): Promise<TailorKitCartSyncRuntimeResult> {
  const fetcher = options.fetcher || defaultFetcher()
  const plan = createTailorKitCartSyncPlan(items, {
    operationType: options.operationType,
    propertyPrefix: options.propertyPrefix || DEFAULT_TAILORKIT_PROPERTY_PREFIX,
  })
  let refreshes = 0

  for (const change of plan.quantityChanges) {
    const cart = await postCartJson(fetcher, '/cart/change.js', {
      id: change.key,
      quantity: change.quantity,
      properties: change.properties,
    })
    refreshes += await refreshCart(cart, options.refreshCart)
  }

  const orphanKeys = Object.keys(plan.orphanRemovals)
  if (orphanKeys.length) {
    await postCartJson(fetcher, '/cart/update.js', { updates: plan.orphanRemovals })
    const cart = await fetchCartJson(fetcher)
    refreshes += await refreshCart(cart, options.refreshCart)
  }

  return {
    quantityUpdates: plan.quantityChanges.length,
    orphanRemovals: orphanKeys.length,
    refreshes,
  }
}
