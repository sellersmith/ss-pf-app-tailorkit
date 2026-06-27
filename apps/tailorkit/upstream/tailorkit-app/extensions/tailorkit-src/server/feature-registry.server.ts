/**
 * Server-side feature bundle registry for the vintage-theme / custom-HTML installation snippet.
 *
 * Consumed by the POST action of `app/routes/api.app_proxy.product-variant-integration/route.tsx`
 * to decide which asset bundles are inlined in the response. Lives inside the extension folder
 * so feature identity stays anchored to the canonical build catalog (`../features.config.js`).
 *
 * Adding a new feature bundle:
 *   1. Add the entry to `../features.config.js` (consumed by the Vite multi-bundle build).
 *   2. Add a matching key to `CONDITIONS` below with the inclusion predicate. A missing entry
 *      will throw at module load — this is intentional to prevent silently shipping a new
 *      bundle to every product when a gate was expected.
 *   3. The client-side snippet is unchanged.
 *
 * Design contract (mirrors `src/assets/utils/feature-loader.ts`):
 *   - Feature bundles MUST execute BEFORE `tailorkit.js`. Each registers a window global
 *     (TailorKitKonva, TailorKitPinchZoom, TailorKitCharmBuilder) via `notifyFeatureReady()`.
 *     The main bundle's feature-loader resolves via `getWindowFeature()` — no
 *     `script[src*="..."]` detection is needed because the scripts are inlined, not external.
 *   - `tailorkit.js` is the main bundle and MUST remain the last entry. Enforced at module load.
 */

import { features as EXTENSION_FEATURES_RAW } from '../features.config.js'

// Validate the imported feature catalog shape at module load. features.config.js is
// untyped JS — if someone renames a field (e.g. outputFile → output), the map below
// would silently produce entries with undefined names and corrupt the response.
// Fail fast here so a malformed catalog crashes server boot instead of per-request runtime.
if (!Array.isArray(EXTENSION_FEATURES_RAW)) {
  throw new Error('[feature-registry] features.config.js did not export a features array')
}
for (const entry of EXTENSION_FEATURES_RAW as unknown[]) {
  const narrow = entry as { name?: unknown; outputFile?: unknown } | null
  if (!narrow || typeof narrow.name !== 'string' || typeof narrow.outputFile !== 'string') {
    throw new Error(
      `[feature-registry] Malformed features.config.js entry — expected { name: string, outputFile: string, ... }: ${JSON.stringify(
        entry
      )}`
    )
  }
}
const EXTENSION_FEATURES = EXTENSION_FEATURES_RAW as Array<{ name: string; outputFile: string }>

/** Main bundle filename — sentinel appended after all feature bundles. */
export const MAIN_BUNDLE_NAME = 'tailorkit.js'

/** Context passed to a feature's `when()` predicate to decide inclusion. */
export interface FeatureContext {
  /** Raw product-variant app metafield (shape: `{ [variantKey]: { mockup: { printAreas } } }`). */
  metafield: unknown
  /** App-level settings object (`app.metafields.em_tailorkit.app_settings.value`). */
  appSettings: Record<string, unknown> | null
}

/** A single feature bundle declaration returned to the route handler. */
export interface FeatureDecl {
  /** Asset filename located under `extensions/tailorkit/assets/`. */
  name: string
  /** Gate deciding whether to ship this bundle in the current response. */
  when: (ctx: FeatureContext) => boolean
}

/**
 * Walks the product metafield looking for any print area carrying a charm config.
 *
 * Mirrors the storefront's client-side gate (`customizer.ts#hasCharmConfig`). We walk the
 * nested structure instead of a string scan to avoid false positives from unrelated
 * metadata (layer names, translations, etc.) that happen to contain the literal "charmConfig".
 */
export function metafieldHasCharmConfig(metafield: unknown): boolean {
  if (!metafield || typeof metafield !== 'object') return false
  for (const variantEntry of Object.values(metafield as Record<string, unknown>)) {
    const printAreas = (variantEntry as { mockup?: { printAreas?: unknown[] } } | null)?.mockup?.printAreas
    if (!Array.isArray(printAreas)) continue
    for (const pa of printAreas) {
      const area = pa as { charmConfig?: unknown; charmConfigs?: unknown[] } | null
      if (area?.charmConfigs?.length || area?.charmConfig) return true
    }
  }
  return false
}

/**
 * Pinch-zoom uses an opt-out model — enabled unless `previewZoom.enabled` is explicitly false.
 * Matches the Liquid guard in `customizer.liquid` (`previewZoom.enabled != false`).
 */
function isPinchZoomEnabled({ appSettings }: FeatureContext): boolean {
  const previewZoom = (appSettings as { previewZoom?: { enabled?: boolean } } | null)?.previewZoom
  return previewZoom?.enabled !== false
}

/**
 * Inclusion predicates keyed by extension feature name (from `features.config.js`).
 * Every feature in the extension config MUST have a corresponding entry here —
 * missing keys trigger a module-load error so a new bundle never silently ships
 * with a default-true gate.
 */
const CONDITIONS: Record<string, (ctx: FeatureContext) => boolean> = {
  konva: () => true, // Always shipped — canvas rendering is required for every personalized product.
  'pinch-zoom': isPinchZoomEnabled,
  'charm-builder': ({ metafield }) => metafieldHasCharmConfig(metafield),
}

/**
 * Ordered registry of feature bundles shipped with the vintage-theme snippet response.
 * Order follows `features.config.js` (build catalog); main bundle is appended last.
 */
export const FEATURE_REGISTRY: readonly FeatureDecl[] = [
  ...EXTENSION_FEATURES.map(feature => {
    const when = CONDITIONS[feature.name]
    if (!when) {
      throw new Error(
        `[feature-registry] Missing inclusion condition for extension feature "${feature.name}". `
          + `Add a matching entry to CONDITIONS in extensions/tailorkit-src/server/feature-registry.server.ts.`
      )
    }
    return { name: feature.outputFile, when }
  }),
  // Main bundle — MUST remain last. Consumes already-registered feature globals during init.
  { name: MAIN_BUNDLE_NAME, when: () => true },
]

/**
 * Runtime invariant — evaluated at module load so a mis-ordered registry fails the server
 * boot loudly instead of silently corrupting the storefront snippet.
 */
if (FEATURE_REGISTRY[FEATURE_REGISTRY.length - 1]?.name !== MAIN_BUNDLE_NAME) {
  throw new Error(
    `[feature-registry] Invariant violated: last entry must be "${MAIN_BUNDLE_NAME}" (main bundle). `
      + `Feature bundles register window globals that the main bundle's feature-loader consumes — `
      + `reordering breaks storefront initialization.`
  )
}

/** Filter the registry down to the ordered list of bundles applicable in the given context. */
export function selectFeatures(ctx: FeatureContext): FeatureDecl[] {
  return FEATURE_REGISTRY.filter(f => f.when(ctx))
}
