# TailorKit Events API

## Overview

TailorKit provides a public Events API for **inter-app communication**. This allows other Shopify apps (like OneTick, upsell apps, bundle apps, etc.) to integrate with TailorKit's cart flow without direct code dependencies.

## Why Events API?

- **Loose coupling** - Apps communicate via events, no direct imports needed
- **Smaller bundle sizes** - No code duplication across extensions
- **Optional integration** - If the listening app isn't loaded, events are simply ignored
- **Type-safe** - TypeScript interfaces available for event details
- **Extensible** - Easy to add new events for future integrations

## Available Events

### `tailorkit-prepare-cart-data`

Dispatched **before** TailorKit submits cart data via the Buy It Now flow. This allows other apps to inject additional data into the cart request.

**When it fires:**

- User clicks Buy It Now on a customized product
- Before the `/cart/add.js` request is sent

**Event Detail:**

```typescript
interface TailorKitPrepareCartEventDetail {
  /** The FormData object that will be submitted to /cart/add.js */
  formData: FormData
  /** The variant ID of the product being added */
  variantId: string
}
```

**Use Cases:**

- Add-on products (checkboxes)
- Bundle products
- Upsell items
- Custom line item properties
- Discount codes

## Usage Examples

### Basic Usage (JavaScript)

```javascript
document.addEventListener('tailorkit-prepare-cart-data', event => {
  const { formData, variantId } = event.detail

  // Add custom data to the cart request
  formData.append('properties[_my_custom_field]', 'custom_value')
})
```

### Add-on Products (OneTick Example)

```javascript
document.addEventListener('tailorkit-prepare-cart-data', event => {
  const { formData, variantId } = event.detail

  // Find checked add-on checkboxes
  const checkboxes = document.querySelectorAll('onetick-checkbox input:checked')

  checkboxes.forEach((checkbox, index) => {
    const addonVariantId = checkbox.dataset.variantId
    formData.append(`items[addon_${index}][id]`, addonVariantId)
    formData.append(`items[addon_${index}][quantity]`, '1')
  })
})
```

### TypeScript Usage

```typescript
import type { TailorKitPrepareCartEventDetail } from 'tailorkit-src/assets/events'

document.addEventListener('tailorkit-prepare-cart-data', (event: Event) => {
  const customEvent = event as CustomEvent<TailorKitPrepareCartEventDetail>
  const { formData, variantId } = customEvent.detail

  // Type-safe access to formData and variantId
  formData.append('my_field', 'value')
})
```

### Conditional Processing

```typescript
document.addEventListener('tailorkit-prepare-cart-data', event => {
  const { formData, variantId } = event.detail

  // Only process for specific products
  if (shouldProcessVariant(variantId)) {
    addBundleItems(formData, variantId)
  }
})
```

## Event Constants

For consistency, use the exported constants:

```typescript
// In TailorKit
import { TAILORKIT_EVENTS } from './events'

TAILORKIT_EVENTS.PREPARE_CART_DATA // 'tailorkit-prepare-cart-data'
```

```typescript
// In other apps (define locally to avoid cross-extension imports)
const TAILORKIT_EVENTS = {
  PREPARE_CART_DATA: 'tailorkit-prepare-cart-data',
} as const
```

## Developer Discovery

TailorKit logs available events to the console on initialization:

```
 TailorKit Events API

Available events for inter-app communication:
{
  PREPARE_CART_DATA: "- Dispatched before Buy It Now cart submission
    - Detail: { formData: FormData, variantId: string }"
}
```

## Best Practices

### 1. Register Listeners Early

Register your event listeners as early as possible to ensure they're ready when events fire:

```javascript
// Good - register immediately
document.addEventListener('tailorkit-prepare-cart-data', handler)

// Avoid - may miss events
window.addEventListener('load', () => {
  document.addEventListener('tailorkit-prepare-cart-data', handler)
})
```

### 2. Handle Missing Data Gracefully

```javascript
document.addEventListener('tailorkit-prepare-cart-data', event => {
  const { formData, variantId } = event.detail || {}

  if (!formData || !variantId) {
    console.warn('[MyApp] Invalid event detail')
    return
  }

  // Process safely
})
```

### 3. Avoid Duplicate Processing

```javascript
document.addEventListener('tailorkit-prepare-cart-data', event => {
  const { formData } = event.detail

  // Check if already processed
  if (formData.has('_my_app_processed')) {
    return
  }

  // Mark as processed
  formData.append('_my_app_processed', 'true')

  // Add your data
})
```

### 4. Log in Debug Mode

```javascript
const DEBUG = window.__my_app__?.debugMode

document.addEventListener('tailorkit-prepare-cart-data', event => {
  if (DEBUG) {
    console.log('[MyApp] Received tailorkit-prepare-cart-data:', event.detail)
  }

  // Process event
})
```

## Architecture

```
┌─────────────────┐     CustomEvent      ┌─────────────────┐
│    TailorKit    │ ──────────────────▶  │     OneTick     │
│                 │                      │                 │
│ Buy It Now Flow │  formData, variantId │ Checkbox Data   │
└─────────────────┘                      └─────────────────┘
         │                                       │
         │                                       │
         ▼                                       ▼
┌─────────────────────────────────────────────────────────┐
│                      FormData                           │
│  - Product variant                                      │
│  - TailorKit customizations                             │
│  - OneTick checkbox add-ons                             │
│  - Other app data...                                    │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  /cart/add.js   │
└─────────────────┘
```

## File References

| File                                 | Description                                      |
| ------------------------------------ | ------------------------------------------------ |
| `assets/events/index.ts`             | Event constants, interfaces, and helpers         |
| `assets/handlers/buyItNowHandler.ts` | Dispatches PREPARE_CART_DATA event               |
| `assets/tailorkit.ts`                | Initializes events API and logs available events |

## Future Events

The Events API is designed to be extensible. Planned future events:

- `tailorkit-customization-changed` - When user changes customization options
- `tailorkit-canvas-updated` - When canvas preview is updated
- `tailorkit-option-selected` - When user selects an option

## Troubleshooting

### Event Not Firing

1. Ensure TailorKit is loaded before your app
2. Check that the product has customizations (event only fires for customized products)
3. Verify the Buy It Now button is being intercepted (check console for `[TailorKit]` logs)

### Data Not Appearing in Cart

1. Verify your event listener is registered
2. Check that you're appending to `formData` correctly
3. Use browser DevTools to inspect the network request body

### TypeScript Errors

Import types from the events file:

```typescript
import type { TailorKitPrepareCartEventDetail } from 'tailorkit-src/assets/events'
```

## Contributing

To add new events:

1. Add the event name to `TAILORKIT_EVENTS` in `assets/events/index.ts`
2. Add the event description to `TAILORKIT_EVENTS_INSTRUCTIONS`
3. Create an interface for the event detail
4. Dispatch the event using `dispatchTailorKitEvent()`
5. Update this documentation
