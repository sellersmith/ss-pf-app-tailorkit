import { getProviderOrNull } from './registry.server'
import type { ProviderCapabilities } from './types'

const DEFAULT_CAPABILITIES: ProviderCapabilities = {
  hasBlueprintCatalog: false,
  hasPrintProviderSelection: false,
  hasEngravingMapping: false,
  hasVariantSelection: true,
  hasOrderTracking: true,
  hasWebhookSupport: true,
  hasRenderPreview: false,
  hasShippingCalculation: false,
  hasMultipleArtworkPositions: false,
  hasLocationBasedRouting: false,
}

/** Get capabilities for a provider by name. Returns safe defaults for unknown providers. */
export function getCapabilitiesForProvider(providerName: string): ProviderCapabilities {
  const adapter = getProviderOrNull(providerName)
  return adapter?.capabilities ?? DEFAULT_CAPABILITIES
}
