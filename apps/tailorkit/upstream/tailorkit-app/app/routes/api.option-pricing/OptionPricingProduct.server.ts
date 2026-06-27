import type { AdminApiContext } from '@shopify/shopify-app-remix/server'
import { ELink } from '~/constants/enum'
import { ShopifyApiClient } from '~/shopify/graphql/api.server'
import { publishProductToAllPublications } from './publish-to-all-publications.server'
import {
  OPTION_PRICING_PRODUCT_PRICE,
  OPTION_PRICING_PRODUCT_TITLE,
  OPTION_PRICING_PRODUCT_TYPE,
} from 'extensions/tailorkit-src/src/assets/constants/option-pricing'
import {
  isZeroDecimalCurrency,
  ZERO_DECIMAL_PRICE_MAP,
} from 'extensions/tailorkit-src/src/assets/utils/storefront-pricing'
import { getOptionPricingProductHandle } from './fns'

/**
 * Calculate appropriate unit price for the hidden personalization product
 * based on merchant-provided average option price and currency rules.
 *
 * - Target ratio: averagePrice / 1000 → keeps cart quantity manageable.
 * - Respect zero-decimal currencies.
 * - Enforce a minimum of 0.01 for decimal currencies and ZERO_DECIMAL_PRICE_MAP fallback for others.
 */
function getUnitPrice(averagePrice: number | undefined, currencyCode: string | undefined): number {
  if (!currencyCode) {
    // Fallback to default constant behaviour if we cannot detect currency.
    return OPTION_PRICING_PRODUCT_PRICE
  }

  if (typeof averagePrice === 'number' && !isNaN(averagePrice) && averagePrice > 0) {
    if (isZeroDecimalCurrency(currencyCode)) {
      const fallback = ZERO_DECIMAL_PRICE_MAP[currencyCode] ?? 1

      // Keep quantity ≤ 99 999 for very large average prices
      const MAX_QTY = 99999
      const minUnitRequired = Math.ceil(averagePrice / MAX_QTY)

      if (minUnitRequired <= fallback) {
        return fallback
      }

      // Round up to the next power-of-ten so that the unit price is a clean integer
      const exponent = Math.ceil(Math.log10(minUnitRequired))
      const unit = Math.pow(10, exponent)

      return unit
    }

    // Derive unit as power-of-ten scaled so avg price ≈ 1000 × unit.
    const exponent = Math.floor(Math.log10(averagePrice)) - 2 // keep quantity ≤ 10⁵
    let unit = Math.pow(10, exponent)
    if (unit < 0.01) unit = 0.01
    // Clamp to 2 decimals max
    return parseFloat(unit.toFixed(2))
  }

  // No average price provided – preserve existing logic
  if (isZeroDecimalCurrency(currencyCode)) {
    return ZERO_DECIMAL_PRICE_MAP[currencyCode] ?? 1
  }

  return OPTION_PRICING_PRODUCT_PRICE
}

const OPTION_PRICING_PRODUCT_HANDLE = getOptionPricingProductHandle(process.env.APP_HANDLE!)

/**
 * Create the hidden option pricing product
 */
