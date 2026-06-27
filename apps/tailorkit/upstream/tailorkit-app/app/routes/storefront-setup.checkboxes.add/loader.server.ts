import type { LoaderFunctionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { authenticate } from '~/shopify/app.server'
import { json } from '~/bootstrap/fns/fetch.server'
import { getGlobalStyling } from '~/models/GlobalStyling.server'
import { getShopData } from '~/models/Shop.server'
import { getUpsellProductLimit, isCheckboxLimitReached } from '~/services/checkbox.server'
import { defaultCheckboxStyling } from '~/types/global-styling'
import { NavMenuItems } from '~/bootstrap/app-config'

/**
 * Loader for add checkbox page
 * Fetches collections, tags, vendors, and product types for trigger selection
 * Also fetches global checkbox styling for preview
 * Redirects to list page if upsell product limit is reached
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Authenticate to ensure user is logged in
  const {
    admin,
    session: { shop: shopDomain },
  } = await authenticate.admin(request)

  // Check upsell product limit — redirect if at limit
  const shopData = await getShopData(shopDomain)
  const upsellProductLimit = getUpsellProductLimit(shopData)
  const limitReached = await isCheckboxLimitReached(shopDomain, upsellProductLimit)
  if (limitReached) {
    return redirect(NavMenuItems.STOREFRONT_SETUP_CHECKBOXES)
  }

  // Fetch collections from Shopify
  let collections: Array<{ id: string; title: string; image?: { url: string; altText?: string | null } }> = []
  let tags: string[] = []
  let vendors: string[] = []
  let productTypes: string[] = []

  try {
    // Fetch collections with image
    const collectionsResponse = await admin.graphql(`
      query {
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
      }
    `)
    const collectionsData = await collectionsResponse.json()
    collections
      = collectionsData.data?.collections?.edges?.map((edge: any) => ({
        id: edge.node.id,
        title: edge.node.title,
        image: edge.node.image ? { url: edge.node.image.url, altText: edge.node.image.altText } : undefined,
      })) || []

    // Fetch product tags, vendors, and types via products query
    const productsResponse = await admin.graphql(`
      query {
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
    const productsData = await productsResponse.json()
    const products = productsData.data?.products?.edges || []

    // Extract unique tags, vendors, and product types
    const tagsSet = new Set<string>()
    const vendorsSet = new Set<string>()
    const productTypesSet = new Set<string>()

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

    tags = Array.from(tagsSet).sort()
    vendors = Array.from(vendorsSet).sort()
    productTypes = Array.from(productTypesSet).sort()
  } catch (error) {
    console.error('Error fetching product data for checkbox form:', error)
    // Continue with empty arrays if fetch fails
  }

  // Fetch global checkbox styling for preview
  const globalStyling = await getGlobalStyling(shopDomain)
  const checkboxStyling = globalStyling?.styling?.checkbox || defaultCheckboxStyling

  return json({
    collections,
    tags,
    vendors,
    productTypes,
    checkboxStyling,
    upsellProductLimit,
  })
}
