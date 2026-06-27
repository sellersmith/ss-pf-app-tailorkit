export type TailorKitProductEditorAdapterStatus =
  | 'mirrored'
  | 'active-adapter'
  | 'pending-adapter'
  | 'quarantined-rewrite'

export interface TailorKitProductEditorAdapterSeam {
  id: string
  upstreamSources: readonly string[]
  pageflyAdapter: string
  requiredPorts: readonly string[]
  status: TailorKitProductEditorAdapterStatus
  notes: string
}

export const tailorkitProductEditorAdapterSeams = [
  {
    id: 'list-personalized-products',
    upstreamSources: ['app/routes/personalized-products._index/route.tsx'],
    pageflyAdapter: 'apps/tailorkit/src/admin/copied-routes/runtime-entry.ts',
    requiredPorts: ['AdminAppHost', 'RemixRouteCompatibility', 'ctx.ports.appData'],
    status: 'active-adapter',
    notes:
      'Listing source is pinned to the app-level copied TailorKit route mirror and runs through the PageFly copied-route host.',
  },
  {
    id: 'load-product-editor-detail',
    upstreamSources: [
      'app/routes/personalized-products.$id/route.tsx',
      'app/modules/ProductEditor/hooks/useInitIntegration.ts',
    ],
    pageflyAdapter: 'apps/tailorkit/src/admin/copied-routes/runtime-entry.ts',
    requiredPorts: ['ctx.ports.appData', 'ctx.ports.shopifyResources'],
    status: 'active-adapter',
    notes:
      'Detail route runs through the copied TailorKit route host with PageFly useLoaderData and authenticatedFetch shims; the handwritten scaffold is not executable behavior.',
  },
  {
    id: 'save-product-editor',
    upstreamSources: ['app/modules/ProductEditor/hooks/useUnifiedSave.ts', 'app/routes/api.integration/route.ts'],
    pageflyAdapter: 'apps/tailorkit/src/domain/product-personalizer-integration-action-request.ts',
    requiredPorts: ['ctx.ports.appData'],
    status: 'active-adapter',
    notes:
      'Copied upstream save-product FormData is mapped at the authenticatedFetch boundary and persists through appData without reimplementing ProductEditor behavior.',
  },
  {
    id: 'publish-product-editor',
    upstreamSources: ['app/modules/ProductEditor/hooks/useUnifiedPublish.ts', 'app/routes/api.integration/route.ts'],
    pageflyAdapter: 'apps/tailorkit/src/backend/product-personalizer-repository.ts',
    requiredPorts: ['ctx.ports.appData', 'ctx.ports.appMetafields'],
    status: 'active-adapter',
    notes:
      'Copied upstream publish/unpublish FormData is mapped to PageFly ports and publishes app-scoped metafield snapshots. Publish-all shared integration ids are republished through the same mapped action; template mutation/upload parity remains deferred.',
  },
  {
    id: 'product-and-template-resources',
    upstreamSources: [
      'app/routes/api.products/route.ts',
      'app/routes/api.templates/route.ts',
      'app/api/services/templates.ts',
    ],
    pageflyAdapter: 'apps/tailorkit/src/backend/product-personalizer-api.ts',
    requiredPorts: ['ctx.ports.shopifyResources', 'ctx.ports.appData'],
    status: 'active-adapter',
    notes:
      'Product options, existing integration product lookups, template list/detail reads, and variant integration snapshots are mapped through app-platform ports for copied ProductEditor detail.',
  },
  {
    id: 'deferred-provider-import-and-support',
    upstreamSources: [
      'app/routes/api.providers-integration.$id/route.ts',
      'app/modules/ProductEditor/withTemplateLayerUploader.tsx',
      'app/modules/ProductEditor/utilities/getVariantMetafields.ts',
    ],
    pageflyAdapter: 'apps/tailorkit/src/domain/product-personalizer-authenticated-fetch-bridge-contract.ts',
    requiredPorts: [
      'future provider product port',
      'future template upload/catalog port',
      'future variant metafields port',
    ],
    status: 'pending-adapter',
    notes:
      'Provider/import, template upload/catalog, and imported-product variant metafield support remain intentionally fail-closed; they are not required for copied list/detail/save/publish V0.1.',
  },
] as const satisfies readonly TailorKitProductEditorAdapterSeam[]

export const tailorkitProductEditorForbiddenActiveImports = [
  '../product-editor-host',
  './product-editor-host',
  '../use-tailorkit-product-selector',
  './use-tailorkit-product-selector',
  './product-selector-modal',
  './personalized-products-list',
  '~/models/',
  '~/shopify/app.server',
  '@remix-run/node',
  '@remix-run/react',
  'extensions/tailorkit-src',
  '/Users/phanconglong/Documents/Projects/emtailorkit',
] as const

export const tailorkitProductEditorUpstreamOnlyImportPrefixes = [
  '~/models/',
  '~/routes/api.',
  '~/routes/dashboard',
  '~/routes/pricing._index',
  '~/providers/ChatBotContext',
] as const
