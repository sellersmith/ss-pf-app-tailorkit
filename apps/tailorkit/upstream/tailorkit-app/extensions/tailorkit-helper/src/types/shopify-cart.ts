/**
 * Comprehensive TypeScript type definitions for Shopify's cart.js API response
 * Based on official Shopify documentation: https://shopify.dev/docs/api/ajax/reference/cart
 */

/**
 * Currency code following ISO 4217 format
 */
export type CurrencyCode =
  | 'AED'
  | 'AFN'
  | 'ALL'
  | 'AMD'
  | 'ANG'
  | 'AOA'
  | 'ARS'
  | 'AUD'
  | 'AWG'
  | 'AZN'
  | 'BAM'
  | 'BBD'
  | 'BDT'
  | 'BGN'
  | 'BHD'
  | 'BIF'
  | 'BMD'
  | 'BND'
  | 'BOB'
  | 'BOV'
  | 'BRL'
  | 'BSD'
  | 'BTN'
  | 'BWP'
  | 'BYN'
  | 'BZD'
  | 'CAD'
  | 'CDF'
  | 'CHE'
  | 'CHF'
  | 'CHW'
  | 'CLF'
  | 'CLP'
  | 'CNY'
  | 'COP'
  | 'COU'
  | 'CRC'
  | 'CUC'
  | 'CUP'
  | 'CVE'
  | 'CZK'
  | 'DJF'
  | 'DKK'
  | 'DOP'
  | 'DZD'
  | 'EGP'
  | 'ERN'
  | 'ETB'
  | 'EUR'
  | 'FJD'
  | 'FKP'
  | 'GBP'
  | 'GEL'
  | 'GHS'
  | 'GIP'
  | 'GMD'
  | 'GNF'
  | 'GTQ'
  | 'GYD'
  | 'HKD'
  | 'HNL'
  | 'HRK'
  | 'HTG'
  | 'HUF'
  | 'IDR'
  | 'ILS'
  | 'INR'
  | 'IQD'
  | 'IRR'
  | 'ISK'
  | 'JMD'
  | 'JOD'
  | 'JPY'
  | 'KES'
  | 'KGS'
  | 'KHR'
  | 'KMF'
  | 'KPW'
  | 'KRW'
  | 'KWD'
  | 'KYD'
  | 'KZT'
  | 'LAK'
  | 'LBP'
  | 'LKR'
  | 'LRD'
  | 'LSL'
  | 'LYD'
  | 'MAD'
  | 'MDL'
  | 'MGA'
  | 'MKD'
  | 'MMK'
  | 'MNT'
  | 'MOP'
  | 'MRU'
  | 'MUR'
  | 'MVR'
  | 'MWK'
  | 'MXN'
  | 'MXV'
  | 'MYR'
  | 'MZN'
  | 'NAD'
  | 'NGN'
  | 'NIO'
  | 'NOK'
  | 'NPR'
  | 'NZD'
  | 'OMR'
  | 'PAB'
  | 'PEN'
  | 'PGK'
  | 'PHP'
  | 'PKR'
  | 'PLN'
  | 'PYG'
  | 'QAR'
  | 'RON'
  | 'RSD'
  | 'RUB'
  | 'RWF'
  | 'SAR'
  | 'SBD'
  | 'SCR'
  | 'SDG'
  | 'SEK'
  | 'SGD'
  | 'SHP'
  | 'SLL'
  | 'SOS'
  | 'SRD'
  | 'SSP'
  | 'STN'
  | 'SVC'
  | 'SYP'
  | 'SZL'
  | 'THB'
  | 'TJS'
  | 'TMT'
  | 'TND'
  | 'TOP'
  | 'TRY'
  | 'TTD'
  | 'TWD'
  | 'TZS'
  | 'UAH'
  | 'UGX'
  | 'USD'
  | 'USN'
  | 'UYI'
  | 'UYU'
  | 'UYW'
  | 'UZS'
  | 'VES'
  | 'VND'
  | 'VUV'
  | 'WST'
  | 'XAF'
  | 'XAG'
  | 'XAU'
  | 'XBA'
  | 'XBB'
  | 'XBC'
  | 'XBD'
  | 'XCD'
  | 'XDR'
  | 'XOF'
  | 'XPD'
  | 'XPF'
  | 'XPT'
  | 'XSU'
  | 'XTS'
  | 'XUA'
  | 'XXX'
  | 'YER'
  | 'ZAR'
  | 'ZMW'
  | 'ZWL'

