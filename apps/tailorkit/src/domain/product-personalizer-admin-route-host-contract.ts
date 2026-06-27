import type { TailorKitProductPersonalizerRouteId } from './product-personalizer-compatibility-contract'

export type TailorKitProductPersonalizerAdminRouteId = Extract<
  TailorKitProductPersonalizerRouteId,
  'personalized-products._index' | 'personalized-products.$id' | 'personalized-products.loading'
>

export interface TailorKitProductPersonalizerAdminRouteHostDecision {
  routeId: TailorKitProductPersonalizerAdminRouteId
  upstreamSource: string
  tailorkitPathPattern: string
  pageflyPathPatterns: readonly string[]
  requiredExports: readonly string[]
  requiredHostCapabilities: readonly string[]
  status: 'runtime-hosted' | 'pending-remix-compatibility'
  notes: string
}

export interface TailorKitProductPersonalizerCopiedRouteHostContract {
  owner: 'app-platform'
  sourceOwner: 'tailorkit-upstream-mirror'
  status: 'runtime-enabled' | 'contract-only-runtime-disabled'
  upstreamRoot: string
  routeIds: readonly TailorKitProductPersonalizerAdminRouteId[]
  requiredHostCapabilities: readonly string[]
  forbiddenHostResponsibilities: readonly string[]
}

export interface TailorKitProductPersonalizerCopiedRouteSourceMap {
  routeId: TailorKitProductPersonalizerAdminRouteId
  upstreamSource: string
  supportSources: readonly string[]
  evidenceSnippets: readonly string[]
  authenticatedFetchSurfaces: readonly string[]
  hostCompatibilityRequirements: readonly string[]
  status: 'source-mapped-host-ready' | 'source-mapped-host-pending'
}

export interface TailorKitProductPersonalizerMatchedCopiedRoute {
  routeId: TailorKitProductPersonalizerAdminRouteId
  decision: TailorKitProductPersonalizerAdminRouteHostDecision
  pageflyPathname: string
  tailorkitPathname: string
  params: Readonly<Record<string, string>>
}

/**
 * Admin route host contract for the copied TailorKit Product Personalizer routes.
 * These routes execute through the PageFly app-platform copied-route runtime host.
 */
export const tailorkitProductPersonalizerAdminRouteHostDecisions = [
  {
    routeId: 'personalized-products._index',
    upstreamSource: 'app/routes/personalized-products._index/route.tsx',
    tailorkitPathPattern: '/personalized-products',
    pageflyPathPatterns: ['/app-extensions/tailorkit', '/app-extensions/tailorkit/personalized-products'],
    requiredExports: ['export const links', 'export async function clientLoader', 'export default'],
    requiredHostCapabilities: [
      'AdminAppHost',
      'Remix useNavigate/useSearchParams compatibility',
      'TailorKit clientLoader authenticatedFetch bridge',
      'TailorKit links stylesheet loader',
    ],
    status: 'runtime-hosted',
    notes:
      'Listing can only mount through copied TailorKit route source. PageFly routeBase stays the marketplace entry.',
  },
  {
    routeId: 'personalized-products.$id',
    upstreamSource: 'app/routes/personalized-products.$id/route.tsx',
    tailorkitPathPattern: '/personalized-products/:id',
    pageflyPathPatterns: ['/app-extensions/tailorkit/personalized-products/:id'],
    requiredExports: [
      'export const links',
      'export const clientLoader',
      'export function shouldRevalidate',
      'export default',
    ],
    requiredHostCapabilities: [
      'AdminAppHost',
      'Remix params/request compatibility',
      'TailorKit clientLoader authenticatedFetch bridge',
      'TailorKit links stylesheet loader',
      'TailorKit save-bar event bridge',
    ],
    status: 'runtime-hosted',
    notes: 'Detail route owns ProductEditor. PageFly must not replace it with a handwritten editor shell.',
  },
  {
    routeId: 'personalized-products.loading',
    upstreamSource: 'app/routes/personalized-products.loading/route.tsx',
    tailorkitPathPattern: '/personalized-products/loading',
    pageflyPathPatterns: ['/app-extensions/tailorkit/personalized-products/loading'],
    requiredExports: ['export const links', 'export default'],
    requiredHostCapabilities: [
      'AdminAppHost',
      'Remix location/search-param compatibility',
      'TailorKit authenticatedFetch bridge',
      'TailorKit links stylesheet loader',
    ],
    status: 'runtime-hosted',
    notes: 'Loading route remains upstream-owned because it hydrates import/create flow before entering ProductEditor.',
  },
] as const satisfies readonly TailorKitProductPersonalizerAdminRouteHostDecision[]

