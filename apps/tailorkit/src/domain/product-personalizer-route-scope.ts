export type TailorKitProductPersonalizerRouteScope = 'mountable-admin' | 'api-adapter' | 'reference-only' | 'excluded'

export interface TailorKitProductPersonalizerRouteDefinition {
  id: string
  source: string
  scope: TailorKitProductPersonalizerRouteScope
  notes: string
}

export type TailorKitProductPersonalizerV01CoreFlowId =
  | 'list'
  | 'create-existing-product'
  | 'detail'
  | 'save'
  | 'publish'
  | 'provider-import'

export type TailorKitProductPersonalizerV01CoreFlowStatus =
  | 'route-hosted'
  | 'bridge-mapped-pending-route-host'
  | 'blocked-pending-source-mapped-adapter'
  | 'deferred-pending-source-mapped-adapter'

export interface TailorKitProductPersonalizerV01CoreFlow {
  id: TailorKitProductPersonalizerV01CoreFlowId
  status: TailorKitProductPersonalizerV01CoreFlowStatus
  mountableRouteIds: readonly string[]
  apiRouteIds: readonly string[]
  authenticatedFetchDecisionIds: readonly string[]
  pageflyRoutes: readonly string[]
  requiredPorts: readonly string[]
  notes: string
}

/**
 * Product Personalizer V0.1 route whitelist.
 * These route ids come from the app-level TailorKit mirror and are mounted only through the PageFly copied-route host.
 */
