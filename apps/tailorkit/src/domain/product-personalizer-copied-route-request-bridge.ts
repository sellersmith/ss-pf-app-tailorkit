import {
  tailorkitAuthenticatedFetchBridgeDecisions,
  type TailorKitAuthenticatedFetchBridgeDecision,
} from './product-personalizer-authenticated-fetch-bridge-contract'

export type TailorKitCopiedRouteRequestBridgeStatus =
  | 'mapped'
  | 'blocked-pending-source-mapped-adapter'
  | 'requires-payload-adapter'
  | 'unsupported'

export interface TailorKitCopiedRouteRequestBridgeInput {
  method?: string
  path: string
  action?: string | null
  integrationId?: string | null
}

export interface TailorKitCopiedRouteRequestBridgeResult {
  status: TailorKitCopiedRouteRequestBridgeStatus
  sourceDecisionId: string | null
  sourceDecisionStatus: TailorKitAuthenticatedFetchBridgeDecision['status'] | null
  sourceMethod: string
  sourcePath: string
  pageflyMethod: 'GET' | 'POST' | 'PUT' | null
  pageflyPath: string | null
  reason: string
}

const TAILORKIT_INTEGRATION_ACTIONS = {
  saveProduct: 'save-product',
  publishProduct: 'publish-product',
  unpublishProduct: 'unpublish-product',
} as const

const TAILORKIT_INTEGRATIONS_BULK_ACTIONS = {
  deletePersonalizedProducts: 'deletePersonalizedProducts',
  publishPersonalizedProducts: 'publishPersonalizedProducts',
  unpublishPersonalizedProducts: 'unpublishPersonalizedProducts',
  fetchProductVariantMetafields: 'fetchProductVariantMetafields',
  fetchProductVariantsByVariantIds: 'fetchProductVariantsByVariantIds',
  fetchAllProductVariants: 'fetchAllProductVariants',
  fetchProductByProductId: 'fetchProductByProductId',
  checkSharedTemplatesWithPublished: 'checkSharedTemplatesWithPublished',
  fetchIntegrationsByVariantIds: 'fetchIntegrationsByVariantIds',
  fetchIntegrationsByTemplate: 'fetchIntegrationsByTemplate',
} as const

const TAILORKIT_SHOPIFY_ACTIONS = {
  getProducts: 'getProducts',
  getProductImages: 'getProductImages',
  deleteProduct: 'deleteProduct',
  checkUserHasProduct: 'checkUserHasProduct',
  getAppHandle: 'getAppHandle',
} as const

const TAILORKIT_PRODUCT_MUTATION_ACTIONS = {
  duplicateExistingProduct: 'duplicate_existing_product',
} as const

const TAILORKIT_PROVIDER_INTEGRATION_ACTIONS = {
  importDummyProductsToShopify: 'import-dummy-products-to-shopify',
  importProductsToShopify: 'import-products-to-shopify',
} as const

const TAILORKIT_TEMPLATE_ACTIONS = {
  uploadFiles: 'uploadFiles',
  checkTemplateUsage: 'checkTemplateUsage',
  getTemplatesByIds: 'getTemplatesByIds',
  getClipartsDetails: 'getClipartsDetails',
  cloneClipartToTemplate: 'cloneClipartToTemplate',
  saveTemplate: 'saveTemplate',
} as const

const TAILORKIT_FILE_ACTIONS = {
  fetchMediaLists: 'fetchMediaLists',
  queryFontFiles: 'queryFontFiles',
  queryMaskFiles: 'queryMaskFiles',
} as const

const TAILORKIT_OPTION_SET_ACTIONS = {
  findLayerBeingUsed: 'findLayerBeingUsed',
} as const

const TAILORKIT_USER_JOURNEY_ACTIONS = {
  saveOnboardingProgressState: 'save_onboarding_progress_state',
} as const

function decision(id: string): TailorKitAuthenticatedFetchBridgeDecision {
  const item = tailorkitAuthenticatedFetchBridgeDecisions.find(entry => entry.id === id)

  if (!item) throw new Error(`Missing TailorKit authenticatedFetch bridge decision: ${id}`)

  return item
}

function parse(input: TailorKitCopiedRouteRequestBridgeInput) {
  const method = (input.method || 'GET').toUpperCase()
  const url = new URL(input.path, 'https://tailorkit.local')
  const pathname = url.pathname.replace(/\/+$/, '') || '/'
  return { method, url, pathname, search: url.search }
}

