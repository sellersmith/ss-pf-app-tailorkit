# Shopify Cart.js API TypeScript Definitions

This document describes the comprehensive TypeScript type definitions for Shopify's cart.js API response, located in `app/types/shopify-cart.ts`.

## Overview

The type definitions provide complete type safety for working with Shopify's cart.js API, covering all properties and nested objects returned by the `/cart.js` endpoint.

## Main Types

### `ShopifyCart`

The main cart object returned by the cart.js API.

```typescript
interface ShopifyCart {
  token: string
  note: string | null
  attributes: CartAttributes
  original_total_price: number
  total_price: number
  total_discount: number
  total_weight: number
  item_count: number
  items: CartLineItem[]
  requires_shipping: boolean
  currency: CurrencyCode
  items_subtotal_price: number
  cart_level_discount_applications: DiscountApplication[]
}
```

### `CartLineItem`

Individual line items in the cart with complete product and pricing information.

```typescript
interface CartLineItem {
  id: number
  properties: LineItemProperties
  quantity: number
  variant_id: number
  key: string
  title: string
  price: number
  original_price: number
  discounted_price: number
  line_price: number
  original_line_price: number
  total_discount: number
  discounts: LineItemDiscount[]
  // ... many more properties
}
```

## Key Features

### 1. Complete Currency Support

Includes all ISO 4217 currency codes:

```typescript
type CurrencyCode = 'USD' | 'CAD' | 'EUR' | 'GBP' | /* ... 160+ more currencies */;
```

### 2. Discount System Types

Comprehensive support for Shopify's discount system:

- `DiscountApplication` - Cart and line-level discounts
- `LineItemDiscountAllocation` - How discounts are allocated to line items
- `DiscountApplicationType` - automatic, discount_code, manual, script

### 3. Selling Plans Support

Full support for subscription and selling plan features:

```typescript
interface SellingPlanAllocation {
  price_adjustments: Array<{ position: number; price: number }>
  price: number
  compare_at_price: number
  per_delivery_price: number
  selling_plan: SellingPlan
}
```

### 4. Product Information

Complete product and variant details:

- Product images with dimensions and alt text
- Variant options and values
- SKU, weight, vendor information
- Shipping and tax requirements

## Usage Examples

### Basic Cart Fetching

```typescript
import type { ShopifyCart, CartApiError, isCartApiError } from '~/types/shopify-cart'

async function fetchCart(): Promise<ShopifyCart | null> {
  try {
    const response = await fetch('/cart.js')
    const data = await response.json()

    if (isCartApiError(data)) {
      console.error('Cart API Error:', data.message)
      return null
    }

    return data as ShopifyCart
  } catch (error) {
    console.error('Failed to fetch cart:', error)
    return null
  }
}
```

### Working with Line Items

```typescript
function calculateCartSummary(cart: ShopifyCart) {
  const summary = {
    totalItems: cart.item_count,
    subtotal: cart.items_subtotal_price,
    totalDiscount: cart.total_discount,
    finalTotal: cart.total_price,
    currency: cart.currency,
    hasShippableItems: cart.items.some(item => item.requires_shipping),
    hasGiftCards: cart.items.some(item => item.gift_card),
  }

  return summary
}
```

### Adding Items with Properties

```typescript
import type { CartAddRequest, LineItemProperties } from '~/types/shopify-cart'

async function addToCart(variantId: number, quantity: number, properties?: LineItemProperties) {
  const payload: CartAddRequest = {
    items: [
      {
        id: variantId,
        quantity,
        ...(properties && { properties }),
      },
    ],
  }

  const response = await fetch('/cart/add.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  return response.json()
}
```

### Discount Analysis

```typescript
function analyzeDiscounts(cart: ShopifyCart) {
  const lineItemDiscounts = cart.items.reduce((total, item) => {
    return total + item.line_level_total_discount
  }, 0)

  const cartLevelDiscounts = cart.cart_level_discount_applications.reduce((total, discount) => {
    return total + discount.total_allocated_amount
  }, 0)

  return {
    lineItemDiscounts,
    cartLevelDiscounts,
    totalSavings: lineItemDiscounts + cartLevelDiscounts,
  }
}
```

## Error Handling

The types include comprehensive error handling:

```typescript
interface CartApiError {
  status: number
  message: string
  description: string
}

// Type guard function
function isCartApiError(response: any): response is CartApiError {
  return response && typeof response.status === 'number' && typeof response.message === 'string'
}
```

## Backward Compatibility

The types maintain backward compatibility with existing code:

```typescript
// Simple interface for basic usage (existing code)
interface ShopifyCartItem {
  key: string
  id: number
  properties: Record<string, any>
  [key: string]: any
}
```

## API Endpoints Covered

These types work with all Shopify cart API endpoints:

- `GET /cart.js` - Get current cart
- `POST /cart/add.js` - Add items to cart
- `POST /cart/update.js` - Update cart quantities/attributes
- `POST /cart/change.js` - Change specific line items
- `POST /cart/clear.js` - Clear cart

## Integration with Existing Code

To use these types in your existing cart utilities:

1. Import the types you need:

```typescript
import type { ShopifyCart, CartLineItem } from '~/types/shopify-cart'
```

2. Update function signatures:

```typescript
// Before
function processCart(cart: any) { ... }

// After
function processCart(cart: ShopifyCart) { ... }
```

3. Get full IntelliSense and type checking for all cart properties and methods.

## Notes

- All monetary values are in the store's base currency units (usually cents)
- The `currency` field indicates the presentment currency for the customer
- Line item `key` values are not persistent and may change when cart is modified
- Use `variant_id` for stable item identification, `key` for line-specific operations
