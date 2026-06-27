export const TAILORKIT_REFERENCE_ROOT_LABEL = 'TailorKit reference repo from the migration plan'

export const productEditorIslandTargetRoot = 'apps/tailorkit/src/admin/product-editor-island'
export const productEditorPrimaryUpstreamMirrorRoot = 'apps/tailorkit/upstream/tailorkit-app'
export const productEditorFacadeRoot = `${productEditorIslandTargetRoot}/facades`
export const productEditorRemovedSecondaryMirrorRoot = `${productEditorIslandTargetRoot}/upstream`
export const productEditorActiveBuildUpstreamMirrorRoot = productEditorPrimaryUpstreamMirrorRoot
export const productEditorRemovedSecondaryMirrorPolicy = {
  root: productEditorRemovedSecondaryMirrorRoot,
  status: 'removed',
  replacementRoot: productEditorPrimaryUpstreamMirrorRoot,
  facadeRoot: productEditorFacadeRoot,
  forbiddenConsumers: [
    'apps/tailorkit/vite.product-editor-island.config.mts',
    'apps/tailorkit/vite.copied-routes.config.mts',
    'apps/tailorkit/vite.tailorkit-admin-aliases.mts',
    'apps/tailorkit/src/admin/product-editor-island/runtime-entry.tsx',
    'apps/tailorkit/src/admin/product-editor-island/compile-probe-entry.tsx',
    'apps/tailorkit/src/admin/copied-routes/runtime-entry.ts',
    'extensions/app-platform-src/scripts/prepare-tailorkit-extension-source.mjs',
  ],
  removalCondition:
    'Secondary ProductEditor mirror is removed; copied TailorKit source must come from the app-level mirror and PageFly facades from the facade root.',
} as const

/** Roots that must stay byte-for-byte copied from the TailorKit reference repo. */
export const productEditorCopyFirstExactMirrorRoots = [
  'app/modules/ProductEditor',
  'extensions/tailorkit-src/src/assets',
  'extensions/tailorkit-helper/src',
] as const

/**
 * Files inside the copy-first mirror roots that PageFly intentionally diverges from the reference
 * repo (TailorKit is in maintain mode — copied source may be edited). These are exempt from the
 * byte-for-byte mirror check, NOT from the structural file-presence check.
 *
 * - UnifiedHeader/index.tsx: Publish-to-Earn card/modal removed. Its product-suggestion fetch
 *   (`POST /api/products {get_top_selling_products}`) is unsupported by the PageFly island bridge
 *   and crashed the editor; PTE is an upsell, not core. Paths are mirror-root-relative.
 */
export const productEditorMaintainModeDivergentFiles = [
  'app/modules/ProductEditor/components/UnifiedHeader/index.tsx',
] as const

/**
 * Full TailorKit directories copied as upstream reference.
 * These folders are intentionally not imported until PageFly adapter seams are explicit.
 */
export const productEditorUpstreamDirectoryMirrors = ['app/modules/ProductEditor'] as const

/**
 * Dependency directories mirrored because ProductEditor imports them directly.
 * They remain upstream source references until PageFly adapter seams are explicit.
 */
export const productEditorDependencyDirectoryMirrors = ['app/modules/TemplateEditor'] as const

/**
 * Shared store/canvas directories mirrored because ProductEditor and TemplateEditor import them heavily.
 */
export const productEditorSharedDependencyDirectoryMirrors = ['app/stores', 'app/components/canvas'] as const

/**
 * Shared UI and selector dependency mirrors used by ProductEditor/TemplateEditor.
 */
export const productEditorSharedUiDirectoryMirrors = [
  'app/components/common',
  'app/components/AITextField',
  'app/components/BottomSheet',
  'app/components/Button',
  'app/components/GoogleFontsFilters',
  'app/components/loading',
  'app/components/skeleton',
  'app/components/ui',
  'app/components/VideoTutorial',
  'app/components/OptionSetPricingField',
  'app/components/OptionSetPricingHeader',
  'app/components/OverflowToolbar',
  'app/components/UsesBadge',
] as const