function mapped(
  sourceDecisionId: string,
  sourceMethod: string,
  sourcePath: string,
  pageflyMethod: 'GET' | 'POST' | 'PUT',
  pageflyPath: string
): TailorKitCopiedRouteRequestBridgeResult {
  const sourceDecision = decision(sourceDecisionId)

  return {
    status: 'mapped',
    sourceDecisionId,
    sourceDecisionStatus: sourceDecision.status,
    sourceMethod,
    sourcePath,
    pageflyMethod,
    pageflyPath,
    reason: sourceDecision.notes,
  }
}

function blocked(
  sourceDecisionId: string,
  sourceMethod: string,
  sourcePath: string
): TailorKitCopiedRouteRequestBridgeResult {
  const sourceDecision = decision(sourceDecisionId)

  return {
    status: 'blocked-pending-source-mapped-adapter',
    sourceDecisionId,
    sourceDecisionStatus: sourceDecision.status,
    sourceMethod,
    sourcePath,
    pageflyMethod: null,
    pageflyPath: null,
    reason: sourceDecision.notes,
  }
}

function unsupported(
  sourceMethod: string,
  sourcePath: string,
  reason: string
): TailorKitCopiedRouteRequestBridgeResult {
  return {
    status: 'unsupported',
    sourceDecisionId: null,
    sourceDecisionStatus: null,
    sourceMethod,
    sourcePath,
    pageflyMethod: null,
    pageflyPath: null,
    reason,
  }
}

