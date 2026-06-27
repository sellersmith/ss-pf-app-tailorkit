/**
 * Runtime data fetching for charm products.
 * Fetches FULL product data (title, price, thumbnail, availability) from
 * the Storefront API directly, using only the stable IDs stored in the metafield.
 *
 * Prefers direct Storefront GraphQL call (1 hop) over app proxy (2 hops).
 * Falls back to proxy if storefront token isn't available.
 *
 * This is the charm equivalent of getCachedHiddenPricingProduct() —
 * always use runtime-fetched data for display and cart operations.
 */
import { APP_PROXY_PATH } from '../../../assets/constants'
import { STORE_FRONT_ACTION } from '../../../assets/constants/app-actions'
import { fetchWithAdminContext } from '../../../assets/libraries/fetchWithAdminContext'
import type {
  StorefrontCharmProduct,
  CharmProductFullData,
  CharmFetchResult,
  CharmFetchDiagnostic,
} from './charm-picker-types'

/** Console prefix for support to grep in browser DevTools */
const LOG_PREFIX = '[TailorKit Charm Picker]'

const STOREFRONT_API_VERSION = '2025-10'

// `preferredContentType: PNG` asks the Shopify CDN to transcode any non-web
// image format (notably HEIC/HEIF from iPhone uploads) to PNG. Browsers and
// Konva cannot render HEIC, so without this hint the canvas stays empty and
// the modal thumbnail is blank/broken even though the picker fetch succeeds.
// PNG is preferred over JPG because charm assets typically have transparent
// backgrounds that JPG would flatten to white/black.
const PRODUCTS_BY_IDS_QUERY = `
  query getProductsByIds($ids: [ID!]!, $country: CountryCode!) @inContext(country: $country) {
    nodes(ids: $ids) {
      ... on Product {
        id
        title
        featuredImage { url(transform: { preferredContentType: PNG }) altText width }
        availableForSale
        variants(first: 250) {
          nodes {
            id
            title
            availableForSale
            quantityAvailable
            price { amount currencyCode }
            compareAtPrice { amount currencyCode }
            image { url(transform: { preferredContentType: PNG }) }
          }
        }
      }
    }
  }
`

/** Extract numeric ID from Shopify GID or return as-is if already numeric */
const extractNumericId = (id: string): string => (id.includes('/') ? id.split('/').pop() || id : id)

/** Ensure ID has the GID prefix */
const toProductGid = (id: string): string =>
  id.startsWith('gid://') ? id : `gid://shopify/Product/${extractNumericId(id)}`

/** Cached storefront token — parsed once from DOM */
let cachedStorefrontToken: string | undefined

/**
 * Get storefront access token from TailorKit's own config element.
 * Reads from <script id="tailorkit-storefront-config"> output by customizer.liquid.
 * No dependency on OneTick.
 */
function getStorefrontToken(): string | undefined {
  if (cachedStorefrontToken) return cachedStorefrontToken

  try {
    const configEl = document.getElementById('tailorkit-storefront-config')
    if (configEl) {
      const config = JSON.parse(configEl.textContent || '{}')
      cachedStorefrontToken = config.storefrontAccessToken || undefined
      return cachedStorefrontToken
    }
  } catch {
    /* config parse error — skip */
  }

  return undefined
}

/** Result of a single fetch attempt — products array on success, or diagnostic on failure. */
type AttemptResult = { ok: true; products: any[] } | { ok: false; diagnostic: CharmFetchDiagnostic }

/**
 * Try fetching products directly from Storefront GraphQL API.
 * Returns ok=false with diagnostic if token is unavailable or the request fails.
 */