export const tailorkitProductPersonalizerV01Routes = [
  {
    id: 'personalized-products._index',
    source: 'app/routes/personalized-products._index/route.tsx',
    scope: 'mountable-admin',
    notes: 'Product Personalizer listing route. PageFly can mount it only through the TailorKit compatibility layer.',
  },
  {
    id: 'personalized-products.$id',
    source: 'app/routes/personalized-products.$id/route.tsx',
    scope: 'mountable-admin',
    notes: 'ProductEditor detail route. PageFly must provide Remix loader/action compatibility before execution.',
  },
  {
    id: 'personalized-products.loading',
    source: 'app/routes/personalized-products.loading/route.tsx',
    scope: 'mountable-admin',
    notes: 'TailorKit loading route used by the Product Personalizer flow.',
  },
  {
    id: 'api.personalized-products',
    source: 'app/routes/api.personalized-products/route.ts',
    scope: 'api-adapter',
    notes: 'Listing/create API shape reference for Product Personalizer records.',
  },
  {
    id: 'api.integration',
    source: 'app/routes/api.integration/route.ts',
    scope: 'api-adapter',
    notes: 'Save, publish, and unpublish action route; must map to PageFly app-platform ports.',
  },
  {
    id: 'api.integrations',
    source: 'app/routes/api.integrations/route.ts',
    scope: 'api-adapter',
    notes: 'Integration list/detail support route referenced by ProductEditor utilities.',
  },
  {
    id: 'api.integrations.$id',
    source: 'app/routes/api.integrations.$id/route.tsx',
    scope: 'api-adapter',
    notes: 'Integration detail support route referenced by ProductEditor utilities.',
  },
  {
    id: 'api.overlay-lookup',
    source: 'app/routes/api.overlay-lookup/route.ts',
    scope: 'api-adapter',
    notes:
      'Optional ProductEditor premade mask overlay lookup and transparent-region cache; PageFly V0.1 keeps catalog response empty.',
  },
  {
    id: 'api.services',
    source: 'app/routes/api.services/route.tsx',
    scope: 'api-adapter',
    notes: 'Background-removal service route referenced by TemplateEditor; PageFly V0.1 keeps it fail-closed.',
  },
  {
    id: 'api.colour-guide.upload',
    source: 'app/routes/api.colour-guide.upload/route.ts',
    scope: 'api-adapter',
    notes: 'Colour-guide upload route referenced by TemplateEditor; PageFly V0.1 keeps it fail-closed.',
  },
  {
    id: 'api.charm-products',
    source: 'app/routes/api.charm-products/route.ts',
    scope: 'api-adapter',
    notes: 'Charm product hydration route referenced by TemplateEditor; PageFly V0.1 keeps it fail-closed.',
  },
  {
    id: 'api.products',
    source: 'app/routes/api.products/route.ts',
    scope: 'api-adapter',
    notes: 'Shopify product resource adapter for ProductEditor product/base selection.',
  },
  {
    id: 'api.products.$id',
    source: 'app/routes/api.products.$id/route.ts',
    scope: 'api-adapter',
    notes: 'Single product resource adapter.',
  },
  {
    id: 'api.products.categories',
    source: 'app/routes/api.products.categories/route.ts',
    scope: 'api-adapter',
    notes: 'Product category options used by TailorKit product resource selectors.',
  },
  {
    id: 'api.products.providers.$id',
    source: 'app/routes/api.products.providers.$id/route.ts',
    scope: 'api-adapter',
    notes: 'Provider product resource shape kept for ProductEditor parity; execution is still adapter-gated.',
  },
  {
    id: 'api.products.variants.$id',
    source: 'app/routes/api.products.variants.$id/route.ts',
    scope: 'api-adapter',
    notes: 'Variant resource adapter used by ProductEditor and variant integration flows.',
  },
  {
    id: 'api.providers',
    source: 'app/routes/api.providers/route.ts',
    scope: 'api-adapter',
    notes: 'Provider discovery used by ProductSelector; V0.1 maps it to an empty provider list.',
  },
  {
    id: 'api.providers-connection.$id',
    source: 'app/routes/api.providers-connection.$id/route.ts',
    scope: 'api-adapter',
    notes: 'Provider connection detail used by imported-product publish checks; V0.1 keeps it deferred.',
  },
  {
    id: 'api.providers-integration.$id',
    source: 'app/routes/api.providers-integration.$id/route.ts',
    scope: 'api-adapter',
    notes: 'Provider import/save API referenced by ProductEditor temporary product save; V0.1 keeps it deferred.',
  },
  {
    id: 'api.shopify',
    source: 'app/routes/api.shopify/route.ts',
    scope: 'api-adapter',
    notes: 'Shopify action constants/API route referenced by TailorKit ProductEditor list actions.',
  },
  {
    id: 'api.shopify.products.$productId',
    source: 'app/routes/api.shopify.products.$productId/route.ts',
    scope: 'api-adapter',
    notes: 'Shopify product API reference used by ProductEditor detail helpers.',
  },
  {
    id: 'api.templates',
    source: 'app/routes/api.templates/route.ts',
    scope: 'api-adapter',
    notes: 'Template list/resource adapter required by ProductEditor template selection.',
  },
  {
    id: 'api.templates.$id',
    source: 'app/routes/api.templates.$id/route.ts',
    scope: 'api-adapter',
    notes: 'Template detail adapter required by ProductEditor template selection.',
  },
  {
    id: 'api.templates.$id.option-sets',
    source: 'app/routes/api.templates.$id.option-sets/route.tsx',
    scope: 'api-adapter',
    notes: 'Template option-set adapter required by ProductEditor and TemplateEditor parity.',
  },
  {
    id: 'api.templates_designs',
    source: 'app/routes/api.templates_designs/fn.server.ts',
    scope: 'api-adapter',
    notes: 'Template design support logic referenced by TailorKit template APIs.',
  },
  {
    id: 'api.option-sets',
    source: 'app/routes/api.option-sets/route.ts',
    scope: 'api-adapter',
    notes: 'Option-set resource adapter required by personalization layers.',
  },
] as const satisfies readonly TailorKitProductPersonalizerRouteDefinition[]

export const tailorkitProductPersonalizerMountableRouteIds = tailorkitProductPersonalizerV01Routes
  .filter(route => route.scope === 'mountable-admin')
  .map(route => route.id)

