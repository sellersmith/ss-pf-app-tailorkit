import type { tailorkitProductPersonalizerV01Routes } from './product-personalizer-route-scope'

export type TailorKitProductPersonalizerRouteId = (typeof tailorkitProductPersonalizerV01Routes)[number]['id']

export type TailorKitProductPersonalizerCompatibilityStatus =
  | 'runtime-hosted-copied-route'
  | 'partial-pagefly-port-adapter'
  | 'pending-pagefly-port-adapter'

export interface TailorKitProductPersonalizerCompatibilityDecision {
  routeId: TailorKitProductPersonalizerRouteId
  upstreamSource: string
  status: TailorKitProductPersonalizerCompatibilityStatus
  pageflyFiles: readonly string[]
  pageflyEndpoints: readonly string[]
  requiredPorts: readonly string[]
  notes: string
}

/**
 * Compatibility contract for the copy-first TailorKit migration.
 * A partial adapter is executable plumbing only; it is not ProductEditor parity.
 */
export const tailorkitProductPersonalizerCompatibilityDecisions = [
  {
    routeId: 'personalized-products._index',
    upstreamSource: 'app/routes/personalized-products._index/route.tsx',
    status: 'runtime-hosted-copied-route',
    pageflyFiles: ['apps/tailorkit/upstream/tailorkit-app/app/routes/personalized-products._index/route.tsx'],
    pageflyEndpoints: [],
    requiredPorts: ['AdminAppHost', 'RemixRouteCompatibility'],
    notes: 'Listing UI is copied from TailorKit and now runs through the PageFly copied-route runtime host.',
  },
  {
    routeId: 'personalized-products.$id',
    upstreamSource: 'app/routes/personalized-products.$id/route.tsx',
    status: 'runtime-hosted-copied-route',
    pageflyFiles: ['apps/tailorkit/upstream/tailorkit-app/app/routes/personalized-products.$id/route.tsx'],
    pageflyEndpoints: [],
    requiredPorts: ['AdminAppHost', 'RemixRouteCompatibility'],
    notes:
      'ProductEditor detail route runs through copied TailorKit source; PageFly must not replace it with a handwritten detail shell.',
  },
  {
    routeId: 'personalized-products.loading',
    upstreamSource: 'app/routes/personalized-products.loading/route.tsx',
    status: 'runtime-hosted-copied-route',
    pageflyFiles: ['apps/tailorkit/upstream/tailorkit-app/app/routes/personalized-products.loading/route.tsx'],
    pageflyEndpoints: [],
    requiredPorts: ['AdminAppHost', 'RemixRouteCompatibility'],
    notes: 'Loading route remains upstream-owned and runs through the PageFly copied-route runtime host.',
  },
  {
    routeId: 'api.personalized-products',
    upstreamSource: 'app/routes/api.personalized-products/route.ts',
    status: 'partial-pagefly-port-adapter',
    pageflyFiles: ['apps/tailorkit/src/backend/product-personalizer-api.ts'],
    pageflyEndpoints: ['GET /personalized-products', 'POST /personalized-products'],
    requiredPorts: ['ctx.ports.appData'],
    notes:
      'PageFly maps list reads through appData; POST create remains a fail-closed partial adapter for provider/import paths, not full upstream action parity.',
  },
  {
    routeId: 'api.integration',
    upstreamSource: 'app/routes/api.integration/route.ts',
    status: 'partial-pagefly-port-adapter',
    pageflyFiles: [
      'apps/tailorkit/src/backend/product-personalizer-api.ts',
      'apps/tailorkit/src/backend/product-personalizer-repository.ts',
    ],
    pageflyEndpoints: [
      'PUT /personalized-products/:id',
      'POST /personalized-products/:id/publish',
      'POST /personalized-products/:id/unpublish',
    ],
    requiredPorts: ['ctx.ports.appData', 'ctx.ports.appMetafields'],
    notes:
      'TailorKit save/publish FormData actions are mapped through the admin bridge and ports; parity is still partial because non-core integration actions stay deferred.',
  },
  {
    routeId: 'api.integrations',
    upstreamSource: 'app/routes/api.integrations/route.ts',
    status: 'partial-pagefly-port-adapter',
    pageflyFiles: [
      'apps/tailorkit/src/backend/product-personalizer-api.ts',
      'apps/tailorkit/src/backend/product-personalizer-repository.ts',
    ],
    pageflyEndpoints: [
      'POST /integrations-bulk',
      'POST /integration-product-variants',
      'POST /integration-products',
      'POST /shared-template-integrations',
    ],
    requiredPorts: ['ctx.ports.appData', 'ctx.ports.appMetafields', 'ctx.ports.shopifyResources'],
    notes:
      'Bulk actions and ProductEditor read helpers are mapped through app-platform ports; other upstream integrations actions remain pending.',
  },
  {
    routeId: 'api.integrations.$id',
    upstreamSource: 'app/routes/api.integrations.$id/route.tsx',
    status: 'partial-pagefly-port-adapter',
    pageflyFiles: ['apps/tailorkit/src/backend/product-personalizer-api.ts'],
    pageflyEndpoints: ['GET /personalized-products/:id'],
    requiredPorts: ['ctx.ports.appData', 'ctx.ports.shopContext', 'ctx.ports.shopifyTheme'],
    notes:
      'Copied ProductEditor detail loader maps TailorKit GET /api/integrations/:id to PageFly appData and loader config ports; broader integration mutations remain partial.',
  },
  {
    routeId: 'api.products',
    upstreamSource: 'app/routes/api.products/route.ts',
    status: 'partial-pagefly-port-adapter',
    pageflyFiles: ['apps/tailorkit/src/backend/product-personalizer-api.ts'],
    pageflyEndpoints: ['GET /product-options', 'GET /dummy-products-suggestions'],
    requiredPorts: ['ctx.ports.shopifyResources'],
    notes:
      'PageFly exposes existing-product reads and empty dummy suggestions; TailorKit product API parity is still narrower than upstream.',
  },
  {
    routeId: 'api.products.categories',
    upstreamSource: 'app/routes/api.products.categories/route.ts',
    status: 'partial-pagefly-port-adapter',
    pageflyFiles: ['apps/tailorkit/src/backend/product-personalizer-api.ts'],
    pageflyEndpoints: ['GET /product-categories'],
    requiredPorts: ['ctx.ports.shopifyResources'],
    notes:
      'ProductSelector existing-product category reads are mapped through PageFly ports; non-existing provider/import category parity remains partial.',
  },
  {
    routeId: 'api.products.variants.$id',
    upstreamSource: 'app/routes/api.products.variants.$id/route.ts',
    status: 'partial-pagefly-port-adapter',
    pageflyFiles: ['apps/tailorkit/src/backend/product-personalizer-api.ts'],
    pageflyEndpoints: ['GET /product-options'],
    requiredPorts: ['ctx.ports.shopifyResources'],
    notes: 'Variant data is available through setup options; single-variant upstream route parity remains pending.',
  },
  {
    routeId: 'api.providers',
    upstreamSource: 'app/routes/api.providers/route.ts',
    status: 'partial-pagefly-port-adapter',
    pageflyFiles: ['apps/tailorkit/src/backend/product-personalizer-api.ts'],
    pageflyEndpoints: ['GET /providers'],
    requiredPorts: ['ctx.ports.shopifyResources'],
    notes:
      'Provider discovery is mapped to the current empty PageFly provider list, but provider imports still stay fail-closed and partial.',
  },
  {
    routeId: 'api.shopify',
    upstreamSource: 'app/routes/api.shopify/route.ts',
    status: 'partial-pagefly-port-adapter',
    pageflyFiles: ['apps/tailorkit/src/backend/product-personalizer-api.ts'],
    pageflyEndpoints: ['GET /shopify-products'],
    requiredPorts: ['ctx.ports.shopifyResources'],
    notes:
      'Copied listing and ProductSelector Shopify product lookups are mapped through PageFly ports; broader upstream Shopify actions remain partial.',
  },
  {
    routeId: 'api.overlay-lookup',
    upstreamSource: 'app/routes/api.overlay-lookup/route.ts',
    status: 'partial-pagefly-port-adapter',
    pageflyFiles: ['apps/tailorkit/src/backend/product-personalizer-api.ts'],
    pageflyEndpoints: ['GET /overlay-lookup', 'POST /overlay-lookup'],
    requiredPorts: ['ctx.ports.appData'],
    notes:
      'Premade overlay lookup is partial: PageFly maps an empty optional catalog response and scoped transparent-region cache writes, but TailorKit global Asset overlay parity is not migrated.',
  },
  {
    routeId: 'api.templates',
    upstreamSource: 'app/routes/api.templates/route.ts',
    status: 'partial-pagefly-port-adapter',
    pageflyFiles: ['apps/tailorkit/src/backend/product-personalizer-api.ts'],
    pageflyEndpoints: [
      'GET /templates',
      'POST /templates-by-ids',
      'POST /template-usage',
      'GET /prompt-presets',
      'POST /files/query-media',
      'POST /files/upload',
      'POST /files/query-fonts',
      'POST /files/query-masks',
      'GET /tutorials',
    ],
    requiredPorts: ['ctx.ports.appData', 'ctx.ports.shopifyResources'],
    notes:
      'Template route parity is partial: PageFly maps merchant template listing, ProductEditor preview reads by id, the copied ModalEditTemplate checkTemplateUsage action to app-scoped template snapshots, ImageSelector media-library reads, and base64-bridged ImageSelector uploads through the Shopify resource port.',
  },
  {
    routeId: 'api.templates.$id',
    upstreamSource: 'app/routes/api.templates.$id/route.ts',
    status: 'partial-pagefly-port-adapter',
    pageflyFiles: ['apps/tailorkit/src/backend/product-personalizer-api.ts'],
    pageflyEndpoints: ['GET /templates/:id', 'POST /templates/:id/save'],
    requiredPorts: ['ctx.ports.appData'],
    notes:
      'Template detail route parity is partial: PageFly supports ProductEditor template selection and copied TemplateEditor snapshot save; binary preview upload and broader template mutations remain pending.',
  },
  {
    routeId: 'api.option-sets',
    upstreamSource: 'app/routes/api.option-sets/route.ts',
    status: 'partial-pagefly-port-adapter',
    pageflyFiles: ['apps/tailorkit/src/backend/product-personalizer-api.ts'],
    pageflyEndpoints: ['GET /option-sets', 'POST /option-set-layer-usage'],
    requiredPorts: ['ctx.ports.appData'],
    notes:
      'Option-set parity is partial: PageFly maps copied TemplateEditor option-set listing and layer usage count through scoped appData, while broader option-set mutations remain pending.',
  },
  {
    routeId: 'api.charm-products',
    upstreamSource: 'app/routes/api.charm-products/route.ts',
    status: 'partial-pagefly-port-adapter',
    pageflyFiles: ['apps/tailorkit/src/backend/product-personalizer-api.ts'],
    pageflyEndpoints: ['GET /charm-products'],
    requiredPorts: ['ctx.ports.shopifyResources'],
    notes:
      'Charm picker live product hydration is mapped through a narrower Shopify resource read (title/price/availability by id); broader TailorKit charm catalog services are still not proven.',
  },
  {
    routeId: 'api.colour-guide.upload',
    upstreamSource: 'app/routes/api.colour-guide.upload/route.ts',
    status: 'partial-pagefly-port-adapter',
    pageflyFiles: ['apps/tailorkit/src/backend/product-personalizer-api.ts'],
    pageflyEndpoints: ['POST /files/colour-guide-upload'],
    requiredPorts: ['ctx.ports.shopifyResources'],
    notes:
      'Colour Guide single-file upload is mapped through a narrower base64→S3 resource write; broader TailorKit media services are still not proven.',
  },
  ...[
    ['api.products.$id', 'app/routes/api.products.$id/route.ts'],
    ['api.products.providers.$id', 'app/routes/api.products.providers.$id/route.ts'],
    ['api.providers-connection.$id', 'app/routes/api.providers-connection.$id/route.ts'],
    ['api.providers-integration.$id', 'app/routes/api.providers-integration.$id/route.ts'],
    ['api.shopify.products.$productId', 'app/routes/api.shopify.products.$productId/route.ts'],
    ['api.templates.$id.option-sets', 'app/routes/api.templates.$id.option-sets/route.tsx'],
    ['api.templates_designs', 'app/routes/api.templates_designs/fn.server.ts'],
    ['api.services', 'app/routes/api.services/route.tsx'],
  ].map(([routeId, upstreamSource]) => ({
    routeId: routeId as TailorKitProductPersonalizerRouteId,
    upstreamSource,
    status: 'pending-pagefly-port-adapter' as const,
    pageflyFiles: [],
    pageflyEndpoints: [],
    requiredPorts: ['ctx.ports.appData', 'ctx.ports.shopifyResources'],
    notes:
      'Required by copied TailorKit ProductEditor flow; keep pending until adapter behavior is mapped from upstream.',
  })),
] as const satisfies readonly TailorKitProductPersonalizerCompatibilityDecision[]