async function fetchDirectStorefront(productIds: string[]): Promise<AttemptResult> {
  const storefrontToken = getStorefrontToken()
  if (!storefrontToken) {
    return {
      ok: false,
      diagnostic: {
        reason: 'storefront-token-missing',
        message:
          'Storefront access token not found. The TailorKit app embed may not be enabled '
          + 'in your theme, or the storefront token metafield is missing.',
        context: { tokenSource: 'tailorkit-storefront-config script element' },
      },
    }
  }

  const rootPath = (window as any).Shopify?.routes?.root || '/'
  const country = (window as any).Shopify?.country || 'US'
  const gids = productIds.map(toProductGid)

  const response = await fetch(`${rootPath}api/${STOREFRONT_API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': storefrontToken,
    },
    body: JSON.stringify({
      query: PRODUCTS_BY_IDS_QUERY,
      variables: { ids: gids, country },
    }),
  })

  if (!response.ok) {
    return {
      ok: false,
      diagnostic: {
        reason: 'storefront-api-http-error',
        message: `Storefront API returned HTTP ${response.status}. The token may be invalid or the API permissions insufficient.`,
        context: { status: response.status, statusText: response.statusText },
      },
    }
  }

  const json = await response.json()
  const nodes = json?.data?.nodes || []
  const errors = json?.errors

  // Transform to match proxy response shape (stripped numeric IDs).
  // Storefront API returns null entries for products that aren't published to the
  // Online Store sales channel — this is the most common cause of "Failed to load charms".
  const products = nodes
    .filter((node: any) => node?.id)
    .map((node: any) => ({
      ...node,
      id: extractNumericId(node.id),
      variants: (node.variants?.nodes || []).map((v: any) => ({
        ...v,
        id: extractNumericId(v.id),
      })),
    }))

  if (errors?.length) {
    // Extract message strings inline so support sees the cause without expanding the array
    const messages = errors.map((e: any) => e?.message || 'unknown error').join(' | ')
    console.warn(`${LOG_PREFIX} Storefront API returned GraphQL errors: ${messages}`, errors)
  }

  return { ok: true, products }
}

/**
 * Fallback: fetch via app proxy (legacy path, 2 network hops).
 */
async function fetchViaProxy(productIds: string[]): Promise<AttemptResult> {
  const formData = new FormData()
  formData.append('action', STORE_FRONT_ACTION.GET_PRODUCTS_FROM_IDS)
  const country = (window as any).Shopify?.country || 'US'
  // Request PNG-transcoded image URLs from Shopify CDN — charm products
  // uploaded as HEIC (iPhone) cannot be rendered by browsers or Konva.
  // Mirrors the same transform used by the direct Storefront API path.
  formData.append('body', JSON.stringify({ ids: productIds, country, options: { preferredContentType: 'PNG' } }))

  const response = await fetchWithAdminContext(
    `${APP_PROXY_PATH}/app_proxy/storefront?action=${STORE_FRONT_ACTION.GET_PRODUCTS_FROM_IDS}`,
    { method: 'POST', body: formData }
  )

  if (!response.ok) {
    return {
      ok: false,
      diagnostic: {
        reason: 'proxy-http-error',
        message: `App proxy returned HTTP ${response.status}. The app may be uninstalled, the proxy route disabled, or the request blocked.`,
        context: { status: response.status, statusText: response.statusText },
      },
    }
  }

  const json = await response.json()
  return { ok: true, products: json?.data || [] }
}

/**
 * Fetch full product data for charm products from the Storefront API.
 *
 * Input: minimal product refs from metafield (just IDs).
 * Output: products Map (_id → full data) plus a diagnostic describing the failure
 * cause when the result is empty or partial. The diagnostic is logged to the
 * browser console with the `[TailorKit Charm Picker]` prefix so support can
 * triage from a screenshot of DevTools.
 */
export async function fetchCharmProducts(products: StorefrontCharmProduct[]): Promise<CharmFetchResult> {
  const productMap = new Map<string, CharmProductFullData>()

  if (!products.length) {
    return {
      products: productMap,
      diagnostic: {
        reason: 'no-products-configured',
        message: 'No charm products are configured for this builder.',
      },
    }
  }

  const productIds = products.map(p => p.productId)
  let diagnostic: CharmFetchDiagnostic | null = null

  try {
    // Try direct Storefront API first (faster, 1 hop). Fall back to proxy if
    // token is unavailable or the direct call returned a network error.
    const direct = await fetchDirectStorefront(productIds)
    let fetched: any[] = []

    if (direct.ok) {
      fetched = direct.products
    } else {
      const proxy = await fetchViaProxy(productIds)
      if (proxy.ok) {
        fetched = proxy.products
        // Direct failed but proxy worked — log the original cause for debugging
        console.warn(`${LOG_PREFIX} Direct Storefront API failed, used proxy fallback:`, direct.diagnostic)
      } else {
        // Both paths failed. Surface the proxy message (last attempt, most
        // actionable for the merchant) but keep both reasons in context so
        // support can see the full failure chain in DevTools.
        diagnostic = {
          reason: 'all-fetches-failed',
          message: proxy.diagnostic.message,
          context: {
            directFailure: direct.diagnostic.reason,
            directContext: direct.diagnostic.context,
            proxyFailure: proxy.diagnostic.reason,
            proxyContext: proxy.diagnostic.context,
          },
        }
        console.error(`${LOG_PREFIX} Both Storefront API and proxy failed:`, {
          direct: direct.diagnostic,
          proxy: proxy.diagnostic,
        })
        return { products: productMap, diagnostic }
      }
    }

    for (const node of fetched) {
      // Match metafield ref by numeric product ID
      const ref = products.find(p => extractNumericId(p.productId) === String(node.id))
      if (!ref) continue

      // Find the specific variant, fallback to first available, then first
      const numericVariantId = extractNumericId(ref.variantId || '')
      const variant
        = node.variants?.find((v: { id: string }) => String(v.id) === numericVariantId)
        || node.variants?.find((v: { availableForSale: boolean }) => v.availableForSale)
        || node.variants?.[0]

      productMap.set(ref._id, {
        _id: ref._id,
        productId: ref.productId,
        variantId: ref.variantId,
        title: node.title || 'Charm',
        price: variant?.price?.amount || '0',
        currencyCode: variant?.price?.currencyCode || 'USD',
        thumbnailUrl: variant?.image?.url || node.featuredImage?.url || '',
        availableForSale: variant?.availableForSale ?? node.availableForSale ?? true,
        compareAtPrice: variant?.compareAtPrice?.amount,
        // Authoritative numeric variant ID from Storefront API
        liveVariantId: variant?.id ? String(variant.id) : undefined,
        quantityAvailable: variant?.quantityAvailable ?? null,
      })
    }

    if (productMap.size === 0) {
      diagnostic = {
        reason: 'empty-response',
        message:
          'No charm products were returned. Make sure the products are Active and published '
          + 'to the Online Store sales channel — products marked Unlisted or Draft are not '
          + 'exposed to the Storefront API.',
        context: { requested: products.length, returned: 0 },
      }
      console.error(`${LOG_PREFIX} ${diagnostic.message}`, diagnostic.context)
    } else if (productMap.size < products.length) {
      diagnostic = {
        reason: 'partial-match',
        message:
          `Only ${productMap.size} of ${products.length} charm products loaded. `
          + 'The missing ones may be Unlisted, Draft, or unpublished from the Online Store.',
        context: { requested: products.length, returned: productMap.size },
      }
      console.warn(`${LOG_PREFIX} ${diagnostic.message}`, diagnostic.context)
    }
  } catch (err) {
    diagnostic = {
      reason: 'network-error',
      message: 'A network error occurred while loading charms. Please check your connection and try again.',
      context: { error: err instanceof Error ? err.message : String(err) },
    }
    console.error(`${LOG_PREFIX} Network error during fetch:`, err)
  }

  return { products: productMap, diagnostic }
}
