import type { AppDataCollectionDefinition } from '../../../../web/server/src/app-platform/contracts'

const scopeIndex = {
  name: 'by-shop-app-generation',
  fields: ['shopDomain', 'appId', 'subscriptionGeneration', 'id'],
}

export type TailorKitMigrationPhaseId =
  | 'source-inventory'
  | 'data-contract'
  | 'admin-list'
  | 'editor-host'
  | 'theme-surface'
  | 'storefront-runtime'
  | 'cart-helper'
  | 'pricing-entitlement'

/** App-data collections mapped from Product Personalizer, declared before moving records. */
export const tailorkitAppDataCollections: AppDataCollectionDefinition[] = [
  { collection: 'integrations', indexes: [scopeIndex] },
  { collection: 'variant-integrations', indexes: [scopeIndex] },
  { collection: 'templates', indexes: [scopeIndex] },
  { collection: 'mockups', indexes: [scopeIndex] },
  { collection: 'option-sets', indexes: [scopeIndex] },
  { collection: 'layers', indexes: [scopeIndex] },
  { collection: 'mockup-views', indexes: [scopeIndex] },
  { collection: 'overlay-lookups', indexes: [scopeIndex] },
  { collection: 'personalizer-settings', indexes: [scopeIndex] },
  { collection: 'user-journeys', indexes: [scopeIndex] },
  { collection: 'storefront-snapshots', indexes: [scopeIndex] },
  { collection: 'orders', indexes: [scopeIndex] },
]

/** Marketplace usage should count real personalized product records, not shell activations. */
export const tailorkitMarketplaceUsageCollections = ['integrations', 'variant-integrations', 'templates']

export const tailorkitMigrationPhases: Array<{
  id: TailorKitMigrationPhaseId
  label: string
  ready: boolean
}> = [
  { id: 'source-inventory', label: 'Source inventory and risk map', ready: true },
  { id: 'data-contract', label: 'Scoped app-data contract', ready: true },
  { id: 'admin-list', label: 'Admin list and product selector adapter', ready: true },
  { id: 'editor-host', label: 'Product Personalizer editor host', ready: true },
  { id: 'theme-surface', label: 'Theme app block and app embed', ready: true },
  { id: 'storefront-runtime', label: 'Storefront personalizer runtime', ready: false },
  { id: 'cart-helper', label: 'Cart and hidden pricing helper', ready: false },
  { id: 'pricing-entitlement', label: 'Pricing and entitlement gates', ready: false },
]

/** Storefront canvas dependency policy; PageFly must not bundle Konva into the Shopify extension. */
export const tailorkitStorefrontDependencyPolicy = {
  konva: {
    version: '10.0.12',
    globalName: 'Konva',
    loadStrategy: 'runtime-cdn-lazy-before-personalizer',
    fallbackStrategy: 'shopify-extension-asset-if-cdn-policy-blocked',
    bundleInThemeExtension: false,
  },
}

