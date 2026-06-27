import {
  productEditorAdaptedFacadeFiles,
  productEditorFacadeRoot,
} from './source-manifest'

export type ProductEditorIslandBlockedImportResolution =
  | 'model-shape-facade'
  | 'model-runtime-facade'
  | 'route-constant-reference'
  | 'route-runtime-facade'
  | 'route-ui-copied-reference'
  | 'route-ui-prune'
  | 'route-utility-facade'

export interface ProductEditorIslandBlockedImportGroup {
  resolution: ProductEditorIslandBlockedImportResolution
  imports: readonly string[]
  notes: string
}

export const productEditorIslandBlockedImportScanRoots = [
  'app/modules/ProductEditor',
  'app/modules/TemplateEditor',
  'app/modules/TourGuides',
  'app/stores',
] as const

/** PageFly-owned shims allowed to surround the copied TailorKit ProductEditor island. */
export const productEditorIslandAllowedPageFlyAdapterFiles = [
  'apps/tailorkit/src/admin/product-editor-island/pagefly-app-handle-fallback.ts',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-authenticated-fetch-shim.ts',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-background-removal-initializer-shim.tsx',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-chatbot-context-shim.tsx',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-contextual-save-bar-shim.tsx',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-feedback-shim.ts',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-interactive-chat-shim.tsx',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-live-chat-shim.ts',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-navigate-app-bridge.ts',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-navigate-app-bridge-shim.tsx',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-product-editor-island-host.tsx',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-product-editor-loader-context.tsx',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-remix-react-shim.tsx',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-root-shim.ts',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-route-behavior-shim.tsx',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-shopify-shim.ts',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-toast-events-shim.ts',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-image-upload-bridge.ts',
] as const

/**
 * Copy-first admin boundary inventory.
 * Files here are PageFly-authored; ProductEditor/list behavior still must come from the TailorKit upstream mirror.
 */
export const tailorkitCopyFirstActiveAdminHostFiles = [
  'apps/tailorkit/src/admin/index.tsx',
  'apps/tailorkit/src/admin/nav-shell.tsx',
  'apps/tailorkit/src/admin/route-host-inspection.ts',
  'apps/tailorkit/src/admin/copied-routes/host.tsx',
  'apps/tailorkit/src/admin/copied-routes/runtime-loader.ts',
] as const

/** Active runtime entry and shims used by the copied TailorKit route bundle. */
export const tailorkitCopyFirstActiveAdminRuntimeAdapterFiles = [
  'apps/tailorkit/src/admin/copied-routes/tailorkit-copied-route-i18n.ts',
  'apps/tailorkit/src/admin/copied-routes/runtime-entry.ts',
  'apps/tailorkit/src/admin/copied-routes/runtime-loading.tsx',
  'apps/tailorkit/src/admin/copied-routes/storefront-setup-shell.tsx',
  'apps/tailorkit/src/admin/copied-routes/storefront-setup-styling-view.tsx',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-app-handle-fallback.ts',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-authenticated-fetch-shim.ts',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-background-removal-initializer-shim.tsx',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-chatbot-context-shim.tsx',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-contextual-save-bar-shim.tsx',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-feedback-shim.ts',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-interactive-chat-shim.tsx',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-live-chat-shim.ts',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-navigate-app-bridge.ts',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-navigate-app-bridge-shim.tsx',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-product-editor-loader-context.tsx',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-remix-react-shim.tsx',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-root-shim.ts',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-route-behavior-shim.tsx',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-shopify-shim.ts',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-toast-events-shim.ts',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-image-upload-bridge.ts',
] as const

/**
 * Separate runtime assets and dormant ProductEditor-island adapters kept for compile/runtime validation.
 * The active admin shell must not import the old ProductEditor island host directly.
 */
export const tailorkitCopyFirstDormantAdminAdapterFiles = [
  'apps/tailorkit/src/admin/admin-mutation-error.ts',
  'apps/tailorkit/src/admin/api.ts',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-product-editor-island-host.tsx',
  'apps/tailorkit/src/admin/product-editor-island/route-contract.ts',
  'apps/tailorkit/src/admin/product-editor-island/runtime-entry.tsx',
  'apps/tailorkit/src/admin/product-editor-island/runtime-loader.ts',
  'apps/tailorkit/src/admin/product-editor-loading.tsx',
] as const

/** Source maps, compile probes, and policy contracts; these must not become merchant-facing behavior. */
export const tailorkitCopyFirstAdminContractFiles = [
  'apps/tailorkit/src/admin/product-editor-island/alias-contract.ts',
  'apps/tailorkit/src/admin/product-editor-island/compile-probe-entry.tsx',
  'apps/tailorkit/src/admin/product-editor-island/import-boundary-contract.ts',
  'apps/tailorkit/src/admin/product-editor-island/scaffold-policy.ts',
  'apps/tailorkit/src/admin/product-editor-island/source-manifest.ts',
  'apps/tailorkit/src/admin/product-editor-island/source-map.ts',
] as const

/** Disabled rewrites kept only as temporary reference while the TailorKit mirror replaces active paths. */
export const tailorkitCopyFirstQuarantinedAdminRewriteFiles = [
  'apps/tailorkit/src/admin/product-editor-host.tsx',
  ...productEditorAdaptedFacadeFiles.map(file => `${productEditorFacadeRoot}/${file}`),
] as const

