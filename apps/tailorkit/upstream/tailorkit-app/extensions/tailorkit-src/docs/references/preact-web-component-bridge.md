## Preact Web Component (Vanilla Bridge) — Quick Guide

This guide explains how our image editor modal is implemented as a reusable Web Component, rendered with Preact, and embedded inside a React Admin app without interop issues.

### Why

- React + Preact can conflict in dev/strict mode (e.g., "Cannot add property \_\_").
- Fix: render Preact into a plain DOM node inside a standard `HTMLElement` (no React in that subtree).

### ⚠️ Critical: JSX Transform & Runtime Isolation

**Problem**: In a monorepo with both React (main app) and Preact (extensions), JSX can be compiled using the wrong runtime, causing:

```
❌ Uncaught TypeError: Cannot add property __, object is not extensible
```

**Root Cause**:

- React creates **frozen/immutable** vnodes (objects not extensible)
- Preact creates **mutable** vnodes
- When Preact components use React's JSX transform, they try to mutate frozen objects → error

**The Fix (Two Required Parts)**:

1. **Always use pure Preact imports** (never `preact/compat`):

   ```tsx
   ❌ BAD:
   import { forwardRef } from 'preact/compat'
   import type { ReactNode } from 'preact/compat'

   ✅ GOOD:
   import type { ComponentChildren } from 'preact'
   import { useMemo } from 'preact/hooks'
   ```

2. **Always add JSX pragma at the top of every Preact component file**:

   ```tsx
   /** @jsxImportSource preact */
   ```

   This **forces** the compiler to use Preact's JSX transform (`h()`) instead of React's (`createElement()`).

**Why Both Are Required**:

- Without pure Preact imports: `preact/compat` mimics React's frozen object behavior
- Without JSX pragma: Compiler may inherit React's JSX transform from parent context
- Together: Complete isolation from React runtime

**Best Practice**: Add `/** @jsxImportSource preact */` to **all** `.tsx` files in the extensions folder, even if they work without it. This prevents future conflicts when components are imported across boundaries.

### Where

- Preact UI: `extensions/tailorkit-src/src/shared/components/ImageEditorModal/preact-image-editor-modal.tsx`
- Web Component bridge: `extensions/tailorkit-src/src/shared/components/ImageEditorModal/vanilla-bridge-modal.tsx`
- Public entry: `extensions/tailorkit-src/src/shared/components/ImageEditorModal/index.ts`
- Orchestrator (usage in Admin): `extensions/tailorkit-src/src/assets/handlers/event-handlers/image-editor/modal.ts`

### Minimal props

- objectUrl: string
- layerDimensions: { width, height, left, top, rotation }
- imageElement: HTMLImageElement
- optional: initialState, transformerConfig, maskConfig, onCancel, onSubmit, onReplaceImage, onRemoveBackground

### Bridge pattern (essentials)

```ts
// Create a standard element and render Preact into a plain div
class EmtlkitImageEditorModalElement extends HTMLElement {
  connectedCallback() {
    const container = document.createElement('div')
    this.appendChild(container)
    const close = () => this.parentNode && this.parentNode.removeChild(this)
    render(h(PreactImageEditorModal, { ...this, close }), container)
  }
  disconnectedCallback() {
    render(null, this.firstElementChild as Element)
  }
}
customElements.define('tailorkit-image-editor-modal', EmtlkitImageEditorModalElement)
```

Notes:

- Use definite assignment (`!`) for required props.
- Keep bridge in light DOM (no shadow) so Konva selectors work.
- Pass plain/cloned props to Preact to avoid frozen objects.

### Use

```ts
registerImageEditorModalElement()
await showImageEditorModal({ objectUrl, layerDimensions, imageElement: img })
```

### Build

From `extensions/tailorkit-src`:

```bash
npm run build
```

This emits `../tailorkit/assets/tailorkit.js` consumed by the Admin app.

### Tips

- Use the vanilla bridge (`vanilla-bridge-modal.tsx`), not `preact-custom-element`.
- Ensure light DOM and stable container id for Konva.
- Import `{ h, render }` from 'preact' where used.

### Extend

1. Add typed props to `ImageEditorModalWebComponentProps`.
2. Mirror on the WC class (types + definite assignment when required).
3. Forward props in `renderPreactComponent()` (clone if needed).
4. Keep callbacks typed; avoid `any`.

### 🔧 Troubleshooting

#### Error: "Cannot add property \_\_, object is not extensible"

**Quick Fix Checklist**:

- [ ] Add `/** @jsxImportSource preact */` at the top of the Preact component file
- [ ] Replace `preact/compat` imports with pure `preact` imports
- [ ] Check imported components also have the pragma
- [ ] Rebuild extensions: `yarn build-ext`

**Where It Happens**:

- ✅ Works in storefront (pure Preact environment)
- ❌ Fails in React/Remix admin app (mixed runtime)

**Why**: The JSX compiler is using React's transform instead of Preact's, creating frozen objects that Preact can't mutate.

**Prevention**:

- Add `/** @jsxImportSource preact */` to all new `.tsx` files in `extensions/`
- Never import from `preact/compat` in extension components
- Use `ComponentChildren` instead of `ReactNode` for type definitions

#### Error: Component not rendering in modal

**Check**:

1. Web Component registered? Call `registerImageEditorModalElement()` before use
2. Props passed correctly? Verify `objectUrl`, `layerDimensions`, `imageElement` are defined
3. Container ID unique? Konva needs a unique DOM ID per instance
4. Light DOM rendering? Shadow DOM breaks Konva's `document.getElementById()`

#### Performance Issues

**Tips**:

- Konva cleanup: Ensure `editor.cleanup()` is called in `disconnectedCallback()`
- Object URLs: Revoke with `URL.revokeObjectURL()` when done
- Deep cloning: Only clone plain objects, not HTMLImageElement or callbacks
