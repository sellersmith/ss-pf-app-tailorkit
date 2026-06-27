# TailorKit Extension — Development Rules

## Context

Admin app (`app/`) = **merchant** context (Shopify Polaris, power-user workflows).
Extensions (`extensions/`) = **buyer** context (storefront, end-user experience).

This distinction matters for every design and implementation decision.

## Essential References

ALWAYS read the relevant reference before working on extension code:

1. **`references/storefront-web-components-guide.md`** (Web Components)
   - Render as HTML tags, never inject via JS
   - Register in `registerOptionSetElements.ts`
   - Extend `BaseOptionSetElement` or `HTMLElement`
   - CSS: use `--emtlkit-*` variables, never create custom ones
   - Preact bridge pattern for complex UI

2. **`references/preact-web-component-bridge.md`** (Preact + React interop)
   - JSX transform isolation (Preact vs React runtime)
   - Vanilla bridge pattern for embedding Preact in React admin
   - Cleanup in `disconnectedCallback`

## Tech Stack

| Layer     | Technology                                      |
| --------- | ----------------------------------------------- |
| UI        | Preact 10.27 + Web Components (custom elements) |
| Templates | Liquid (100 KB hard limit)                      |
| Canvas    | Konva 10.0 (lazy-loaded)                        |
| State     | Preact Signals                                  |
| Build     | Vite 7.3 + Terser (IIFE output)                 |

## Directory Structure

```
extensions/tailorkit-src/src/
  assets/                # Entry points (tailorkit.ts)
  shared/components/     # Web Components (BaseOptionSetElement subclasses)
  shared/libraries/      # konva, svg, paint, ai, template
  blocks/                # Liquid block sources
  snippets/              # Liquid snippet sources
  sub-snippets/          # Auto-merged Liquid fragments
```

## Size Constraints (Critical)

| Resource           | Limit  | Status                           |
| ------------------ | ------ | -------------------------------- |
| Total Liquid       | 100 KB | **CRITICAL — ~2.7 KB remaining** |
| Locale file        | 15 KB  | OK                               |
| Settings per block | 25 max | OK                               |

**Rules:**

- Liquid budget nearly exhausted. Check bytes before adding ANY Liquid.
- Move logic into Web Components or server-side preparation.
- Every JS KB matters for storefront performance.

## Liquid

Liquid changes = extension rebuild + Shopify deployment. Budget at ~97.3%.

- **Prefer:** server-side filtering, Web Components, API layer
- **Only for:** new structural HTML, new storefront features
- **Never for:** data filtering, visibility rules, business logic

## Data Flow

```
Server (preparation-fns.server.ts) → Metafields → Liquid → Web Components
```

## Key Files

| Purpose            | Path                                                 |
| ------------------ | ---------------------------------------------------- |
| Main entry         | `src/assets/tailorkit.ts`                            |
| Web Components     | `src/shared/components/`                             |
| Component registry | `src/shared/components/registerOptionSetElements.ts` |
| Base class         | `src/shared/components/BaseOptionSetElement.ts`      |
| Customizer block   | `src/blocks/customizer.liquid`                       |
| Build config       | `vite.config.js`, `features.config.js`               |

## Wizard Stepper Contract

Any component rendering `.emtlkit--option-set-container` in admin preview (`Inspector/Personalized/`) **must** add `data-item-id` matching the collector ID format (`${layerId}::${suffix}`). The wizard controller uses this for ID-based DOM matching. Without it, conditional logic hiding elements breaks the stepper (index mismatch → 10s timeout → no render). See `collector.ts` for ID formats: `${layerId}::${osId}` (option sets), `${layerId}::text_customer`, `${layerId}::charm_builder`.

## Build

```bash
npm run build          # Full build
npm run build:main     # Main bundle only
npm run build:features # Feature modules only
npm run dev            # Watch mode
```