export const productEditorSharedUiFileMirrors = [
  'app/components/Accordion.tsx',
  'app/components/BackgroundUploader.tsx',
  'app/components/ButtonGroup.tsx',
  'app/components/ErrorBoundary.tsx',
  'app/components/InstallAppEmbedActivator.tsx',
  'app/components/MultiselectCombobox.tsx',
  'app/components/TabList.tsx',
] as const

export const productEditorModalDirectoryMirrors = [
  'app/modules/modals',
  'app/modules/ProductSelector',
  'app/modules/SortableItemList',
  'app/modules/GroupableItemList',
] as const

/**
 * Support primitives mirrored from TailorKit because the copied editor imports them via `~/...`.
 * Backend model/API imports are still adapter seams and are not listed here.
 */
export const productEditorSupportPrimitiveDirectoryMirrors = [
  'app/utils',
  'app/constants',
  'app/bootstrap',
  'app/hooks',
  'app/shopify',
  'app/components/TourGuide',
  'app/components/confetti',
  'app/modules/TourGuides',
  'app/modules/VectorEditor',
  'app/modules/Feedback',
  'app/modules/PromptPresets',
  'app/shared/customization-items',
] as const

export const productEditorSupportPrimitiveFileMirrors = [
  'app/assets/icons.tsx',
  'app/modules/Onboarding/utilities/saveUserJourneyProgress.ts',
] as const

/**
 * TailorKit extension fragments imported as raw strings by shared editor utilities.
 * These stay inside the ProductEditor island mirror and are not PageFly theme-extension surfaces.
 */
export const productEditorExtensionDependencyDirectoryMirrors = ['extensions/tailorkit-src/src/sub-snippets'] as const

/**
 * Build metadata from TailorKit's extension workspace.
 * These files are reference-only until PageFly replaces the quarantined storefront rewrite with a copied-source build.
 */
export const productEditorExtensionBuildReferenceFiles = [
  'extensions/package.json',
  'extensions/tailorkit-src/package.json',
  'extensions/tailorkit-src/vite.config.js',
  'extensions/tailorkit-src/vite.features.config.js',
  'extensions/tailorkit-src/features.config.js',
  'extensions/tailorkit-src/scripts/build-features.js',
  'extensions/tailorkit-helper/package.json',
  'extensions/tailorkit-helper/vite.config.js',
  'extensions/tailorkit-helper/tsconfig.json',
] as const

export const productEditorExtensionBuildActivationBlockers = [
  {
    id: 'original-build-copies-onetick-assets',
    reason:
      'TailorKit upstream vite.config.js copies ../onetick-src into shared app assets; PageFly TailorKit must not revive OneTick coupling.',
  },
  {
    id: 'original-extension-root-runs-onetick-workspace',
    reason:
      'TailorKit upstream extensions/package.json builds and watches the onetick workspace; PageFly TailorKit build must be independent from OneTick.',
  },
  {
    id: 'original-helper-uses-onetick-cart-bridge',
    reason:
      'TailorKit upstream helper calls window.__onetick_store__ for cart updates; PageFly TailorKit must replace that with an explicit app-platform bridge or remove it.',
  },
  {
    id: 'original-build-bundles-konva',
    reason:
      'TailorKit upstream storefront build bundles tailorkit.ts with Konva dependencies; PageFly storefront policy requires CDN/lazy Konva handling.',
  },
  {
    id: 'original-build-writes-tailorkit-extension-shell',
    reason:
      'TailorKit upstream build writes to extensions/tailorkit; PageFly must materialize through the app-platform deploy shell only after adapters are explicit.',
  },
] as const

