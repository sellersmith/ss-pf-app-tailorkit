/**
 * Provider registry -- simple Map-based lookup for fulfillment adapters.
 * No DI framework needed for 2-4 providers (YAGNI).
 *
 * @see app/services/fulfillment/bootstrap.server.ts - Registration
 * @see app/services/fulfillment/types.d.ts - IFulfillmentProvider interface
 */
import type { IFulfillmentProvider } from './types'
import { FULFILLMENT_PROVIDERS } from '~/constants/fulfillment-providers'

const providers = new Map<string, IFulfillmentProvider>()

/** Register a provider adapter. Skips silently if already registered (idempotent for HMR). */
export function registerProvider(provider: IFulfillmentProvider): void {
  if (providers.has(provider.name)) return
  // Warn if registering a provider not in EPROVIDER enum (helps catch typos)
  if (!FULFILLMENT_PROVIDERS.includes(provider.name)) {
    console.warn(`[Fulfillment] Registering unknown provider "${provider.name}" not in EPROVIDER enum`)
  }
  providers.set(provider.name, provider)
}

/** Get a provider by name. Throws if not registered. */
export function getProvider(name: string): IFulfillmentProvider {
  const p = providers.get(name)
  if (!p) throw new Error(`Provider "${name}" not registered`)
  return p
}

/** Get a provider by name or null if not registered. */
export function getProviderOrNull(name: string): IFulfillmentProvider | null {
  return providers.get(name) ?? null
}

/** Get all registered providers. */
export function getAllProviders(): IFulfillmentProvider[] {
  return Array.from(providers.values())
}

/** Check if a provider is registered. */
export function hasProvider(name: string): boolean {
  return providers.has(name)
}

/** Clear all registrations (for testing only). */
export function clearProviders(): void {
  providers.clear()
}