/**
 * Product option with name and value
 */
export interface OptionWithValue {
  name: string
  value: string
}

/**
 * Product image details
 */
export interface FeaturedImage {
  aspect_ratio: number
  alt: string
  height: number
  url: string
  width: number
}

/**
 * Line item properties - custom key-value pairs
 */
export type LineItemProperties = Record<string, string | null>

/**
 * Discount application types
 */
export type DiscountApplicationType = 'automatic' | 'discount_code' | 'manual' | 'script'

/**
 * Discount value types
 */
export type DiscountValueType = 'fixed_amount' | 'percentage'

/**
 * Discount allocation methods
 */
export type DiscountAllocationMethod = 'across' | 'each'

/**
 * Discount target types
 */
export type DiscountTargetType = 'line_item' | 'shipping_line'

/**
 * Discount target selections
 */
export type DiscountTargetSelection = 'all' | 'entitled' | 'explicit'

/**
 * Individual discount on a line item
 */
export interface LineItemDiscount {
  amount: number
  title: string
}

/**
 * Discount application at cart or line level
 */
export interface DiscountApplication {
  type: DiscountApplicationType
  key: string
  title: string
  description: string | null
  value: string
  created_at: string
  value_type: DiscountValueType
  allocation_method: DiscountAllocationMethod
  target_selection: DiscountTargetSelection
  target_type: DiscountTargetType
  total_allocated_amount: number
}

/**
 * Line-level discount allocation
 */
export interface LineItemDiscountAllocation {
  amount: number
  discount_application: DiscountApplication
}

/**
 * Quantity rules for line items
 */
export interface QuantityRule {
  min: number
  max: number | null
  increment: number
}

/**
 * Unit price measurement details
 */
export interface UnitPriceMeasurement {
  measured_type: 'weight' | 'volume' | 'dimension' | 'area'
  quantity_value: string
  quantity_unit: string
  reference_value: number
  reference_unit: string
}

/**
 * Selling plan price adjustments
 */
export interface SellingPlanPriceAdjustment {
  order_count: number | null
  position: number
  value_type: 'percentage' | 'fixed_amount' | 'price'
  value: number
}

/**
 * Selling plan details
 */
export interface SellingPlan {
  id: number
  name: string
  description: string | null
  options: Array<{
    name: string
    position: number
    value: string
  }>
  recurring_deliveries: boolean
  fixed_selling_plan?: boolean
  price_adjustments: SellingPlanPriceAdjustment[]
}

/**
 * Selling plan allocation for line items
 */
export interface SellingPlanAllocation {
  price_adjustments: Array<{
    position: number
    price: number
  }>
  price: number
  compare_at_price: number
  per_delivery_price: number
  selling_plan: SellingPlan
}

/**
 * Individual cart line item
 */
export interface CartLineItem {
  /** Unique line item ID */
  id: number

  /** Line item properties - custom key-value pairs */
  properties: LineItemProperties

  /** Quantity of this line item */
  quantity: number

  /** Product variant ID */
  variant_id: number

  /** Unique key identifying this specific line item configuration */
  key: string

  /** Full title including variant title */
  title: string

  /** Current price per unit in cents */
  price: number

  /** Original price per unit before discounts in cents */
  original_price: number

  /** Final price after discounts in cents */
  discounted_price: number

  /** Total price for this line (price * quantity) in cents */
  line_price: number

  /** Original total price before discounts in cents */
  original_line_price: number

  /** Total discount amount for this line in cents */
  total_discount: number

