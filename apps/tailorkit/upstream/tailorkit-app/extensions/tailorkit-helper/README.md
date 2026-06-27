# TailorKit Helper

Self-contained storefront helper script used by TailorKit to keep the online-store cart in sync with product customisations created inside the TailorKit app.

---

## Table of Contents

1.  [Key Features](#key-features)
2.  [Getting Started](#getting-started)
3.  [Runtime API](#runtime-api)
4.  [Configuration](#configuration)
5.  [Internal Architecture](#internal-architecture)
6.  [Development / Build](#development--build)
7.  [Troubleshooting & FAQ](#troubleshooting--faq)

---

## Key Features

| Feature                            | Description                                                                                                                                                                                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cart observer**                  | Listens to all `fetch` / `XMLHttpRequest` calls that hit one of `/cart/(add\|change\|update\|clear)` endpoints. Whenever the request finishes it pulls `cart.js`, compares it against the previously cached state and emits a single cart-change event. |
| **Option-pricing synchronisation** | Keeps the hidden _option–pricing_ line-items created by TailorKit in sync with their visible “parent” product in every scenario (add, quantity change, removal, express checkout, third-party apps, etc.).                                              |
| **Cart image controller**          | <br/>• Detects TailorKit preview images stored in line-item properties and swaps the cart thumbnail accordingly.<br/>• Debounced, idempotent and safe against stale state.<br/>• Works in cart page, drawer, slide-out, mini-cart, etc.                 |
| **Hidden product manager**         | Hides quantity / remove controls – and optionally restyles the row – for line-items marked with `_%{PROPERTY_PREFIX}%_hidden = "true"`.                                                                                                                 |
| **Performance + resiliency**       | Built-in debouncer, retry system, performance monitor, validator, conflict detector and express-checkout guardrails.                                                                                                                                    |
| **Zero-config embed**              | Bundled as a single IIFE (`tailorkit-helper.js`) that you can drop into any Shopify theme. A lightweight global API is exposed for advanced users.                                                                                                      |

---

## Getting Started

### Installation

```bash
# inside extensions/tailorkit-helper
pnpm install  # or npm / yarn
pnpm run build # produces assets/tailorkit-helper.js in TailorKit theme extension
```

The build outputs an IIFE that registers itself automatically when loaded in the browser. Put the file into your theme assets and include it through `theme.liquid` or via a Theme App Extension block/snippet.

> **Note** Build-time values such as `APP_PROXY_PATH`, `SHOPIFY_APP_URL`, etc. are replaced by the `vite-plugin-transform` plugin. Make sure they are present in your `.env` before building.

### CDN / Script Tag

```liquid
{%- if shop.metafields.tailorkit.enable_helper %}
  <script src="{{ 'tailorkit-helper.js' | asset_url }}" defer></script>
{%- endif %}
```

---

## Runtime API

After the script is loaded it exposes a single global namespace (guarded to avoid polluting `window`).

```ts
// window.TailorkitHelper
interface TailorkitHelper {
  /** Low-level observer – most users don’t need this. */
  observeCartChanges: (
    handler: (cart: ShopifyCart, operationType: 'add' | 'change' | 'update' | 'clear' | 'unknown') => void
  ) => () => void

  /** Cached snapshot of the last cart pulled by the helper. */
  lastFetchedCartProducts: { items: CartLineItem[] }
}
```

Because the helper already keeps TailorKit functionality in sync you normally **do not have to call anything**—simply include the script.

---

## Configuration

### Hidden Product Manager

```ts
initializeCartHiddenProductManager({
  cartItemSelector: '.cart-item, .line-item, [data-cart-item]',
  elementsToHide: {
    quantityControls: ['.quantity-input', '.qty', 'input[type="number"]'],
    removeButtons: ['.cart-item__remove', '.remove'],
  },
  hiddenProductStyling: {
    opacity: 0.75,
    backgroundColor: 'rgba(0,0,0,.02)',
    borderLeft: '2px solid #e0e0e0',
  },
  debugMode: false,
})
```

You can call `CartHiddenProductManager.getInstance().updateConfig(newCfg)` anytime to adjust behaviour.

### Cart Image Controller

```ts
ensureCartImageControllerInitialized({
  cartItemSelector: '.cart-item, .line-item, [data-cart-item]',
  imageSelectors: ['img', 'picture img'],
  previewPropertyKey: '_Preview',
  debounceDelay: 750,
  debugMode: false,
})
```

### Build-time Placeholders

`vite.config.js` replaces placeholders wrapped by `%{ }%` – for example the constant `PROPERTY_PREFIX` inside source gets replaced by an uppercase slug of your app’s root domain. This keeps meta-properties unique per shop/app install.

---

## Internal Architecture

```
src/
├─ index.ts                          // Entry – wires everything together
├─ constants/                        // Shared selectors & build-time vars
│  └─ index.ts
├─ handlers/
│  ├─ option-pricing-change.ts       // Heavy-weight synchronisation engine
│  ├─ cart-image-controller.ts       // Thumbnail replacement logic
│  └─ cart-hidden-product-manager.ts // Controls hiding/restyling hidden items
├─ utils/
│  ├─ observe-cart-changes.ts        // Network PerformanceObserver wrapper
│  ├─ cart-synchronization.ts        // Debouncer, validator, monitor, etc.
│  ├─ update-cart.ts                 // Thin wrapper around `/cart/change` API
│  ├─ cart.ts                        // Fetch `/cart.js`
│  └─ pubsub.ts, windowFunction.ts   // Tiny helpers
└─ types/
   └─ shopify-cart.ts                // Strongly-typed cart model
```

Key communication flows are event-driven; e.g. `observe-cart-changes` emits a new cart snapshot → `option-pricing-change` performs diff & corrections → reporters (performance monitor, conflict resolver) log warnings.

---

## Development / Build

1. `pnpm i` – installs deps (only `vite`, `typescript`, `vite-plugin-transform`, `morphdom`).
2. `pnpm dev` – watches files and rebuilds on change.
3. The `lib` build produces an IIFE under `../tailorkit/assets` so the theme extension picks it up without wiping other assets (see `emptyOutDir:false`).

Linting and testing are handled at the monorepo root.

---

## Troubleshooting & FAQ

### The helper does not update images in my custom mini cart

Make sure the container selector configured via `cartItemSelector` matches your markup and that each thumbnail element is matched by one of the `imageSelectors` entries.

### I use an express checkout button and synchronisation breaks

An express checkout guard disables synchronisation once an express button is clicked to avoid race-conditions. If your theme navigates back to the cart you may need to call `window.dispatchEvent(new CustomEvent('tailorkit:express-checkout-end'))` once the cart re-appears.

### Can I opt-out of the hidden product styling?

Pass `hiddenProductStyling: null` or override individual CSS properties in the config.

### Where can I see performance metrics?

Call `CartPerformanceMonitor.getMetrics()` from your browser console.

---

© TailorKit – MIT License
