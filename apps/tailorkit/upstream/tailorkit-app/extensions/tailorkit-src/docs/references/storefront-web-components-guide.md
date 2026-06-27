# Storefront Web Components Guide

## Overview

TailorKit's storefront uses **Web Components** (Custom Elements) for all interactive personalization UI. These components work in both:

- **Storefront** (Shopify theme, rendered by Liquid)
- **Admin Preview** (React app, rendered as JSX)

This works because Web Components are framework-agnostic — the browser auto-activates them via `customElements.define` regardless of how the HTML tag is rendered.

## Golden Rules

### 1. Render as HTML tags, never inject via JS

```html
<!-- ✅ CORRECT: Liquid template renders the tag -->
<tailorkit-text-options-list data-options="{{ options | json }}"></tailorkit-text-options-list>

<!-- ✅ CORRECT: React/JSX renders the tag -->
<tailorkit-text-options-list data-options="{JSON.stringify(options)}" />
```

```typescript
// ❌ WRONG: Dynamically creating and injecting
const el = document.createElement('tailorkit-text-options-list')
container.appendChild(el)
```

**Why:** Dynamic injection breaks the contract between storefront and admin. If the component is injected by JS in `customizer.ts`, the admin preview won't know to inject it too. Rendering as a tag means it works everywhere automatically.

### 2. Register in `registerOptionSetElements.ts`

All storefront Web Components must be registered in the central registry:

```typescript
// extensions/tailorkit-src/src/shared/components/registerOptionSetElements.ts
import { registerMyNewElement } from './MyNewComponent'

export function registerOptionSetElements() {
  // ... existing registrations
  registerMyNewElement()
}
```

This file is imported by both:

- Storefront entry (`tailorkit.ts`)
- Admin preview (`TemplateLayerStoresProviderWrapper`)

So your component activates in both environments.

### 3. Follow the registration pattern

Each component should export a `register*` function:

```typescript
// extensions/tailorkit-src/src/shared/components/MyComponent/index.ts
export const MY_COMPONENT_TAG = 'tailorkit-my-component'

export function registerMyComponentElement() {
  if (!globalThis.customElements.get(MY_COMPONENT_TAG)) {
    globalThis.customElements.define(MY_COMPONENT_TAG, MyComponentElement)
  }
}
```

### 4. Extend `BaseOptionSetElement` for option-set-like components

If your component represents a personalizable option (text, color, font, image, etc.), extend the base class:

```typescript
import { BaseOptionSetElement } from '../BaseOptionSetElement'

class MyOptionSetElement extends BaseOptionSetElement {
  connectedCallback() {
    super.connectedCallback()
    // Your init logic
  }
}
```

For non-option-set components (wizard, views-bar, etc.), extend `HTMLElement` directly.

### 5. Use Preact for complex UI rendering

For components with complex interactive UI, use the Preact bridge pattern:

```typescript
import { h, render } from 'preact'
import { MyPreactComponent } from './preact/MyComponent'

class MyElement extends HTMLElement {
  private container: HTMLDivElement | null = null

  connectedCallback() {
    this.container = document.createElement('div')
    this.appendChild(this.container)
    this.renderPreact()
  }

  disconnectedCallback() {
    if (this.container) render(null, this.container)
  }

  private renderPreact() {
    if (!this.container) return
    const props = {
      /* read from data-* attributes */
    }
    render(h(MyPreactComponent, props), this.container)
  }
}
```

See: `extensions/tailorkit-src/src/assets/components/preact/views-bar/index.tsx` for a full example.

### 6. Pass data via `data-*` attributes

Web Components receive data through HTML attributes, not props:

```html
<tailorkit-my-component data-config='{"key": "value"}' data-product-id="123" />
```

```typescript
connectedCallback() {
  const config = JSON.parse(this.getAttribute('data-config') || '{}')
  const productId = this.getAttribute('data-product-id')
}
```

### 7. CSS: use existing TailorKit variables

Never define component-specific CSS variables. Use existing ones from `tailorkit.css`:

```css
/* ❌ WRONG */
:root {
  --my-component-primary: #5c6ac4;
}

/* ✅ CORRECT */
.my-component {
  color: var(--emtlkit-text-color);
}
.my-component-btn {
  background: var(--emtlkit-button-primary-bg);
}
```

## File Structure

```
extensions/tailorkit-src/src/
├── shared/components/           # Web Component definitions
│   ├── BaseOptionSetElement.ts  # Base class for option-set components
│   ├── registerOptionSetElements.ts  # Central registry
│   ├── TextOptionSet/           # Example: text option set
│   │   ├── index.ts             # register function + exports
│   │   ├── components/          # Web Component class files
│   │   ├── types.ts
│   │   └── styles.css
│   └── ...
├── assets/components/           # Non-shared components
│   ├── wizard/                  # Wizard step-by-step component
│   ├── preact/                  # Preact components (commons)
│   └── ...
└── sub-snippets/                # Liquid templates that render Web Component tags
    ├── option-sets/
    │   ├── text-option.liquid   # Renders <tailorkit-text-options-list>
    │   └── ...
    └── ...
```

## Checklist for New Web Components

- [ ] Create component class extending `HTMLElement` or `BaseOptionSetElement`
- [ ] Export `register*` function with `customElements.define` guard
- [ ] Add to `registerOptionSetElements.ts`
- [ ] Render as HTML tag in Liquid template (if storefront-facing)
- [ ] Render as JSX tag in admin React (if admin-preview-facing)
- [ ] Use `data-*` attributes for data passing
- [ ] Use existing CSS variables from `tailorkit.css`
- [ ] Use Preact bridge for complex UI (import from `preact`, not `preact/compat`)
- [ ] Clean up in `disconnectedCallback` (Preact unmount, event listeners)
- [ ] Test in both storefront AND admin preview
