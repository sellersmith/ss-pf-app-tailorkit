// App-metafield namespaces/keys the copied TailorKit storefront Liquid reads. These mirror the
// original emtailorkit app (legacy `em_*` namespace) because the storefront Liquid was copied
// near-whole; the backend writers must target the SAME namespace the Liquid reads, not the
// app-platform default `<appId>_*` convention. See storefront-snapshot-publisher (variant data),
// preferences-api (global styling), and runtime-contract (token namespace override).

/** Variant-level personalization snapshots: `app.metafields.em_tailorkit[<shopifyVariantId>]`. */
export const TAILORKIT_STOREFRONT_METAFIELD_NAMESPACE = 'em_tailorkit'

/** Shop-wide personalizer styling: `app.metafields.em_tailorkit.global_styling`. */
export const TAILORKIT_GLOBAL_STYLING_METAFIELD = {
  namespace: TAILORKIT_STOREFRONT_METAFIELD_NAMESPACE,
  key: 'global_styling',
} as const

/**
 * Shop-wide storefront settings (modal/zoom/confirmation/redirect/colour-guide/emoji). The copied
 * storefront Liquid reads `app.metafields.em_tailorkit.app_settings.value` (customizer.liquid), so the
 * Storefront-tab `UPDATE_APP_METAFIELDS` save must mirror its `appMetafields` blob to this exact key.
 */
export const TAILORKIT_APP_SETTINGS_METAFIELD = {
  namespace: TAILORKIT_STOREFRONT_METAFIELD_NAMESPACE,
  key: 'app_settings',
} as const

/** Storefront API token namespace read by app-embed Liquid: `app.metafields.em_storefront.*`. */
export const TAILORKIT_STOREFRONT_ACCESS_TOKEN_NAMESPACE = 'em_storefront'