export async function createOptionPricingProduct(
  admin: AdminApiContext,
  averagePrice?: number
): Promise<string | null> {
  try {
    const api = new ShopifyApiClient(admin)

    const descriptionHtml = [
      '<p>This product is used internally and should not be visible on Google.</p><br>',
      '<p><strong>🛑 For Buyers:</strong><br>This product is not for sale. Please do not purchase.</p>',
      '<p><strong>🔒 For Merchants:</strong><br>This is a hidden product used by<strong> TailorKit Product Personalizer</strong>.<br>',
      'You may modify everything <strong>except</strong>:</p>',
      '<ul>',
      // eslint-disable-next-line max-len
      '<li><strong>Price</strong> (⚠️ Only change this if the new price divides evenly into your option cost. Otherwise rounding errors will occur.)</li>',
      '<li><strong>Product availability</strong></li>',
      '<li><strong>Product handle</strong></li>',
      '</ul>',
      // '<p>More details here: <a href="https://docs.tailorkit.com/option-pricing" target="_blank">Option Pricing Guide</a></p>',
    ].join('')

    // First, create the product using existing API method
    const productData = {
      title: OPTION_PRICING_PRODUCT_TITLE,
      descriptionHtml: descriptionHtml,
      vendor: 'TailorKit',
      status: 'UNLISTED' as const,
      productOptions: [], // Empty options for a simple product
    }

    // Prepare product media
    const productMedia = [
      {
        mediaContentType: 'IMAGE' as const,
        originalSource: ELink.ITEM_PERSONALIZATION_THUMBNAIL,
      },
    ]

    const productResult = await api.createProduct(productData, productMedia)

    if (productResult.productCreate.userErrors?.length > 0) {
      console.error('Error creating option pricing product:', productResult.productCreate.userErrors)
      return null
    }

    const productId = productResult.productCreate.product?.id

    if (!productId) {
      console.error('No product ID returned from product creation')
      return null
    }

    // Determine appropriate base price for the hidden product depending on the shop currency.
    // Some currencies (e.g. VND, JPY) are so-called "zero-decimal" currencies and don't support
    // fractional prices such as 0.1. Attempting to set such a price will result in a validation
    // error from Shopify. For those currencies we fall back to a higher, integer price that is
    // still small enough to keep quantity multiplication reasonable.

    // Fetch the shop currency. The Admin API guarantees that this field is always present.
    let currencyCode: string | undefined
    try {
      const shopResp = await admin.graphql(
        `
        query shopCurrencyQuery {
          shop {
            currencyCode
          }
        }
      `
      )

      const shopData = await shopResp.json()
      const shopDomain = shopData?.data?.shop
      currencyCode = shopDomain?.currencyCode as string | undefined

      if (!currencyCode) {
        console.warn('No currency found for shopDomain', shopDomain)
      }
    } catch (err) {
      console.warn('⚠️  Failed to fetch shop currency, falling back to default price', err)
    }

    if (!currencyCode) {
      return null
    }

    // Determine price using helper – respects avg & currency rules
    const priceValue = getUnitPrice(averagePrice, currencyCode)

    const variantData = [
      {
        optionValues: [], // Empty option values for a simple product with no options
        price: priceValue, // Use number type as required
        inventoryItem: {
          cost: 0, // Required field, set to 0 for hidden product
          tracked: false, // Disable inventory tracking
        },
      },
    ]

    const variantResult = await api.createBulkProductVariants(productId, variantData)

    if (variantResult.productVariantsBulkCreate.userErrors?.length > 0) {
      console.error('Error creating product variant:', variantResult.productVariantsBulkCreate.userErrors)
      return null
    }

    // Update product with handle and product type (not supported in initial creation)
    try {
      await admin.graphql(
        `
        mutation productUpdate($input: ProductInput!) {
          productUpdate(input: $input) {
            product {
              id
              handle
              productType
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
        {
          variables: {
            input: {
              id: productId,
              handle: OPTION_PRICING_PRODUCT_HANDLE,
              productType: OPTION_PRICING_PRODUCT_TYPE,
              tags: ['tailorkit', 'internal', 'hidden', 'option-pricing'],
            },
          },
        }
      )
    } catch (error) {
      console.warn('⚠️ Failed to update product handle/type:', error)
    }

    // Publish the product to Online Store using existing API methods
    await publishProductToAllPublications(api, productId)

    return productId
  } catch (error) {
    console.error('Failed to create option pricing product:', error)
    return null
  }
}

/**
 * Get existing option pricing product
 */
export async function getOptionPricingProduct(admin: AdminApiContext): Promise<any> {
  try {
    const response = await admin.graphql(
      `
      query getProduct($query: String!) {
        products(first: 1, query: $query) {
          edges {
            node {
              id
              title
              handle
              status
              variants(first: 1) {
                edges {
                  node {
                    id
                    price
                  }
                }
              }
            }
          }
        }
      }
    `,
      {
        variables: {
          query: `handle:${OPTION_PRICING_PRODUCT_HANDLE}`,
        },
      }
    )

    const result = await response.json()
    return result.data?.products?.edges?.[0]?.node ?? null
  } catch (error) {
    console.error('Failed to get option pricing product:', error)
    return null
  }
}

/**
 * Update existing option pricing product to disable inventory tracking
 */
export async function updateOptionPricingProductInventory(
  admin: AdminApiContext,
  productId: string,
  averagePrice?: number
): Promise<boolean> {
  try {
    // First get the variant ID and current price
    const response = await admin.graphql(
      `
      query getProductVariants($id: ID!) {
        product(id: $id) {
          variants(first: 1) {
            edges {
              node {
                id
                price
                inventoryItem {
                  id
                  tracked
                }
              }
            }
          }
        }
      }
    `,
      {
        variables: { id: productId },
      }
    )

    const result = await response.json()
    const variant = result.data?.product?.variants?.edges?.[0]?.node

    if (!variant) {
      console.error('No variant found for product')
      return false
    }

    const inventoryItemId = variant.inventoryItem.id

    // ---------------------------
    // 1) Ensure inventory tracking disabled
    // ---------------------------

    if (variant.inventoryItem.tracked) {
      await admin.graphql(
        `
        mutation inventoryItemUpdate($id: ID!, $input: InventoryItemInput!) {
          inventoryItemUpdate(id: $id, input: $input) {
            inventoryItem { id tracked }
            userErrors { field message }
          }
        }
      `,
        {
          variables: {
            id: inventoryItemId,
            input: { tracked: false },
          },
        }
      )
      console.log('✅ Inventory tracking disabled for option pricing product')
    }

    // ---------------------------
    // 2) Ensure variant price matches new mapping
    // ---------------------------

    // Only recalculate/override price when caller explicitly provides averagePrice.
    // Without this guard, every call from the admin (e.g. enabling app embed, reopening
    // the Edit-price modal with the default value) would clobber a price the merchant
    // edited directly in Shopify Admin on the UNLISTED "Personalization Price" product.
    const hasExplicitAveragePrice = typeof averagePrice === 'number' && !isNaN(averagePrice) && averagePrice > 0

    if (!hasExplicitAveragePrice) {
      return true
    }

    let currencyCode: string | undefined
    try {
      const shopResp = await admin.graphql(
        `
        query shopCurrencyQuery { shop { currencyCode } }
      `
      )
      const shopData = await shopResp.json()
      currencyCode = shopData?.data?.shop?.currencyCode as string | undefined
    } catch (err) {
      console.warn('Failed to fetch shop currency when updating variant price', err)
    }

    // Determine desired price
    const desiredPrice = getUnitPrice(averagePrice, currencyCode)

    const currentPrice = parseFloat(variant.price)

    if (!isNaN(currentPrice) && currentPrice !== desiredPrice) {
      // Update variant price using the new bulk update mutation introduced in API 2024-04+
      await admin.graphql(
        `
        mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkUpdate(productId: $productId, variants: $variants) {
            productVariants {
              id
              price
            }
            userErrors { field message }
          }
        }
      `,
        {
          variables: {
            productId: productId,
            variants: [
              {
                id: variant.id,
                price: desiredPrice,
              },
            ],
          },
        }
      )
      console.log(`✅ Updated hidden variant price from ${currentPrice} to ${desiredPrice}`)
    }

    return true
  } catch (error) {
    console.error('Failed to update inventory tracking / price:', error)
    return false
  }
}

/**
 * Ensure option pricing product exists, create if needed.
 * Re-publishes existing products to all publications on every call so shops that added a new
 * sales channel / Market publication after install don't end up with an excluded pricing product
 * (storefront 404 → cart skips additional-cost line, silently).
 */
export async function ensureOptionPricingProduct(
  admin: AdminApiContext,
  averagePrice?: number
): Promise<string | null> {
  const existingProduct = await getOptionPricingProduct(admin)

  if (existingProduct) {
    // Update existing product to ensure inventory tracking is disabled
    await updateOptionPricingProductInventory(admin, existingProduct.id, averagePrice)

    // Migrate existing ACTIVE products to UNLISTED (hidden from search/collections)
    if (existingProduct.status === 'ACTIVE') {
      try {
        await admin.graphql(
          `
          mutation productUpdate($input: ProductInput!) {
            productUpdate(input: $input) {
              product { id status }
              userErrors { field message }
            }
          }
        `,
          {
            variables: {
              input: { id: existingProduct.id, status: 'UNLISTED' },
            },
          }
        )
        console.log('✅ Migrated option pricing product from ACTIVE to UNLISTED')
      } catch (error) {
        console.warn('⚠️ Failed to migrate product to UNLISTED status:', error)
      }
    }

    // Idempotent re-publish — covers existing shops where product was only on Online Store
    // publication, so buyers in Markets with separate catalogs would 404 the product
    await publishProductToAllPublications(new ShopifyApiClient(admin), existingProduct.id)

    return existingProduct.id
  }

  return createOptionPricingProduct(admin, averagePrice)
}