const pageflyTailorKitRouteBase = '/app-extensions/tailorkit'

function normalizeRoutePathname(input: string) {
  const pathname = input.match(/^https?:\/\//) ? new URL(input).pathname : input.split(/[?#]/)[0] || '/'
  const withLeadingSlash = pathname.startsWith('/') ? pathname : `/${pathname}`
  const routeBaseIndex = withLeadingSlash.indexOf(pageflyTailorKitRouteBase)
  const scopedPathname = routeBaseIndex >= 0 ? withLeadingSlash.slice(routeBaseIndex) : withLeadingSlash

  return scopedPathname.replace(/\/+$/, '') || '/'
}

function decisionFor(routeId: TailorKitProductPersonalizerAdminRouteId) {
  return tailorkitProductPersonalizerAdminRouteHostDecisions.find(decision => decision.routeId === routeId)
}

function buildMatchedRoute(
  routeId: TailorKitProductPersonalizerAdminRouteId,
  pageflyPathname: string,
  tailorkitPathname: string,
  params: Readonly<Record<string, string>> = {}
): TailorKitProductPersonalizerMatchedCopiedRoute {
  const decision = decisionFor(routeId)

  if (!decision) {
    throw new Error(`Missing TailorKit Product Personalizer route decision for ${routeId}`)
  }

  return { routeId, decision, pageflyPathname, tailorkitPathname, params }
}

/**
 * Pure route matcher for the future copied-route host.
 * It maps PageFly admin paths to TailorKit route pathnames without executing route modules.
 */
export function matchTailorKitProductPersonalizerCopiedRoute(
  inputPathname: string
): TailorKitProductPersonalizerMatchedCopiedRoute | null {
  const pageflyPathname = normalizeRoutePathname(inputPathname)
  const listPaths = [pageflyTailorKitRouteBase, `${pageflyTailorKitRouteBase}/personalized-products`]

  if (listPaths.includes(pageflyPathname)) {
    return buildMatchedRoute('personalized-products._index', pageflyPathname, '/personalized-products')
  }

  if (pageflyPathname === `${pageflyTailorKitRouteBase}/personalized-products/loading`) {
    return buildMatchedRoute('personalized-products.loading', pageflyPathname, '/personalized-products/loading')
  }

  const detailPrefix = `${pageflyTailorKitRouteBase}/personalized-products/`

  if (pageflyPathname.startsWith(detailPrefix)) {
    const rawId = pageflyPathname.slice(detailPrefix.length)

    if (!rawId || rawId.includes('/')) return null

    return buildMatchedRoute('personalized-products.$id', pageflyPathname, `/personalized-products/${rawId}`, {
      id: decodeURIComponent(rawId),
    })
  }

  return null
}

/**
 * Central route-host target for the copy-first reset.
 * This is a boundary contract only: PageFly must host copied routes, not rewrite their UI or data flow.
 */
export const tailorkitProductPersonalizerCopiedRouteHostContract = {
  owner: 'app-platform',
  sourceOwner: 'tailorkit-upstream-mirror',
  status: 'runtime-enabled',
  upstreamRoot: 'apps/tailorkit/upstream/tailorkit-app',
  routeIds: tailorkitProductPersonalizerAdminRouteHostDecisions.map(decision => decision.routeId),
  requiredHostCapabilities: [
    'route pattern matching for copied TailorKit admin routes',
    'Remix useNavigate/useSearchParams/useParams compatibility',
    'clientLoader request and params bridge',
    'links stylesheet loader',
    'authenticatedFetch rewrite through app-platform API',
    'AdminAppHost context and notifications',
  ],
  forbiddenHostResponsibilities: [
    'implement ProductEditor UI behavior',
    'implement ProductSelector UI behavior',
    'implement personalized-products list UI behavior',
    'own save/publish/unpublish orchestration outside copied TailorKit route flow',
    'import TailorKit Mongoose models/services into app package runtime',
  ],
} as const satisfies TailorKitProductPersonalizerCopiedRouteHostContract

/**
 * Source map for copied TailorKit admin routes.
 * Host implementation must satisfy these upstream surfaces before runtime activation.
 */
export const tailorkitProductPersonalizerCopiedRouteSourceMaps = [
  {
    routeId: 'personalized-products._index',
    upstreamSource: 'app/routes/personalized-products._index/route.tsx',
    supportSources: [
      'app/routes/personalized-products._index/components/RowActions.tsx',
      'app/routes/personalized-products._index/components/RowMarkupDesktop.tsx',
      'app/routes/personalized-products._index/components/RowMarkupMobile.tsx',
    ],
    evidenceSnippets: [
      "authenticatedFetch('/api/preferences')",
      'dataSource="/api/personalized-products"',
      '`/api/integrations?action=${INTEGRATION_ACTION.DELETE_PERSONALIZED_PRODUCTS}`',
      'authenticatedFetch(`/api/integrations?action=${action}`',
      '`/api/shopify?action=${SHOPIFY_API_ACTIONS.GET_PRODUCTS}',
    ],
    authenticatedFetchSurfaces: [
      'GET /api/preferences',
      'GET /api/personalized-products via ListTable dataSource',
      'POST /api/integrations?action=DELETE_PERSONALIZED_PRODUCTS',
      'POST /api/integrations?action=PUBLISH_PERSONALIZED_PRODUCTS',
      'POST /api/integrations?action=UNPUBLISH_PERSONALIZED_PRODUCTS',
      'GET /api/shopify?action=GET_PRODUCTS',
    ],
    hostCompatibilityRequirements: [
      'useNavigate/useSearchParams compatibility',
      'root loader shop/appConfig data',
      'ListTable dataSource authenticatedFetch bridge',
      'bulk action authenticatedFetch bridge',
      'RowActions storefront preview product lookup bridge',
      'TailorKit transmitter event compatibility',
    ],
    status: 'source-mapped-host-ready',
  },
  {
    routeId: 'personalized-products.$id',
    upstreamSource: 'app/routes/personalized-products.$id/route.tsx',
    supportSources: [
      'app/api/services/integrations.ts',
      'app/api/services/templates.ts',
      'app/modules/ProductEditor/components/HeaderBar/index.tsx',
      'app/modules/ProductEditor/components/IntegrationInspector/Integrate/MockupLayersManager/index.tsx',
      'app/modules/ProductEditor/components/ProductBaseSetting/AIMockup/modals/AIMockupModal.tsx',
      'app/modules/ProductEditor/components/ProductBaseSetting/AIMockup/modals/ApplyAIMockupsConfirmationModal.tsx',
      'app/modules/ProductEditor/components/UnifiedHeader/index.tsx',
      'app/modules/TemplateEditor/components/Editor/hooks/useElementActions.ts',
      'app/modules/TemplateEditor/components/Header/SaveTemplateButton.tsx',
      'app/modules/TemplateEditor/components/Outline/ToolSidebar/panels/hooks/useLiveCharmProducts.ts',
      'app/modules/TemplateEditor/elements/components/Text/ColorOptionSet/ColourGuideUpload.tsx',
      'app/modules/TemplateEditor/elements/fns.ts',
      'app/modules/TemplateEditor/hooks/useSaveTemplate.tsx',
      'app/modules/TemplateEditor/modals/RepublishProductsModal.tsx',
      'app/modules/TemplateEditor/utils/removeImageBackground.ts',
    ],
    evidenceSnippets: [
      'const dataSource = `/api/integrations/${id}?mockup=${mockupId}&populateTemplate=1`',
      'const integration = await authenticatedFetch(dataSource)',
      'FETCH_PRODUCT_VARIANTS_BY_VARIANT_IDS',
      'FETCH_PRODUCT_BY_PRODUCT_ID',
      'CHECK_SHARED_TEMPLATES_WITH_PUBLISHED',
      'FETCH_INTEGRATIONS_BY_VARIANT_IDS',
      'FETCH_INTEGRATIONS_BY_TEMPLATE',
      "authenticatedFetch('/api/overlay-lookup', {",
      "authenticatedFetch('/api/ai-mockup-scenes', { preferCache: true })",
      "authenticatedFetch('/api/mockup-upload', {",
      "fetch('/api/services', {",
      "authenticatedFetch('/api/colour-guide/upload', {",
      'fetch(`/api/charm-products?ids=${encodeURIComponent(idsToFetch.join',
      '`/api/products/?templateId=${templateId}`',
      'async list(',
      'async getById(id: string)',
      'TemplatesService.create(templateEditor._id, formData)',
      'FIND_LAYER_BEING_USED',
      'TEMPLATES_ACTIONS.GET_TEMPLATES_BY_IDS',
      "authenticatedFetch('/api/prompt-presets')",
      '`/api/providers-connection/${provider?._id}`',
      'sendMessageToMainApp(EActionType.SAVED_PRODUCT)',
      '<ui-save-bar id={SAVE_BAR_ID.PERSONALIZED_PRODUCTS_SAVE_BAR}',
    ],
    authenticatedFetchSurfaces: [
      'GET /api/integrations/:id?mockup=:mockupId&populateTemplate=1',
      'POST /api/integrations?action=fetchProductVariantsByVariantIds',
      'POST /api/integrations?action=fetchProductByProductId',
      'POST /api/integrations?action=checkSharedTemplatesWithPublished',
      'POST /api/integrations?action=fetchIntegrationsByVariantIds',
      'POST /api/integrations?action=fetchIntegrationsByTemplate',
      'POST /api/overlay-lookup',
      'GET /api/ai-mockup-scenes',
      'POST /api/ai-mockup-scenes',
      'POST /api/mockup-upload',
      'POST /api/shopify/products/:productId',
      'POST /api/services',
      'POST /api/colour-guide/upload',
      'GET /api/charm-products',
      'GET /api/products?templateId=:templateId',
      'GET /api/templates',
      'GET /api/templates/:id',
      'POST /api/templates/:id type=saveTemplate',
      'POST /api/option-sets?action=findLayerBeingUsed',
      'POST /api/templates?action=getTemplatesByIds',
      'GET /api/prompt-presets',
      'GET /api/providers-connection/:id',
      'POST /api/files?action=queryFontFiles',
      'POST /api/files?action=queryMaskFiles',
      'GET /api/tutorials',
    ],
    hostCompatibilityRequirements: [
      'params/request clientLoader bridge',
      'authenticatedFetch integration detail bridge',
      'ui-save-bar bridge',
      'modalEvents sendMessageToMainApp compatibility',
      'live chat/title bar compatibility',
    ],
    status: 'source-mapped-host-ready',
  },
  {
    routeId: 'personalized-products.loading',
    upstreamSource: 'app/routes/personalized-products.loading/route.tsx',
    supportSources: [],
    evidenceSnippets: [
      '`/api/shopify?action=${SHOPIFY_API_ACTIONS.GET_PRODUCTS}',
      'TemplatesService.getClipartsDetails',
      'duplicateClipartTemplate',
      'TemplatesService.getByIds',
      'navigate(url.pathname + url.search, { replace: true })',
    ],
    authenticatedFetchSurfaces: [
      'GET /api/shopify?action=GET_PRODUCTS',
      'TemplatesService.getClipartsDetails',
      'TemplatesService.getByIds',
      'duplicateClipartTemplate',
    ],
    hostCompatibilityRequirements: [
      'useLocation/useNavigate/useSearchParams compatibility',
      'location state bridge',
      'dummy product and clipart import services',
      'template clone service bridge',
      'temporary product storage compatibility',
      'replace navigation into copied detail route',
    ],
    status: 'source-mapped-host-ready',
  },
] as const satisfies readonly TailorKitProductPersonalizerCopiedRouteSourceMap[]