/** PageFly-specific build adapter contract; no executable build is enabled while this remains quarantined. */
export const productEditorExtensionBuildAdapterContract = {
  status: 'contract-only-quarantined',
  ownerWorkspace: 'extensions/app-platform-src',
  sourceMirrorRoot: 'apps/tailorkit/upstream/tailorkit-app/extensions',
  outputShell: 'extensions/pagefly-theme-helper',
  copiedSourceEntrypoints: [
    'tailorkit-src/src/assets/tailorkit.ts',
    'tailorkit-src/src/assets/tailorkit.css',
    'tailorkit-helper/src/index.ts',
  ],
  requiredAdapterRemovals: [
    '../onetick-src/src/*',
    '../../../app/shared/extensions/onetick-src/src',
    'build:onetick',
    'dev:onetick',
    'workspace onetick',
    'window.__onetick_store__',
    '__onetick_store__',
  ],
  requiredAdapterPreservations: [
    'tailorkit-src/src/blocks',
    'tailorkit-src/src/snippets',
    'tailorkit-src/src/sub-snippets',
    'tailorkit-src/src/shared',
    'tailorkit-helper/src',
  ],
  cartBridge: {
    globalKey: '__pagefly_app_platform_cart_bridge__',
    method: 'handleCartUpdateAfterAddToCart',
  },
  storefrontKonvaStrategy: 'cdn-lazy-no-theme-extension-bundle',
  generatedAssets: ['pagefly-tailorkit.js', 'pagefly-tailorkit.css'],
} as const

/**
 * Remix route/API references that define TailorKit listing, detail, save, publish, and resource loading flows.
 * These are reference mirrors only; PageFly must adapt them through app-platform ports before execution.
 */
export const productEditorRouteReferenceDirectoryMirrors = [
  'app/routes/personalized-products.$id',
  'app/routes/personalized-products._index',
  'app/routes/personalized-products.loading',
  'app/routes/api.integration',
  'app/routes/api.integrations',
  'app/routes/api.integrations.$id',
  'app/routes/api.personalized-products',
  'app/routes/api.products',
  'app/routes/api.products.$id',
  'app/routes/api.products.categories',
  'app/routes/api.products.providers.$id',
  'app/routes/api.products.variants.$id',
  'app/routes/api.shopify',
  'app/routes/api.shopify.products.$productId',
  'app/routes/api.templates',
  'app/routes/api.templates.$id',
  'app/routes/api.templates.$id.option-sets',
  'app/routes/api.templates_designs',
] as const

/**
 * Exact TailorKit list route files copied for Product Personalizer listing parity.
 * PageFly-native listing code must stay quarantined until it is replaced through this route seam.
 */
export const productEditorListRouteMirrorFiles = [
  'app/routes/personalized-products._index/components/RowActions.tsx',
  'app/routes/personalized-products._index/components/RowMarkupDesktop.tsx',
  'app/routes/personalized-products._index/components/RowMarkupMobile.tsx',
  'app/routes/personalized-products._index/fns/eventTracking.ts',
  'app/routes/personalized-products._index/route.tsx',
] as const

/**
 * List-route dependencies are no longer compiled through the ProductEditor island.
 * They must be handled later by the app-level TailorKit mirror and compatibility layer.
 */
export const productEditorListRouteDependencyMirrorFiles = [] as const
export const productEditorListRouteFacadeFiles = [] as const

/** Detail route files copied exactly from TailorKit; PageFly adds a separate type-only facade. */
export const productEditorDetailRouteCopiedMirrorFiles = [
  'app/routes/personalized-products.$id/route-legacy.tsx',
  'app/routes/personalized-products.$id/route.tsx',
] as const

export const productEditorDetailRouteFacadeFile = 'app/routes/personalized-products.$id/route.ts' as const

/**
 * Route constants copied as upstream references for ProductEditor compile prep.
 * These files must not bring Remix loaders/actions into the admin bundle.
 */
export const productEditorRouteConstantReferenceFiles = [
  'app/routes/api.ai-assistant.suggestion/constants.ts',
  'app/routes/api.cliparts/constants.ts',
  'app/routes/api.files/constants.ts',
  'app/routes/api.google-sheet/constants.ts',
  'app/routes/api.integrations/constants.ts',
  'app/routes/api.option-sets/constants.ts',
  'app/routes/api.preferences/constants.ts',
  'app/routes/api.products/constants.ts',
  'app/routes/api.providers-integration.$id/constants.ts',
  'app/routes/api.shopify/constants.ts',
  'app/routes/api.templates.$id/constants.ts',
  'app/routes/api.templates/constants.ts',
  'app/routes/api.templates_designs/constants.ts',
  'app/routes/api.user-journey/constants.ts',
  'app/routes/libraries._index/constants.ts',
  'app/routes/settings_.providers.connection.$id/constant.ts',
] as const