export const tailorkitProductPersonalizerApiRouteIds = tailorkitProductPersonalizerV01Routes
  .filter(route => route.scope === 'api-adapter')
  .map(route => route.id)

export const tailorkitProductPersonalizerV01RouteHostCoreFlowIds = [
  'list',
  'create-existing-product',
  'detail',
  'save',
  'publish',
] as const

export const tailorkitProductPersonalizerV01DeferredCoreFlowIds = ['provider-import'] as const

/**
 * V0.1 core-flow acceptance map.
 * "Mapped" means the app-platform bridge is source-mapped; copied route execution still stays disabled.
 */
export const tailorkitProductPersonalizerV01CoreFlows = [
  {
    id: 'list',
    status: 'route-hosted',
    mountableRouteIds: ['personalized-products._index'],
    apiRouteIds: ['api.personalized-products', 'api.shopify'],
    authenticatedFetchDecisionIds: ['preferences-read', 'personalized-products-list', 'shopify-products-by-ids-read'],
    pageflyRoutes: ['GET /personalized-products', 'GET /shopify-products'],
    requiredPorts: ['AdminAppHost', 'RemixRouteCompatibility', 'ctx.ports.appData'],
    notes:
      'Listing GET data and storefront-preview product lookup are mapped; copied TailorKit list route runs through the PageFly route host.',
  },
  {
    id: 'create-existing-product',
    status: 'route-hosted',
    mountableRouteIds: ['personalized-products.loading'],
    apiRouteIds: [
      'api.personalized-products',
      'api.products',
      'api.products.categories',
      'api.providers',
      'api.shopify',
    ],
    authenticatedFetchDecisionIds: [
      'product-options-read',
      'shopify-products-by-ids-read',
      'dummy-products-suggestions-read',
      'product-selector-existing-products-read',
      'product-selector-existing-categories-read',
      'product-selector-providers-read',
      'product-selector-duplicate-existing-product',
    ],
    pageflyRoutes: [
      'GET /product-options',
      'GET /shopify-products',
      'GET /dummy-products-suggestions',
      'GET /products',
      'GET /product-categories',
      'GET /providers',
      'POST /products',
    ],
    requiredPorts: ['AdminAppHost', 'RemixRouteCompatibility', 'ctx.ports.shopifyResources', 'ctx.ports.appData'],
    notes:
      'Existing Shopify ProductSelector flow is route-hosted: copied TailorKit stages variants in IndexedDB, navigates to ProductEditor, then first save persists through appData.',
  },
  {
    id: 'provider-import',
    status: 'deferred-pending-source-mapped-adapter',
    mountableRouteIds: ['personalized-products.loading', 'personalized-products.$id'],
    apiRouteIds: [
      'api.personalized-products',
      'api.products',
      'api.products.$id',
      'api.products.providers.$id',
      'api.products.variants.$id',
      'api.integrations',
      'api.providers-connection.$id',
      'api.providers-integration.$id',
      'api.shopify',
    ],
    authenticatedFetchDecisionIds: [
      'product-selector-provider-product-detail-read',
      'product-selector-provider-product-providers-read',
      'product-selector-provider-product-variants-read',
      'product-selector-products',
      'variant-metafields-read',
      'provider-connection-detail-read',
      'provider-dummy-product-import',
      'provider-imported-product-rollback-delete',
    ],
    pageflyRoutes: ['POST /personalized-products'],
    requiredPorts: ['AdminAppHost', 'RemixRouteCompatibility', 'ctx.ports.shopifyResources', 'ctx.ports.appData'],
    notes:
      'Provider/import product creation and imported-product variant metafields stay fail-closed until PageFly exposes source-mapped adapters for those TailorKit surfaces.',
  },
  {
    id: 'detail',
    status: 'route-hosted',
    mountableRouteIds: ['personalized-products.$id'],
    apiRouteIds: [
      'api.integrations.$id',
      'api.integrations',
      'api.overlay-lookup',
      'api.templates',
      'api.templates.$id',
      'api.option-sets',
      'api.products',
    ],
    authenticatedFetchDecisionIds: [
      'integration-detail-read',
      'variant-integrations-read',
      'integration-product-variants-by-ids-read',
      'integration-products-by-ids-read',
      'overlay-lookup-read',
      'overlay-lookup-transparent-regions-write',
      'template-usage-check',
      'products-by-template-read',
      'template-list-read',
      'template-detail-read',
      'option-sets-list-read',
      'option-set-layer-usage-read',
      'prompt-presets-list-read',
      'shopify-media-files-query',
      'template-upload-files',
      'colour-guide-upload-action',
      'live-charm-products-read',
      'custom-font-files-query',
      'custom-mask-files-query',
      'tutorials-list-read',
      'template-get-by-ids',
    ],
    pageflyRoutes: [
      'GET /personalized-products/:id',
      'GET /variant-integrations',
      'POST /integration-product-variants',
      'POST /integration-products',
      'GET /overlay-lookup',
      'POST /overlay-lookup',
      'POST /template-usage',
      'GET /products-by-template',
      'GET /templates',
      'GET /templates/:id',
      'GET /option-sets',
      'POST /option-set-layer-usage',
      'GET /prompt-presets',
      'POST /files/query-media',
      'POST /files/upload',
      'POST /files/colour-guide-upload',
      'GET /charm-products',
      'POST /files/query-fonts',
      'POST /files/query-masks',
      'GET /tutorials',
      'POST /templates-by-ids',
    ],
    requiredPorts: ['AdminAppHost', 'RemixRouteCompatibility', 'ctx.ports.appData', 'ctx.ports.shopifyResources'],
    notes:
      'Detail data and ProductEditor integrated-variants init are mapped; ProductEditor UI remains copied TailorKit source.',
  },
  {
    id: 'save',
    status: 'route-hosted',
    mountableRouteIds: ['personalized-products.$id'],
    apiRouteIds: ['api.integration', 'api.integrations', 'api.templates.$id'],
    authenticatedFetchDecisionIds: [
      'integration-save-action',
      'template-save-action',
      'published-integrations-by-template-read',
    ],
    pageflyRoutes: [
      'PUT /personalized-products/:id',
      'POST /templates/:id/save',
      'POST /published-integrations-by-template',
    ],
    requiredPorts: ['AdminAppHost', 'RemixRouteCompatibility', 'ctx.ports.appData'],
    notes: 'Save form-action is mapped to appData; copied ProductEditor route still owns UI behavior.',
  },
  {
    id: 'publish',
    status: 'route-hosted',
    mountableRouteIds: ['personalized-products.$id'],
    apiRouteIds: ['api.integration', 'api.integrations'],
    authenticatedFetchDecisionIds: [
      'integration-publish-action',
      'integration-unpublish-action',
      'integration-shared-templates-read',
      'published-integrations-by-variant-ids-read',
    ],
    pageflyRoutes: [
      'POST /personalized-products/:id/publish',
      'POST /personalized-products/:id/unpublish',
      'POST /shared-template-integrations',
      'POST /published-integrations-by-variant-ids',
    ],
    requiredPorts: ['AdminAppHost', 'RemixRouteCompatibility', 'ctx.ports.appData', 'ctx.ports.appMetafields'],
    notes:
      'Publish/unpublish actions are mapped; copied ProductEditor route still owns publish UI and save bar behavior.',
  },
] as const satisfies readonly TailorKitProductPersonalizerV01CoreFlow[]

export const tailorkitProductPersonalizerExcludedRoutePrefixes = [
  'storefront-setup.checkboxes',
  'api.checkboxes',
  'api.app_proxy',
  'orders',
  'api.orders',
  'pricing',
  'pricing-ver-1',
  'dashboard',
  'admin',
  'webhooks',
  'auth.login',
  'subscribe',
] as const

export const tailorkitProductPersonalizerExcludedRouteMarkers = [
  'checkbox',
  'onetick',
  'storefront-setup',
  'order',
  'pricing',
] as const