/** Import markers that would reactivate PageFly-native rewrites instead of copied TailorKit source. */
export const tailorkitCopyFirstAdminActiveImportDenylist = [
  "from './api'",
  "from './product-editor-host'",
  "from './personalized-products-list'",
  "from './product-selector-modal'",
  "from './use-tailorkit-product-selector'",
  "from './product-editor-island/",
  "from '../product-editor-island/",
  "from './product-editor/",
  "from '../storefront/",
] as const

export const productEditorIslandBlockedImportGroups = [
  {
    resolution: 'model-shape-facade',
    imports: [
      '~/models/Layer.server',
      '~/models/OptionSet.d',
      '~/models/PricingPlan',
      '~/models/Shop',
      '~/models/Subscription',
      '~/models/UserJourney',
    ],
    notes: 'Copied editor needs these model shapes/types; PageFly admin must not import TailorKit Mongoose models.',
  },
  {
    resolution: 'model-runtime-facade',
    imports: [
      '~/models/ClipartClickEvent',
      '~/models/PricingPlan.fns',
      '~/models/helpers/ai-credit-utils',
      '~/models/helpers/pricing-utils',
    ],
    notes: 'Runtime model helpers/enums need explicit PageFly-safe facades before the upstream island can execute.',
  },
  {
    resolution: 'route-constant-reference',
    imports: [
      '~/routes/api.ai-assistant.suggestion/constants',
      '~/routes/api.cliparts/constants',
      '~/routes/api.files/constants',
      '~/routes/api.google-sheet/constants',
      '~/routes/api.integrations/constants',
      '~/routes/api.option-sets/constants',
      '~/routes/api.preferences/constants',
      '~/routes/api.products/constants',
      '~/routes/api.providers-integration.$id/constants',
      '~/routes/api.shopify/constants',
      '~/routes/api.templates.$id/constants',
      '~/routes/api.templates/constants',
      '~/routes/api.templates_designs/constants',
      '~/routes/api.user-journey/constants',
      '~/routes/libraries._index/constants',
      '~/routes/settings_.providers.connection.$id/constant',
    ],
    notes: 'Pure constants can stay as upstream references; mutations still route through PageFly authenticatedFetch.',
  },
  {
    resolution: 'route-runtime-facade',
    imports: ['~/routes/api.charm-products/route', '~/routes/personalized-products.$id/route', '~/routes/templates.$id/route.tsx'],
    notes: 'Route modules are loader/action references only and need PageFly loader/action facades.',
  },
  {
    resolution: 'route-ui-copied-reference',
    imports: ['~/routes/dashboard/components/PublishToEarnCard'],
    notes: 'This dashboard UI import is copied exactly because ProductEditor UnifiedHeader imports it directly.',
  },
  {
    resolution: 'route-ui-prune',
    imports: [
      '~/routes/dashboard/route',
      '~/routes/dashboard/components/ClipartShowcase',
      '~/routes/dashboard/components/GetStartedCard',
      '~/routes/dashboard/components/ProductSuggestedCard',
      '~/routes/dashboard/components/PublishToEarnModal',
      '~/routes/dashboard/hooks/usePTEStatus',
      '~/routes/pricing._index/components/FAQ/FAQ',
      '~/routes/pricing._index/components/FeatureComparisonTable',
      '~/routes/pricing._index/components/PlanSelectionCards',
      '~/routes/pricing._index/components/PricingCalculator/PricingCalculator',
      '~/routes/pricing._index/components/SelectPlanModal/SelectPlanModal',
      '~/routes/pricing._index/fns',
      '~/routes/pricing._index/utils/buildFeatureComparison',
      '~/routes/pricing._index/utils/planRecommendation',
      '~/routes/pricing._index/utils/trial-calculations',
      '~/routes/settings_.providers.connection.$id/ProviderConnectionForm',
      '~/routes/templates._index/components/ModalCreateTemplate/HeightTextField',
      '~/routes/templates._index/components/ModalCreateTemplate/MeasurementUnit',
      '~/routes/templates._index/components/ModalCreateTemplate/ResolutionField',
      '~/routes/templates._index/components/ModalCreateTemplate/WidthTextField',
    ],
    notes: 'TailorKit dashboard/pricing/template-route UI should be pruned or replaced by PageFly host capability UI.',
  },
  {
    resolution: 'route-utility-facade',
    imports: [
      '~/routes/api.ai-assistant.suggest-font-combinations/variantHash',
      '~/routes/api.pricing/utils/fns',
      '~/routes/personalized-products._index/fns/eventTracking',
      '~/routes/settings.providers/utilities/checkValidConnection',
      '~/routes/templates._index/fns',
    ],
    notes: 'Route-local helpers need small facades or relocation before the upstream island compiles.',
  },
] as const satisfies readonly ProductEditorIslandBlockedImportGroup[]

export const productEditorIslandTrackedBlockedImports = productEditorIslandBlockedImportGroups.flatMap(group =>
  group.imports.map(source => ({ source, resolution: group.resolution }))
)
