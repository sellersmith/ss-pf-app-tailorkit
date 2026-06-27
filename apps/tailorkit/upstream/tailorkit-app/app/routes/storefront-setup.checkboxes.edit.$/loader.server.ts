import type { LoaderFunctionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { authenticate } from '~/shopify/app.server'
import { json } from '~/bootstrap/fns/fetch.server'
import { getCheckboxByIdWithFullData } from '~/services/checkbox.server'
import { getGlobalStyling } from '~/models/GlobalStyling.server'
import { defaultCheckboxStyling } from '~/types/global-styling'
import { getPublishedVariantGids } from '~/routes/api.app_proxy.storefront/actions/cross-product-personalizer.server'

/**
 * Loader for edit checkbox page
 * Fetches the checkbox by ID with full product/variant data and options for trigger selection
 * Also fetches global checkbox styling for preview
 *
 * Optimized: Theme config (appConfig) is loaded lazily on the client side
 * to improve initial page load time. See route.tsx for the deferred loading.
 */
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const adminContext = await authenticate.admin(request)
  const {
    session: { shop: shopDomain },
    admin,
  } = adminContext

  // Get checkbox ID from splat route params
  const checkboxId = params['*']

  if (!checkboxId) {
    return redirect('/storefront-setup/checkboxes')
  }

  // Run all independent fetches in parallel for faster load times
  // Note: getThemeShopConfig is loaded lazily on client side via useFetcher
  const [checkbox, shopifyData, globalStyling] = await Promise.all([
    getCheckboxByIdWithFullData(shopDomain, checkboxId, admin.graphql),
    fetchShopifyProductData(admin.graphql),
    getGlobalStyling(shopDomain),
  ])

  if (!checkbox) {
    return redirect('/storefront-setup/checkboxes')
  }

  const checkboxStyling = globalStyling?.styling?.checkbox || defaultCheckboxStyling

  // Check if the upsell product variant has a TailorKit integration
  const upsellVariantGid = checkbox.upsellProducts?.[0]?.variantId || ''
  const publishedVariantGids = upsellVariantGid
    ? await getPublishedVariantGids(shopDomain, [upsellVariantGid])
    : new Set<string>()
  const isUpsellProductIntegrated = publishedVariantGids.has(upsellVariantGid)

  return json({
    checkbox,
    collections: shopifyData.collections,
    tags: shopifyData.tags,
    vendors: shopifyData.vendors,
    productTypes: shopifyData.productTypes,
    checkboxStyling,
    isUpsellProductIntegrated,
  })
}

/**
 * Fetches collections and product metadata (tags, vendors, types) from Shopify
 * Uses a single combined GraphQL query for efficiency
 */
async function fetchShopifyProductData(adminGraphql: any) {
  const defaultResult = {
    collections: [] as Array<{ id: string; title: string; image?: { url: string; altText?: string | null } }>,
    tags: [] as string[],
    vendors: [] as string[],
    productTypes: [] as string[],
  }

  try {
    // Combined query to fetch collections and products in a single request
    const response = await adminGraphql(`
      query GetShopifyProductData {
        collections(first: 100) {
          edges {
            node {
              id
              title
              image {
                url
                altText
              }
            }
          }
        }
        products(first: 250) {
          edges {
            node {
              tags
              vendor
              productType
            }
          }
        }
      }
    `)
    const data = await response.json()

    // Parse collections
    const collections
      = data.data?.collections?.edges?.map((edge: any) => ({
        id: edge.node.id,
        title: edge.node.title,
        image: edge.node.image ? { url: edge.node.image.url, altText: edge.node.image.altText } : undefined,
      })) || []

    // Extract unique tags, vendors, and product types
    const tagsSet = new Set<string>()
    const vendorsSet = new Set<string>()
    const productTypesSet = new Set<string>()

    const products = data.data?.products?.edges || []
    products.forEach((edge: any) => {
      const product = edge.node
      if (product.tags) {
        product.tags.forEach((tag: string) => tagsSet.add(tag))
      }
      if (product.vendor) {
        vendorsSet.add(product.vendor)
      }
      if (product.productType) {
        productTypesSet.add(product.productType)
      }
    })

    return {
      collections,
      tags: Array.from(tagsSet).sort(),
      vendors: Array.from(vendorsSet).sort(),
      productTypes: Array.from(productTypesSet).sort(),
    }
  } catch (error) {
    console.error('Error fetching product data for checkbox form:', error)
    return defaultResult
  }
}
