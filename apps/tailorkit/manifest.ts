import type { AdminAppManifest } from '../../web/server/src/app-platform/contracts'
import { tailorkitMarketplaceUsageCollections } from './src/domain/migration-boundary'
import { themeSurfaces } from './theme-extension/theme-surfaces'

export const tailorkitManifest: AdminAppManifest = {
  appId: 'tailorkit',
  displayName: 'TailorKit Product Personalizer',
  description:
    'Pilot copy-first migration of TailorKit Product Personalizer into PageFly. Mapped admin setup flows run through copied TailorKit routes.',
  version: '0.1.0',
  lifecycle: 'pilot',
  extensionPoints: [
    'admin.route',
    'backend.api',
    'app.data',
    'theme.surface',
    'storefront.runtime',
    'shopify.webhook.intent',
  ],
  // Order capture: the host webhook ingress fans an `orders/create` delivery into this immediate intent
  // when the order carries TailorKit line-item properties. Capture computes app-generated revenue and
  // upserts the order into scoped app-data. `delivery: 'immediate'` runs from the fanout path (no staging).
  webhookIntents: [{ topic: 'orders/create', delivery: 'immediate', intentVersion: '1' }],
  // Storefront token scopes. Enabling TailorKit publishes a storefront runtime, which mints a Storefront
  // API token via `storefrontAccessTokenCreate` — that mutation requires the `unauthenticated_read_*`
  // grants below. Declaring them here lets the activation toggle prompt the merchant (App Bridge
  // `scopes.request`) BEFORE the publish call; without this the toggle skips the prompt and the publish
  // throws an opaque 502. `shopifyScopePolicy` is mandatory whenever scopes are declared.
  optionalShopifyScopes: [
    'unauthenticated_read_product_inventory',
    'unauthenticated_read_product_listings',
    'unauthenticated_read_product_tags',
  ],
  shopifyScopePolicy: {
    bumpPolicy: 'merchant-opt-in',
    merchantFacingReason:
      'TailorKit needs Storefront API product scopes to render personalized previews and publish the storefront runtime.',
  },
  // Storefront runtime budgets. The personalizer bundle (`pagefly-tailorkit.js`) and config script load
  // via the generated app-embed Liquid, NOT the runtime publisher's inert script tag, so the enforced
  // liquid/config budgets only need to clear that tiny generated tag; assetBytesBudget covers the bundle.
  storefrontRuntime: {
    configElementId: 'tailorkit-storefront-config',
    globalStoreKey: '__PAGEFLY_TAILORKIT__',
    liquidBytesBudget: 12000,
    runtimeConfigBytesBudget: 48000,
    assetBytesBudget: 2000000,
  },
  themeSurfaces,
  admin: {
    routeBase: '/app-extensions/tailorkit',
    label: 'TailorKit Product Personalizer',
    group: 'growth',
    order: 40,
  },
  api: {
    namespace: '/api/apps/tailorkit',
  },
  support: {
    owner: 'pagefly-platform',
    runbookUrl: 'plans/260603-1553-pagefly-mega-app-platform/plan.md',
    debugBundle: true,
    retentionDays: 90,
  },
  degradedBehavior: {
    admin: 'readonly',
    api: 'readonly',
    storefront: 'no-op',
    webhook: 'skip',
  },
  activationPolicy: {
    merchantToggle: 'enabled',
  },
  marketplace: {
    displayTitle: 'TailorKit Product Personalizer',
    tagline: 'Personalized product previews for engraving, monograms, charms, and uploaded photos.',
    description:
      'Pilot migration in progress. PageFly hosts mapped TailorKit Product Personalizer admin flows through app-platform boundaries.',
    planLabel: 'Pilot admin',
    themeEmbed: 'Online Store 2.0',
    surfaces: 'Product page, product variants, custom products',
    updated: 'Jun 2026',
    metaItems: ['Custom products', 'Product variants', 'PageFly'],
  },
  marketplaceStats: {
    usageDataCollections: tailorkitMarketplaceUsageCollections,
  },
  // Price-blind entitlement. pro class → unlocked at Optimize. Meter present → taste mode at Builder
  // (3 free personalized products, app counts server-side). Inert until tier-gate flag is ON.
  entitlement: {
    appClass: 'pro',
    gatedCapability: 'canWriteTailorKitPersonalizedProducts',
    meters: [{ key: 'personalizedProducts', freeLimit: 3 }],
  },
}

export default tailorkitManifest