export const productEditorRouteConstantDependencyFiles = [
  'app/libs/openai/constants.ts',
  'app/routes/api.google-sheet/constants.json',
] as const

/**
 * Type-only route runtime facades. Full Remix route modules stay out of the admin island.
 */
export const productEditorRouteRuntimeFacadeFiles = [
  'app/routes/api.charm-products/route.ts',
  'app/routes/personalized-products.$id/route.ts',
  'app/routes/templates.$id/route.tsx',
] as const

/**
 * Route-local utility facades copied from TailorKit for upstream ProductEditor compile prep.
 */
export const productEditorRouteUtilityFacadeFiles = [
  'app/routes/api.ai-assistant.suggest-font-combinations/variantHash.ts',
  'app/routes/api.pricing/utils/fns.ts',
  'app/routes/personalized-products._index/fns/eventTracking.ts',
  'app/routes/settings.providers/utilities/checkValidConnection.ts',
  'app/routes/templates._index/fns.ts',
] as const

export const productEditorRouteUtilityDependencyFiles = [
  'app/routes/api.providers-connection.$id/constants.ts',
  'app/routes/dashboard/utilities/pteBadgeUtils.ts',
] as const

/**
 * Route-owned UI references copied only when the imported component is client-side ProductEditor/TemplateEditor UI.
 */
export const productEditorRouteUiCopiedReferenceFiles = [
  'app/routes/dashboard/components/ClipartShowcase.tsx',
  'app/routes/dashboard/components/GetStartedCard.tsx',
  'app/routes/dashboard/components/ModalVideoTutorial.tsx',
  'app/routes/dashboard/components/PublishToEarnCard.tsx',
  'app/routes/templates._index/components/ModalCreateTemplate/HeightTextField.tsx',
  'app/routes/templates._index/components/ModalCreateTemplate/MeasurementUnit.tsx',
  'app/routes/templates._index/components/ModalCreateTemplate/ResolutionField.tsx',
  'app/routes/templates._index/components/ModalCreateTemplate/WidthTextField.tsx',
] as const

/**
 * Route UI imports intentionally left as adapter work because they pull commercial/provider flows.
 */
export const productEditorRouteUiDeferredAdapterImports = [
  '~/routes/dashboard/route',
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
] as const

/**
 * Explicit prune adapters for route UI imports that are outside ProductEditor V0.1.
 * These files keep TailorKit import paths stable without copying pricing/provider/PTE business flows.
 */
export const productEditorRouteUiPrunedAdapterFiles = [
  'app/routes/dashboard/route.tsx',
  'app/routes/dashboard/components/PublishToEarnModal/index.tsx',
  'app/routes/dashboard/components/ProductSuggestedCard/index.tsx',
  'app/routes/dashboard/hooks/usePTEStatus.ts',
  'app/routes/pricing._index/components/FAQ/FAQ.tsx',
  'app/routes/pricing._index/components/FeatureComparisonTable.tsx',
  'app/routes/pricing._index/components/PlanSelectionCards.tsx',
  'app/routes/pricing._index/components/PricingCalculator/PricingCalculator.tsx',
  'app/routes/pricing._index/components/SelectPlanModal/SelectPlanModal.tsx',
  'app/routes/pricing._index/fns.ts',
  'app/routes/pricing._index/utils/buildFeatureComparison.ts',
  'app/routes/pricing._index/utils/planRecommendation.ts',
  'app/routes/pricing._index/utils/trial-calculations.ts',
  'app/routes/settings_.providers.connection.$id/ProviderConnectionForm.tsx',
] as const