/** Copy-first source policy for TailorKit theme/storefront migration. */
export const tailorkitStorefrontSourcePolicy = {
  referenceExtensionRoot: '/Users/phanconglong/Documents/Projects/emtailorkit/extensions',
  mirrorRoot: 'apps/tailorkit/upstream/tailorkit-app/extensions',
  requiredSourceRoots: [
    'tailorkit-src/src/assets',
    'tailorkit-src/src/blocks',
    'tailorkit-src/src/snippets',
    'tailorkit-src/src/shared',
    'tailorkit-helper/src',
  ],
  mirroredSourceRoots: [
    'tailorkit-src/src/assets',
    'tailorkit-src/src/blocks',
    'tailorkit-src/src/snippets',
    'tailorkit-src/src/shared',
    'tailorkit-helper/src',
  ],
  activeThemeSurfaceFiles: [
    {
      activeSource: 'blocks/app-embed.liquid',
      upstreamSources: ['tailorkit-src/src/blocks/app-embed.liquid'],
      status: 'pagefly-adapter',
    },
    {
      activeSource: 'blocks/customizer.liquid',
      upstreamSources: ['tailorkit-src/src/blocks/customizer.liquid'],
      status: 'pagefly-adapter',
    },
    {
      activeSource: 'snippets/placeholder.liquid',
      upstreamSources: ['tailorkit-src/src/snippets/placeholder.liquid'],
      status: 'pagefly-adapter',
    },
    {
      activeSource: 'snippets/print-areas.liquid',
      upstreamSources: ['tailorkit-src/src/snippets/print-areas.liquid'],
      status: 'pagefly-adapter',
    },
    {
      activeSource: 'snippets/icons.liquid',
      upstreamSources: ['tailorkit-src/src/snippets/icons.liquid'],
      status: 'copied',
    },
    {
      activeSource: 'snippets/tlk-render-layer.liquid',
      upstreamSources: ['tailorkit-src/src/snippets/tlk-render-layer.liquid'],
      status: 'pagefly-adapter',
    },
    {
      activeSource: '../src/storefront-copied/assets/tailorkit.ts',
      upstreamSources: ['tailorkit-src/src/assets/tailorkit.ts', 'tailorkit-helper/src/index.ts'],
      status: 'pagefly-adapter',
    },
    {
      activeSource: '../src/storefront-copied/assets/features/konva/index.ts',
      upstreamSources: ['tailorkit-src/src/assets/features/konva/index.ts'],
      status: 'pagefly-adapter',
    },
    {
      activeSource: '../src/storefront-copied/assets/features/pinch-zoom/index.ts',
      upstreamSources: ['tailorkit-src/src/assets/features/pinch-zoom/index.ts'],
      status: 'copied',
    },
    {
      activeSource: '../src/storefront-copied/assets/features/charm-builder/index.ts',
      upstreamSources: ['tailorkit-src/src/assets/features/charm-builder/index.ts'],
      status: 'pagefly-adapter',
    },
    {
      activeSource: '../src/storefront-copied/assets/tailorkit.css',
      upstreamSources: ['tailorkit-src/src/assets/tailorkit.css'],
      status: 'pagefly-adapter',
    },
  ],
  pageflyQuarantinedRewriteRoots: ['apps/tailorkit/src/storefront'],
  pageflyQuarantinedRewriteFiles: [
    'apps/tailorkit/src/storefront/browser-entry.ts',
    'apps/tailorkit/src/storefront/cart-change-observer.ts',
    'apps/tailorkit/src/storefront/cart-sync-plan.ts',
    'apps/tailorkit/src/storefront/cart-sync-runtime.ts',
    'apps/tailorkit/src/storefront/cart-ui-refresh.ts',
    'apps/tailorkit/src/storefront/confirmation-checkbox.ts',
    'apps/tailorkit/src/storefront/customizer-element.ts',
    'apps/tailorkit/src/storefront/form-sync.ts',
    'apps/tailorkit/src/storefront/hidden-pricing-cart-add-body.ts',
    'apps/tailorkit/src/storefront/hidden-pricing-fetch-interceptor.ts',
    'apps/tailorkit/src/storefront/hidden-pricing-native-submit.ts',
    'apps/tailorkit/src/storefront/hidden-pricing-product.ts',
    'apps/tailorkit/src/storefront/konva-loader.ts',
    'apps/tailorkit/src/storefront/option-list-elements.ts',
    'apps/tailorkit/src/storefront/option-processor.ts',
    'apps/tailorkit/src/storefront/personalizer-element.ts',
    'apps/tailorkit/src/storefront/pricing-sync.ts',
    'apps/tailorkit/src/storefront/text-customer-input.ts',
    'apps/tailorkit/src/storefront/views-bar-element.ts',
    'apps/tailorkit/theme-extension/assets/tailorkit.css',
  ],
  readyBeforeSourceMirror: false,
} as const

/**
 * Current V0.1 capability state exposed to admin/status APIs.
 * `implemented` means merchant-facing TailorKit flow parity, not just a PageFly port adapter.
 */
export const tailorkitMigrationStatus = {
  currentPhase: 'theme-surface' as TailorKitMigrationPhaseId,
  implemented: {
    adminShell: true,
    backendStatusApi: true,
    appDataContract: true,
    adminList: true,
    adminEditor: true,
    publishCore: true,
    themeSurface: true,
    storefrontRuntime: false,
    cartHelper: false,
    pricingEntitlement: false,
  },
  backendPortAdapters: {
    productPersonalizerApi: true,
    publishSnapshotPublisher: true,
    themeConfigApi: true,
  },
}
