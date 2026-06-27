import type { PrintAreaDocument } from './PrintArea'
import type { MockupDocument } from './Mockup'
import type { Money } from '~/constants/shopify'
import type { ShineOnMapping } from '~/modules/Fulfillments/ShineOn/types'
interface VariantIntegrationDocument {
  /**
   * Unique identifier for the variant.
   * This is the MongoDB ID of the variant.
   */
  _id: string

  /**
   * Unique identifier for the variant.
   * Indexed for faster lookup.
   * This is the Shopify ID of the variant.
   */
  id: string

  /**
   * Identifier linking the variant to its product.
   */
  productId: string

  /**
   * List of print area identifiers associated with the variant.
   * Each string references a PrintArea document.
   */
  printAreas: string[] | PrintAreaDocument[]

  /**
   * Identifier linking the variant to its mockup.
   */
  mockup: string | MockupDocument

  /**
   * Flag indicating whether the product is activated.
   */
  productActivated?: boolean

  /**
   * The title of the product variant.
   */
  title?: string

  /**
   * Display name of the variant, based on product's title + variant's title.
   */
  displayName?: string

  /**
   * The price of the product variant in the default shop currency.
   */
  price: Money

  /**
   * The price of the product variant in USD.
   */
  priceInUSD: number

  /**
   * The compare-at price of the variant in the default shop currency.
   */
  compareAtPrice: Money

  /**
   * The compare-at price of the variant in USD.
   */
  compareAtPriceInUSD: number

  /**
   * A case-sensitive identifier for the product variant in the shop.
   * Required in order to connect to a fulfillment service.
   */
  sku?: string

  /**
   * A list of custom fields, including their namespace and key,
   * that's associated with a Shopify resource.
   */
  metafields: Record<string, unknown>[]

  /**
   * The shop domain this variant belongs to
   */
  shopDomain?: string

  /**
   * ShineOn personalization mapping configuration.
   * Maps TailorKit text layers to ShineOn engraving slots.
   */
  shineOnMapping?: ShineOnMapping

  /**
   * Whether this variant's SKU is unavailable/discontinued on the fulfillment provider.
   */
  unavailable?: boolean

  /**
   * Timestamps for document creation and updates
   */
  createdAt?: Date
  updatedAt?: Date
}

export { VariantIntegrationDocument }