/**
 * Model shape facades copied or adapted for admin compile prep.
 * These files provide type contracts only; TailorKit Mongoose schemas stay out of PageFly admin.
 */
export const productEditorModelShapeFacadeFiles = [
  'app/models/Layer.server.ts',
  'app/models/OptionSet.d.ts',
  'app/models/PricingPlan.d.ts',
  'app/models/Shop.d.ts',
  'app/models/Subscription.d.ts',
  'app/models/UserJourney.d.ts',
] as const

export const productEditorModelShapeDependencyFiles = [
  'app/models/BillingCycle.d.ts',
  'app/models/Coupon.d.ts',
] as const

export const productEditorModelRuntimeFacadeFiles = [
  'app/models/ClipartClickEvent.ts',
  'app/models/PricingPlan.fns.ts',
  'app/models/helpers/ai-credit-utils.ts',
  'app/models/helpers/pricing-utils.ts',
] as const

/**
 * TailorKit API client wrappers imported by the copied editor.
 */
export const productEditorApiReferenceDirectoryMirrors = ['app/api'] as const

/**
 * Type references mirrored from TailorKit so copied editor code keeps upstream type contracts.
 */
export const productEditorTypeReferenceDirectoryMirrors = ['app/types'] as const

/**
 * Small UI/support references pulled by upstream editor dependencies.
 * These stay inactive until the upstream island is adapted behind PageFly host seams.
 */
export const productEditorUiSupportReferenceDirectoryMirrors = [
  'app/components/.client/RichTextEditor',
  'app/components/.client/SocialVideoThumbnail',
  'app/components/ChatBotDrawer',
  'app/components/layouts/AppLayout',
  'app/components/layouts/Canvas',
  'app/libs/remix-query',
  'app/modules/FileUploader',
  'app/modules/VectorWizard',
  'app/shared/utils',
] as const

export const productEditorUiSupportReferenceFileMirrors = [
  'app/components/AIChat/constants.ts',
  'app/components/AIChat/fns.ts',
  'app/components/GridCarousel.tsx',
  'app/services/BackgroundRemovalService.ts',
  'app/services/fulfillment/types.d.ts',
] as const

/**
 * Additional upstream client files copied after alias-target validation.
 */
export const productEditorAliasTargetReferenceFiles = [
  'app/components/BackgroundRemovalInitializer.tsx',
  'app/components/GlobalStyling/PersonalizedWithGlobalStyling.tsx',
  'app/components/GlobalStyling/utils/applyGlobalStyling.ts',
  'app/components/ImagelessPricingHandler/ImagelessPricingWrapper.tsx',
  'app/components/ImagelessPricingHandler/index.ts',
  'app/components/ImagelessPricingHandler/useImagelessPricing.ts',
  'app/shared/extensions/tailorkit-src/src/assets/libraries/event-handler.ts',
  'app/shared/extensions/tailorkit-src/src/assets/libraries/transmitter.ts',
] as const

/**
 * PageFly-safe adapters for TailorKit app-root/chat/wizard imports.
 */
export const productEditorAliasTargetAdapterFiles = [
  'app/root.tsx',
  'app/providers/ChatBotContext.tsx',
  'app/modules/MockupWizard/index.tsx',
] as const

/**
 * PageFly-authored ProductEditor compile facades.
 * These files are intentionally outside all upstream mirrors so copy-first source stays byte-for-byte TailorKit.
 */
export const productEditorAdaptedFacadeFiles = [
  ...productEditorAliasTargetAdapterFiles,
  'app/routes/api.charm-products/route.ts',
  ...productEditorRouteRuntimeFacadeFiles,
  ...productEditorRouteUiPrunedAdapterFiles,
  'app/models/Layer.server.ts',
  'app/models/PricingPlan.fns.ts',
] as const

/**
 * Source-of-truth files for the ProductEditor behavior island.
 * These are TailorKit-relative paths; PageFly adapters may wrap them, but should not reimplement their behavior.
 */