/** Resolves copied TailorKit authenticatedFetch requests to PageFly app API paths without performing network IO. */
export function resolveTailorKitCopiedRouteRequestBridge(
  input: TailorKitCopiedRouteRequestBridgeInput
): TailorKitCopiedRouteRequestBridgeResult {
  const { method, url, pathname, search } = parse(input)

  if (pathname === '/api/preferences') {
    if (method === 'GET') return mapped('preferences-read', method, pathname, 'GET', `/theme-config${search}`)
    if (method === 'POST') return mapped('preferences-mutation', method, pathname, 'POST', '/preferences')
    return unsupported(method, pathname, `Unsupported TailorKit /api/preferences method: ${method}`)
  }

  if (pathname === '/api/user-journey') {
    const action = input.action || url.searchParams.get('action') || ''

    if (method === 'GET') {
      return mapped('user-journey-read', method, `${pathname}${search}`, 'GET', `/user-journey${search}`)
    }
    if (method === 'POST' && action === TAILORKIT_USER_JOURNEY_ACTIONS.saveOnboardingProgressState) {
      return mapped('user-journey-save-progress', method, `${pathname}${search}`, 'POST', '/user-journey')
    }

    return unsupported(
      method,
      `${pathname}${search}`,
      `Unsupported TailorKit /api/user-journey action: ${action || '<missing>'}`
    )
  }

  if (pathname === '/api/personalized-products') {
    if (method === 'GET')
      return mapped('personalized-products-list', method, pathname, 'GET', `/personalized-products${search}`)
    return blocked('product-selector-products', method, pathname)
  }

  // Orders list/detail. The copied Orders ListTable fetches `/api/orders` (list) and the detail
  // clientLoader fetches `/api/orders?filter__id=...`; both map to the PageFly `/orders` read endpoint.
  if (pathname === '/api/orders' && method === 'GET') {
    return mapped('orders-list-read', method, `${pathname}${search}`, 'GET', `/orders${search}`)
  }

  // Saved ListTable filter "views" (custom tabs). Shared by every copied ListTable mount (PP + Orders).
  // PageFly does not persist custom views, so map to the `/views` read which returns an empty list.
  if (pathname === '/api/views' && method === 'GET') {
    return mapped('list-table-views-read', method, `${pathname}${search}`, 'GET', `/views${search}`)
  }

  if (pathname === '/api/products/categories') {
    const source = url.searchParams.get('source') || 'existing'

    if (method === 'GET' && source === 'existing') {
      return mapped(
        'product-selector-existing-categories-read',
        method,
        `${pathname}${search}`,
        'GET',
        `/product-categories${search}`
      )
    }

    return blocked('product-selector-products', method, `${pathname}${search}`)
  }

  if (pathname.startsWith('/api/products/providers/') && method === 'GET') {
    return blocked('product-selector-provider-product-providers-read', method, `${pathname}${search}`)
  }

  if (pathname.startsWith('/api/products/variants/') && method === 'GET') {
    return blocked('product-selector-provider-product-variants-read', method, `${pathname}${search}`)
  }

  if (pathname.startsWith('/api/products/') && method === 'GET') {
    return blocked('product-selector-provider-product-detail-read', method, `${pathname}${search}`)
  }

  if (pathname === '/api/products') {
    const source = url.searchParams.get('source') || 'existing'
    const action = input.action || url.searchParams.get('action') || ''
    const templateId = url.searchParams.get('templateId') || ''

    if (method === 'GET' && source === 'dummy' && url.searchParams.get('onlySuggestions') === 'true') {
      return mapped(
        'dummy-products-suggestions-read',
        method,
        `${pathname}${search}`,
        'GET',
        '/dummy-products-suggestions'
      )
    }

    if (method === 'GET' && source === 'existing' && templateId) {
      return mapped(
        'products-by-template-read',
        method,
        `${pathname}${search}`,
        'GET',
        `/products-by-template${search}`
      )
    }

    if (method === 'GET' && source === 'existing') {
      return mapped(
        'product-selector-existing-products-read',
        method,
        `${pathname}${search}`,
        'GET',
        `/products${search}`
      )
    }

    if (method === 'POST' && action === TAILORKIT_PRODUCT_MUTATION_ACTIONS.duplicateExistingProduct) {
      return mapped('product-selector-duplicate-existing-product', method, pathname, 'POST', '/products')
    }

    return blocked('product-selector-products', method, `${pathname}${search}`)
  }

  if (pathname === '/api/providers') {
    if (method === 'GET') return mapped('product-selector-providers-read', method, pathname, 'GET', '/providers')
    return blocked('product-selector-products', method, pathname)
  }

  if (pathname.startsWith('/api/providers-connection/') && method === 'GET') {
    return blocked('provider-connection-detail-read', method, pathname)
  }

  if (pathname.startsWith('/api/providers-integration/')) {
    if (method === 'POST' && input.action === TAILORKIT_PROVIDER_INTEGRATION_ACTIONS.importDummyProductsToShopify) {
      return blocked('provider-dummy-product-import', method, pathname)
    }

    if (method === 'POST' && input.action === TAILORKIT_PROVIDER_INTEGRATION_ACTIONS.importProductsToShopify) {
      return blocked('product-selector-products', method, pathname)
    }

    return unsupported(
      method,
      pathname,
      `Unsupported TailorKit /api/providers-integration/:id action: ${input.action || '<missing>'}`
    )
  }

  if (pathname === '/api/ai-mockup-scenes') {
    if (method === 'GET') return blocked('ai-mockup-scenes-read', method, pathname)
    if (method === 'POST') return blocked('ai-mockup-generate-action', method, pathname)
    return unsupported(method, pathname, `Unsupported TailorKit /api/ai-mockup-scenes method: ${method}`)
  }

  if (pathname === '/api/mockup-upload') {
    if (method === 'POST') return blocked('ai-mockup-upload-action', method, pathname)
    return unsupported(method, pathname, `Unsupported TailorKit /api/mockup-upload method: ${method}`)
  }

  if (pathname.startsWith('/api/shopify/products/')) {
    if (method === 'POST') return blocked('ai-mockup-shopify-product-media-write', method, pathname)
    return unsupported(method, pathname, `Unsupported TailorKit /api/shopify/products method: ${method}`)
  }

  if (pathname === '/api/services') {
    if (method === 'POST') return blocked('background-removal-service-action', method, pathname)
    return unsupported(method, pathname, `Unsupported TailorKit /api/services method: ${method}`)
  }

  if (pathname === '/api/colour-guide/upload') {
    if (method === 'POST')
      return mapped('colour-guide-upload-action', method, pathname, 'POST', '/files/colour-guide-upload')
    return unsupported(method, pathname, `Unsupported TailorKit /api/colour-guide/upload method: ${method}`)
  }

  // Sales Tools — Storefront tab EmojiPickerCard "apply to all".
  if (pathname === '/api/emoji-picker/apply-to-all') {
    if (method === 'POST')
      return mapped('emoji-picker-apply-action', method, pathname, 'POST', '/emoji-picker/apply-to-all')
    return unsupported(method, pathname, `Unsupported TailorKit /api/emoji-picker/apply-to-all method: ${method}`)
  }

  // Sales Tools — Storefront-tab InstallAppEmbedActivator (ENSURE_PRICING_PRODUCT). The Upsell tab that
  // also called this was dropped (OneTick), but the Storefront tab's app-embed activator still fires it.
  if (pathname === '/api/option-pricing') {
    if (method === 'POST')
      return mapped('option-pricing-ensure-action', method, pathname, 'POST', '/option-pricing')
    return unsupported(method, pathname, `Unsupported TailorKit /api/option-pricing method: ${method}`)
  }

  if (pathname === '/api/charm-products') {
    if (method === 'GET')
      return mapped('live-charm-products-read', method, `${pathname}${search}`, 'GET', `/charm-products${search}`)
    return unsupported(method, pathname, `Unsupported TailorKit /api/charm-products method: ${method}`)
  }

  if (pathname === '/api/ai-assistant/suggest-font-combinations') {
    if (method === 'POST')
      return mapped(
        'font-combination-suggestions-read',
        method,
        pathname,
        'POST',
        '/font-combination-suggestions'
      )
    return unsupported(
      method,
      pathname,
      `Unsupported TailorKit /api/ai-assistant/suggest-font-combinations method: ${method}`
    )
  }

  if (pathname === '/api/shopify' && method === 'GET') {
    const action = url.searchParams.get('action') || ''
    const ids = url.searchParams.get('ids') || ''
    const productId = url.searchParams.get('productId') || ''

    if (action === TAILORKIT_SHOPIFY_ACTIONS.getProducts) {
      const pageflySearch = ids ? `?ids=${encodeURIComponent(ids)}` : ''
      return mapped(
        'shopify-products-by-ids-read',
        method,
        `${pathname}${search}`,
        'GET',
        `/shopify-products${pageflySearch}`
      )
    }

    if (action === TAILORKIT_SHOPIFY_ACTIONS.getProductImages) {
      const pageflySearch = productId ? `?productId=${encodeURIComponent(productId)}` : ''
      return mapped(
        'shopify-product-images-read',
        method,
        `${pathname}${search}`,
        'GET',
        `/shopify-product-images${pageflySearch}`
      )
    }

    if (action === TAILORKIT_SHOPIFY_ACTIONS.deleteProduct) {
      return blocked('provider-imported-product-rollback-delete', method, `${pathname}${search}`)
    }

    if (action === TAILORKIT_SHOPIFY_ACTIONS.checkUserHasProduct) {
      return mapped('shopify-has-product-read', method, `${pathname}${search}`, 'GET', '/shopify-has-product')
    }

    if (action === TAILORKIT_SHOPIFY_ACTIONS.getAppHandle) {
      return mapped('shopify-app-handle-read', method, `${pathname}${search}`, 'GET', '/shopify-app-handle')
    }

    return unsupported(
      method,
      `${pathname}${search}`,
      `Unsupported TailorKit /api/shopify action: ${action || '<missing>'}`
    )
  }

  if (pathname.startsWith('/api/integrations/') && method === 'GET') {
    const id = pathname.split('/').filter(Boolean)[2] || ''
    return mapped(
      'integration-detail-read',
      method,
      pathname,
      'GET',
      `/personalized-products/${encodeURIComponent(decodeURIComponent(id))}${search}`
    )
  }

  if (pathname === '/api/variants-integrations' && method === 'GET') {
    return mapped('variant-integrations-read', method, pathname, 'GET', '/variant-integrations')
  }

  if (pathname === '/api/overlay-lookup' && method === 'GET') {
    return mapped('overlay-lookup-read', method, `${pathname}${search}`, 'GET', `/overlay-lookup${search}`)
  }

  if (pathname === '/api/overlay-lookup' && method === 'POST') {
    return mapped(
      'overlay-lookup-transparent-regions-write',
      method,
      pathname,
      'POST',
      '/overlay-lookup'
    )
  }

  if (pathname === '/api/templates' && method === 'GET') {
    return mapped('template-list-read', method, `${pathname}${search}`, 'GET', `/templates${search}`)
  }

  if (pathname.startsWith('/api/templates/') && method === 'GET') {
    const id = pathname.split('/').filter(Boolean)[2] || ''
    return mapped(
      'template-detail-read',
      method,
      `${pathname}${search}`,
      'GET',
      `/templates/${encodeURIComponent(decodeURIComponent(id))}${search}`
    )
  }

  if (pathname.startsWith('/api/templates/') && method === 'POST') {
    const id = pathname.split('/').filter(Boolean)[2] || ''

    if (input.action === TAILORKIT_TEMPLATE_ACTIONS.saveTemplate && id) {
      return mapped(
        'template-save-action',
        method,
        pathname,
        'POST',
        `/templates/${encodeURIComponent(decodeURIComponent(id))}/save`
      )
    }

    return unsupported(
      method,
      pathname,
      `Unsupported TailorKit /api/templates/:id action: ${input.action || '<missing>'}`
    )
  }

  if (pathname === '/api/option-sets' && method === 'GET') {
    return mapped('option-sets-list-read', method, `${pathname}${search}`, 'GET', `/option-sets${search}`)
  }

  if (pathname === '/api/option-sets' && method === 'POST') {
    const action = input.action || url.searchParams.get('action') || ''

    if (action === TAILORKIT_OPTION_SET_ACTIONS.findLayerBeingUsed) {
      return mapped(
        'option-set-layer-usage-read',
        method,
        `${pathname}${search}`,
        'POST',
        '/option-set-layer-usage'
      )
    }

    return unsupported(
      method,
      `${pathname}${search}`,
      `Unsupported TailorKit /api/option-sets action: ${action || '<missing>'}`
    )
  }

  if (pathname === '/api/prompt-presets' && method === 'GET') {
    return mapped('prompt-presets-list-read', method, pathname, 'GET', '/prompt-presets')
  }

  if (pathname === '/api/tutorials' && method === 'GET') {
    return mapped('tutorials-list-read', method, pathname, 'GET', '/tutorials')
  }

  if (pathname === '/api/files' && method === 'POST') {
    const action = url.searchParams.get('action') || ''

    if (action === TAILORKIT_FILE_ACTIONS.fetchMediaLists) {
      return mapped('shopify-media-files-query', method, `${pathname}${search}`, 'POST', '/files/query-media')
    }

    if (action === TAILORKIT_FILE_ACTIONS.queryFontFiles) {
      return mapped('custom-font-files-query', method, `${pathname}${search}`, 'POST', '/files/query-fonts')
    }

    if (action === TAILORKIT_FILE_ACTIONS.queryMaskFiles) {
      return mapped('custom-mask-files-query', method, `${pathname}${search}`, 'POST', '/files/query-masks')
    }

    return unsupported(
      method,
      `${pathname}${search}`,
      `Unsupported TailorKit /api/files action: ${action || '<missing>'}`
    )
  }

  if (pathname === '/api/templates' && method === 'POST') {
    const action = url.searchParams.get('action') || ''

    if (action === TAILORKIT_TEMPLATE_ACTIONS.uploadFiles) {
      return mapped('template-upload-files', method, `${pathname}${search}`, 'POST', '/files/upload')
    }

    if (action === TAILORKIT_TEMPLATE_ACTIONS.checkTemplateUsage) {
      return mapped('template-usage-check', method, `${pathname}${search}`, 'POST', '/template-usage')
    }

    if (action === TAILORKIT_TEMPLATE_ACTIONS.getClipartsDetails) {
      return blocked('template-get-cliparts-details', method, `${pathname}${search}`)
    }

    if (action === TAILORKIT_TEMPLATE_ACTIONS.getTemplatesByIds) {
      return mapped('template-get-by-ids', method, `${pathname}${search}`, 'POST', '/templates-by-ids')
    }

    if (action === TAILORKIT_TEMPLATE_ACTIONS.cloneClipartToTemplate) {
      return blocked('template-clone-clipart-to-template', method, `${pathname}${search}`)
    }

    return unsupported(
      method,
      `${pathname}${search}`,
      `Unsupported TailorKit /api/templates action: ${action || '<missing>'}`
    )
  }

  if (pathname === '/api/integrations' && method === 'POST') {
    const action = url.searchParams.get('action') || ''

    if (action === TAILORKIT_INTEGRATIONS_BULK_ACTIONS.fetchProductVariantsByVariantIds) {
      return mapped(
        'integration-product-variants-by-ids-read',
        method,
        `${pathname}${search}`,
        'POST',
        '/integration-product-variants'
      )
    }

    if (action === TAILORKIT_INTEGRATIONS_BULK_ACTIONS.fetchAllProductVariants) {
      return mapped(
        'integration-all-product-variants-read',
        method,
        `${pathname}${search}`,
        'POST',
        '/integration-all-product-variants'
      )
    }

    if (action === TAILORKIT_INTEGRATIONS_BULK_ACTIONS.fetchProductByProductId) {
      return mapped('integration-products-by-ids-read', method, `${pathname}${search}`, 'POST', '/integration-products')
    }

    if (action === TAILORKIT_INTEGRATIONS_BULK_ACTIONS.checkSharedTemplatesWithPublished) {
      return mapped(
        'integration-shared-templates-read',
        method,
        `${pathname}${search}`,
        'POST',
        '/shared-template-integrations'
      )
    }

    if (action === TAILORKIT_INTEGRATIONS_BULK_ACTIONS.fetchIntegrationsByVariantIds) {
      return mapped(
        'published-integrations-by-variant-ids-read',
        method,
        `${pathname}${search}`,
        'POST',
        '/published-integrations-by-variant-ids'
      )
    }

    if (action === TAILORKIT_INTEGRATIONS_BULK_ACTIONS.fetchIntegrationsByTemplate) {
      return mapped(
        'published-integrations-by-template-read',
        method,
        `${pathname}${search}`,
        'POST',
        '/published-integrations-by-template'
      )
    }

    if (
      action === TAILORKIT_INTEGRATIONS_BULK_ACTIONS.publishPersonalizedProducts ||
      action === TAILORKIT_INTEGRATIONS_BULK_ACTIONS.unpublishPersonalizedProducts
    ) {
      return mapped(
        'integrations-bulk-publish-actions',
        method,
        `${pathname}${search}`,
        'POST',
        `/integrations-bulk${search}`
      )
    }

    if (action === TAILORKIT_INTEGRATIONS_BULK_ACTIONS.deletePersonalizedProducts) {
      return mapped(
        'integrations-bulk-delete-action',
        method,
        `${pathname}${search}`,
        'POST',
        `/integrations-bulk${search}`
      )
    }

    if (action === TAILORKIT_INTEGRATIONS_BULK_ACTIONS.fetchProductVariantMetafields) {
      return blocked('variant-metafields-read', method, `${pathname}${search}`)
    }

    return unsupported(
      method,
      `${pathname}${search}`,
      `Unsupported TailorKit /api/integrations action: ${action || '<missing>'}`
    )
  }

  if (pathname === '/api/integration' && method === 'POST') {
    const action = input.action || url.searchParams.get('action') || ''
    const integrationId = input.integrationId || url.searchParams.get('integrationId') || ''

    if (action === TAILORKIT_INTEGRATION_ACTIONS.publishProduct && integrationId) {
      return mapped(
        'integration-publish-action',
        method,
        pathname,
        'POST',
        `/personalized-products/${encodeURIComponent(integrationId)}/publish`
      )
    }

    if (action === TAILORKIT_INTEGRATION_ACTIONS.unpublishProduct && integrationId) {
      return mapped(
        'integration-unpublish-action',
        method,
        pathname,
        'POST',
        `/personalized-products/${encodeURIComponent(integrationId)}/unpublish`
      )
    }

    if (action === TAILORKIT_INTEGRATION_ACTIONS.saveProduct) {
      if (integrationId) {
        return mapped(
          'integration-save-action',
          method,
          pathname,
          'PUT',
          `/personalized-products/${encodeURIComponent(integrationId)}`
        )
      }

      return {
        status: 'requires-payload-adapter',
        sourceDecisionId: 'integration-save-action',
        sourceDecisionStatus: decision('integration-save-action').status,
        sourceMethod: method,
        sourcePath: pathname,
        pageflyMethod: null,
        pageflyPath: null,
        reason:
          'TailorKit save-product action needs the compressed integration payload adapter to extract integration id.',
      }
    }

    return unsupported(method, pathname, `Unsupported TailorKit /api/integration action: ${action || '<missing>'}`)
  }

  return unsupported(method, pathname, `Unsupported TailorKit authenticatedFetch endpoint: ${pathname}`)
}