  /** Array of discount objects applied to this line */
  discounts: LineItemDiscount[]

  /** Stock keeping unit */
  sku: string

  /** Weight in grams */
  grams: number

  /** Product vendor/supplier */
  vendor: string

  /** Whether this item is taxable */
  taxable: boolean

  /** Product ID */
  product_id: number

  /** Whether the product has only the default variant */
  product_has_only_default_variant: boolean

  /** Whether this is a gift card */
  gift_card: boolean

  /** Final price per unit after all discounts in cents */
  final_price: number

  /** Final total line price after all discounts in cents */
  final_line_price: number

  /** Product URL */
  url: string

  /** Featured product image */
  featured_image: FeaturedImage

  /** Direct image URL (deprecated, use featured_image) */
  image: string

  /** Product handle */
  handle: string

  /** Whether this product requires shipping */
  requires_shipping: boolean

  /** Product type */
  product_type: string

  /** Main product title */
  product_title: string

  /** Product description */
  product_description: string

  /** Variant title (size, color, etc.) */
  variant_title: string | null

  /** Array of variant option values */
  variant_options: string[]

  /** Array of options with names and values */
  options_with_values: OptionWithValue[]

  /** Line-level discount allocations */
  line_level_discount_allocations: LineItemDiscountAllocation[]

  /** Total line-level discount amount */
  line_level_total_discount: number

  /** Quantity rules for this line item */
  quantity_rule: QuantityRule

  /** Whether this line item has components (bundles) */
  has_components: boolean

  /** Unit price in cents (for weight/volume-based pricing) */
  unit_price?: number

  /** Unit price measurement details */
  unit_price_measurement?: UnitPriceMeasurement

  /** Selling plan allocation if applicable */
  selling_plan_allocation?: SellingPlanAllocation
}

/**
 * Cart attributes - custom key-value pairs for the entire cart
 */
export type CartAttributes = Record<string, string>

/**
 * Main Shopify cart object from cart.js API
 */
export interface ShopifyCart {
  /** Unique cart token */
  token: string

  /** Cart note/message */
  note: string | null

  /** Cart attributes - custom key-value pairs */
  attributes: CartAttributes

  /** Original total price before discounts in cents */
  original_total_price: number

  /** Final total price after discounts in cents */
  total_price: number

  /** Total discount amount in cents */
  total_discount: number

  /** Total weight of all items in grams */
  total_weight: number

  /** Total number of items */
  item_count: number

  /** Array of cart line items */
  items: CartLineItem[]

  /** Whether any items require shipping */
  requires_shipping: boolean

  /** Currency code for all monetary values */
  currency: CurrencyCode

  /** Subtotal of all items before taxes/shipping */
  items_subtotal_price: number

  /** Cart-level discount applications */
  cart_level_discount_applications: DiscountApplication[]
}

/**
 * Simplified cart item interface for basic usage
 * (maintains backward compatibility with existing code)
 */
export interface ShopifyCartItem {
  key: string
  id: number
  properties: Record<string, any>
  [key: string]: any
}

/**
 * Cart API response type for cart.js endpoint
 */
export type CartApiResponse = ShopifyCart

/**
 * Cart API error response
 */
export interface CartApiError {
  status: number
  message: string
  description: string
}

/**
 * Type guard to check if response is an error
 */
export function isCartApiError(response: any): response is CartApiError {
  return response && typeof response.status === 'number' && typeof response.message === 'string'
}

/**
 * Helper type for cart operations
 */
export interface CartUpdateRequest {
  updates?: Record<string | number, number>
  note?: string
  attributes?: CartAttributes
  discount?: string
}

/**
 * Cart add request for adding items
 */
export interface CartAddRequest {
  items: Array<{
    id: number
    quantity: number
    properties?: LineItemProperties
    selling_plan?: number
  }>
}

/**
 * Cart change request for updating specific line items
 */
export interface CartChangeRequest {
  id?: string | number
  line?: number
  quantity?: number
  properties?: LineItemProperties
  selling_plan?: number | null
}