export const productEditorIslandSourceFiles = [
  'app/stores/modules/integration/integration.ts',
  'app/stores/modules/integration/layerIntegration.ts',
  'app/stores/modules/integration/viewLayerIntegration.ts',
  'app/stores/modules/integration/layer-integration-selection.ts',
  'app/stores/modules/integration/fns.ts',
  'app/modules/ProductEditor/index.tsx',
  'app/modules/ProductEditor/contexts/IntegrationEditorProvider.tsx',
  'app/modules/ProductEditor/contexts/UnifiedEditorProvider.tsx',
  'app/modules/ProductEditor/hooks/useInitIntegration.ts',
  'app/modules/ProductEditor/hooks/useSaveIntegration.ts',
  'app/modules/ProductEditor/hooks/useUnifiedSave.ts',
  'app/modules/ProductEditor/hooks/useUnifiedPublish.ts',
  'app/modules/ProductEditor/components/Canvas/index.client.tsx',
  'app/modules/ProductEditor/components/Canvas/SpriteLayerIntegration.tsx',
  'app/modules/ProductEditor/components/Canvas/ViewsBarOverlay.client.tsx',
  'app/modules/ProductEditor/components/IntegrationInspector/index.tsx',
  'app/modules/ProductEditor/components/IntegrationInspector/Integrate/index.tsx',
  'app/modules/ProductEditor/components/IntegrationInspector/Integrate/MockupViewsManager/index.tsx',
  'app/modules/ProductEditor/components/IntegrationInspector/Integrate/MockupLayersManager/index.tsx',
  'app/modules/ProductEditor/components/ProductBaseSetting/index.tsx',
  'app/modules/ProductEditor/components/UnifiedHeader/index.tsx',
] as const

export const productEditorUpstreamMirrorFiles = [
  'app/constants/save-bar.ts',
  'app/libs/external-store.ts',
  'app/libs/steps.client.ts',
  'app/stores/modules/integration/integration.ts',
  'app/stores/modules/integration/layerIntegration.ts',
  'app/stores/modules/integration/viewLayerIntegration.ts',
  'app/stores/modules/integration/layer-integration-selection.ts',
  'app/stores/modules/integration/fns.ts',
  'app/types/integration.ts',
  'app/types/shopify-product.ts',
  'app/types/template.ts',
  'app/types/psd.ts',
  'app/types/shopify-files.ts',
  'app/utils/cleanStackTrace.ts',
  'app/utils/differencesObject.ts',
] as const

/**
 * The earlier PageFly-native ProductEditor scaffold has been removed from the runtime tree.
 * Historical removed-file inventory lives in `scaffold-policy.ts`.
 */
export const productEditorDeprecatedSnapshotScaffoldFiles = [] as const

export const productEditorTemporarySnapshotScaffoldFiles = productEditorDeprecatedSnapshotScaffoldFiles

export const productEditorFrozenScaffoldFileLimit = 0

export const productEditorExecutableIslandAdapterFiles = [
  'apps/tailorkit/src/admin/product-editor-island/alias-contract.ts',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-background-removal-initializer-shim.tsx',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-authenticated-fetch-shim.ts',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-chatbot-context-shim.tsx',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-feedback-shim.ts',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-interactive-chat-shim.tsx',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-live-chat-shim.ts',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-navigate-app-bridge.ts',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-navigate-app-bridge-shim.tsx',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-product-editor-loader-context.tsx',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-product-editor-island-host.tsx',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-remix-react-shim.tsx',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-route-behavior-shim.tsx',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-root-shim.ts',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-shopify-shim.ts',
  'apps/tailorkit/src/admin/product-editor-island/pagefly-toast-events-shim.ts',
  'apps/tailorkit/src/admin/product-editor-island/route-contract.ts',
  'apps/tailorkit/src/admin/product-editor-island/runtime-loader.ts',
  'apps/tailorkit/src/admin/product-editor-island/runtime-entry.tsx',
] as const

