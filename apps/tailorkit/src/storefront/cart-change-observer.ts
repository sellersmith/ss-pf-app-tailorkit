import { readTailorKitStorefrontConfig } from './konva-loader'
import { refreshTailorKitCartUI } from './cart-ui-refresh'
import {
  type TailorKitCartFetcher,
  type TailorKitCartFetchInit,
  syncTailorKitHiddenPricingCart,
} from './cart-sync-runtime'

interface TailorKitCartResourceEntry {
  name: string
  initiatorType?: string
}

interface TailorKitCartItemLike {
  id?: number | string
  key?: string
  quantity?: number
  properties?: Record<string, unknown>
}

interface TailorKitCartLike {
  items?: TailorKitCartItemLike[]
}

interface TailorKitCartObserverOptions {
  fetcher?: TailorKitCartFetcher
  refreshCart?: (cart: unknown) => void | Promise<void>
  propertyPrefix?: string
}

type PerformanceObserverConstructor = new (callback: (list: { getEntries(): TailorKitCartResourceEntry[] }) => void) => {
  observe(options: { entryTypes: string[] }): void
  disconnect(): void
}

let disconnectCartObserver: (() => void) | null = null
let isFetchingCart = false
let queuedOperationTypes: string[] = []
let lastCartSummary = '[]'
const DEFAULT_CART_ENDPOINT = '/cart.js'

export function shouldObserveTailorKitCartResource(entry: TailorKitCartResourceEntry): boolean {
  const isValidRequestType = entry.initiatorType === 'xmlhttprequest' || entry.initiatorType === 'fetch'

  return isValidRequestType && /\/cart\/(change|add|update|clear)(\.js)?(\?|$)/.test(entry.name)
}

export function getTailorKitCartOperationType(url: string): string {
  if (url.includes('/cart/add')) return 'add'
  if (url.includes('/cart/change')) return 'change'
  if (url.includes('/cart/update')) return 'update'
  if (url.includes('/cart/clear')) return 'clear'

  return 'unknown'
}

export function shouldRunTailorKitInitialCartCleanup(pathname: string): boolean {
  return /^\/cart\/?$/.test(pathname)
}

function resolvePropertyPrefix(options: TailorKitCartObserverOptions) {
  return options.propertyPrefix || readTailorKitStorefrontConfig().propertyPrefix || '__pf_tailorkit'
}

function browserFetch(): TailorKitCartFetcher {
  return (url: string, init?: TailorKitCartFetchInit) => window.fetch(url, init) as ReturnType<TailorKitCartFetcher>
}

function cartEndpoint() {
  const root = window.Shopify?.routes?.root || '/'
  return root === '/' ? DEFAULT_CART_ENDPOINT : `${root.replace(/\/$/, '')}${DEFAULT_CART_ENDPOINT}`
}

function summarizeCart(cart: TailorKitCartLike, propertyPrefix: string) {
  return JSON.stringify(
    (cart.items || [])
      .map(item => ({
        id: item.id,
        key: item.key,
        quantity: item.quantity,
        flag: item.properties?.[propertyPrefix] || null,
        refId: item.properties?.[`${propertyPrefix}_ref_id`] || null,
      }))
      .sort((a, b) => String(a.key || '').localeCompare(String(b.key || '')))
  )
}

async function readCart(fetcher: TailorKitCartFetcher): Promise<TailorKitCartLike> {
  const response = await fetcher(cartEndpoint())
  if (!response.ok) {
    throw new Error(`[TailorKit] Failed to fetch cart for sync: ${response.status} ${response.statusText || ''}`)
  }

  return response.json() as Promise<TailorKitCartLike>
}

async function flushQueuedCartSync(fetcher: TailorKitCartFetcher, options: TailorKitCartObserverOptions) {
  const propertyPrefix = resolvePropertyPrefix(options)
  const cart = await readCart(fetcher)
  const nextSummary = summarizeCart(cart, propertyPrefix)

  if (nextSummary === lastCartSummary) return

  lastCartSummary = nextSummary
  const operationTypes = queuedOperationTypes.length ? [...queuedOperationTypes] : ['unknown']
  await Promise.allSettled(
    operationTypes.map(operationType =>
      syncTailorKitHiddenPricingCart(cart.items || [], {
        fetcher,
        operationType,
        propertyPrefix,
        refreshCart: options.refreshCart || refreshTailorKitCartUI,
      })
    )
  )
}

async function runInitialTailorKitCartCleanup(fetcher: TailorKitCartFetcher, options: TailorKitCartObserverOptions) {
  if (!shouldRunTailorKitInitialCartCleanup(window.location.pathname)) return

  const propertyPrefix = resolvePropertyPrefix(options)
  const cart = await readCart(fetcher)
  lastCartSummary = summarizeCart(cart, propertyPrefix)
  await syncTailorKitHiddenPricingCart(cart.items || [], {
    fetcher,
    operationType: 'change',
    propertyPrefix,
    refreshCart: options.refreshCart || refreshTailorKitCartUI,
  })
}

/** Observes Shopify Ajax cart mutations and runs TailorKit hidden-pricing cart synchronization. */
export function initializeTailorKitCartSync(options: TailorKitCartObserverOptions = {}) {
  if (disconnectCartObserver) return disconnectCartObserver

  const Observer = (globalThis as any).PerformanceObserver as PerformanceObserverConstructor | undefined
  if (typeof window === 'undefined' || !Observer || typeof window.fetch !== 'function') {
    return () => {}
  }

  const fetcher = options.fetcher || browserFetch()
  const observer = new Observer(list => {
    const entries = list.getEntries().filter(shouldObserveTailorKitCartResource)
    if (!entries.length) return

    queuedOperationTypes.push(getTailorKitCartOperationType(entries[entries.length - 1].name))
    if (isFetchingCart) return

    isFetchingCart = true
    flushQueuedCartSync(fetcher, options)
      .catch(error => console.error('[TailorKit] Cart sync observer failed:', error))
      .finally(() => {
        queuedOperationTypes = []
        isFetchingCart = false
      })
  })

  observer.observe({ entryTypes: ['resource'] })
  runInitialTailorKitCartCleanup(fetcher, options).catch(error =>
    console.error('[TailorKit] Initial cart cleanup failed:', error)
  )
  disconnectCartObserver = () => {
    observer.disconnect()
    disconnectCartObserver = null
  }

  return disconnectCartObserver
}