export const productEditorRuntimeBuildContract = {
  script: 'build:product-editor-runtime',
  modeEnv: 'TAILORKIT_PRODUCT_EDITOR_BUILD_MODE=runtime',
  config: 'apps/tailorkit/vite.product-editor-island.config.mts',
  entry: 'apps/tailorkit/src/admin/product-editor-island/runtime-entry.tsx',
  sourceMirrorRoot: productEditorPrimaryUpstreamMirrorRoot,
  outputDir: 'apps/tailorkit/dist/admin/product-editor-island',
  globalName: 'PageFlyTailorKitProductEditorIsland',
} as const

export const productEditorRuntimeHostLoaderContract = {
  loader: 'apps/tailorkit/src/admin/product-editor-island/runtime-loader.ts',
  manifestPath: 'admin/product-editor-island/manifest.json',
  entrySource: 'src/admin/product-editor-island/runtime-entry.tsx',
  assetPort: 'AdminAppHost.ports.assets',
} as const

export const productEditorCopiedRouteRuntimeBuildContract = {
  script: 'build:copied-routes-runtime',
  materializeScript: 'scripts/materialize-admin-assets.mjs',
  config: 'apps/tailorkit/vite.copied-routes.config.mts',
  entry: 'apps/tailorkit/src/admin/copied-routes/runtime-entry.ts',
  loader: 'apps/tailorkit/src/admin/copied-routes/runtime-loader.ts',
  sourceMirrorRoot: productEditorPrimaryUpstreamMirrorRoot,
  outputDir: 'apps/tailorkit/dist/admin/copied-routes',
  manifestPath: 'admin/copied-routes/manifest.json',
  entrySource: 'src/admin/copied-routes/runtime-entry.ts',
  assetPort: 'AdminAppHost.ports.assets',
  staticTargets: [
    'web/core/app-platform/apps/tailorkit/admin',
    'web/core/public/app-platform/apps/tailorkit/admin',
    'public/app-platform/apps/tailorkit/admin',
  ],
  routeIds: ['personalized-products._index', 'personalized-products.$id', 'personalized-products.loading'],
} as const

export const productEditorForbiddenSnapshotBehaviorMarkers = ['selectedViewId', 'SET_SELECTED_VIEW'] as const

export const productEditorReferenceFiles = [
  'app/routes/personalized-products.$id/route.tsx',
  'app/routes/personalized-products._index/route.tsx',
  'app/modules/ProductEditor/index.tsx',
  'app/modules/ProductEditor/constants.ts',
  'app/modules/ProductEditor/contexts/UnifiedEditorProvider.tsx',
  'app/modules/ProductEditor/hooks/useUnifiedSave.ts',
  'app/modules/ProductEditor/hooks/useUnifiedPublish.ts',
  'app/modules/ProductEditor/components/UnifiedHeader/index.tsx',
  'app/modules/ProductEditor/components/ProductBaseSetting/index.tsx',
  'app/modules/TemplateEditor/index.tsx',
  'app/modules/ProductEditor/components/Canvas/SpriteLayerIntegration.tsx',
  'app/stores/modules/template.ts',
  'app/stores/modules/integration/viewLayerIntegration.ts',
] as const

export const productEditorMigrationAdapters = [
  'Remix loader data -> TailorKit AdminAppHost API client',
  'Remix navigation/search params -> PageFly routeBase navigation',
  'TailorKit Mongo models -> ctx.ports.appData collections',
  'TailorKit Shopify authenticatedFetch -> ctx.ports.shopifyResources/app-scoped API',
  'TailorKit TemplateEditor/Konva canvas -> admin-only lazy adapter',
  'TailorKit storefront/theme extension runtime -> separate owner outside the admin ProductEditor migration',
] as const

export const productEditorRuntimeEnableBlockers = [
  {
    id: 'standalone-product-editor-island-superseded',
    reason:
      'The standalone ProductEditor island build is preserved for compile validation; active admin mounts copied TailorKit routes through the copied-route host.',
  },
  {
    id: 'copied-route-host-owns-admin-flows',
    reason:
      'TailorKit list/detail/create/save/publish are owned by the app-level copied TailorKit mirror and compatibility layer, not the standalone ProductEditor island host.',
  },
] as const
