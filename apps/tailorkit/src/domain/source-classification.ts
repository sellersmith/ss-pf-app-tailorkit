export type TailorKitPageFlySourceClassification =
  | 'active-host'
  | 'active-runtime-adapter'
  | 'backend-port-adapter'
  | 'domain-contract'
  | 'provisional-domain-adapter'
  | 'dormant-admin-adapter'
  | 'source-policy'
  | 'quarantined-rewrite'

export interface TailorKitPageFlySourceFile {
  file: string
  classification: TailorKitPageFlySourceClassification
  notes: string
}

/** PageFly-authored TailorKit files must be classified before any copied TailorKit runtime can be enabled. */
export const tailorkitPageFlySourceFiles = [
  {
    file: 'apps/tailorkit/manifest.ts',
    classification: 'active-host',
    notes: 'App manifest only; must not imply ProductEditor parity.',
  },
  {
    file: 'apps/tailorkit/src/index.ts',
    classification: 'active-host',
    notes: 'Package entry only; must not own ProductEditor behavior.',
  },
  {
    file: 'apps/tailorkit/src/admin/index.tsx',
    classification: 'active-host',
    notes: 'Active admin shell; copied TailorKit routes own real admin behavior.',
  },
  {
    file: 'apps/tailorkit/src/admin/route-host-inspection.ts',
    classification: 'active-host',
    notes: 'Pure route-host inspection for copied TailorKit routes; must not import route modules directly.',
  },
  {
    file: 'apps/tailorkit/src/admin/copied-routes/host.tsx',
    classification: 'active-host',
    notes: 'Active copied-route host; PageFly wraps TailorKit route modules without rewriting their UI.',
  },
  {
    file: 'apps/tailorkit/src/admin/nav-shell.tsx',
    classification: 'active-host',
    notes: 'Persistent PageFly admin sidebar replacing the app-bridge NavMenu; navigates via host ports only.',
  },
  {
    file: 'apps/tailorkit/src/admin/copied-routes/runtime-loader.ts',
    classification: 'active-host',
    notes: 'Active copied-route runtime loader; imports only manifest/assets, not copied TailorKit route modules.',
  },
  {
    file: 'apps/tailorkit/src/admin/copied-routes/runtime-entry.ts',
    classification: 'active-runtime-adapter',
    notes: 'Active copied-route runtime entry; imports copied TailorKit route modules inside the per-app admin bundle.',
  },
  {
    file: 'apps/tailorkit/src/admin/copied-routes/storefront-setup-shell.tsx',
    classification: 'active-runtime-adapter',
    notes: 'Single-shell for Sales Tools; owns the tab layout and imports the verbatim TailorKit tab bodies + styling sub-view in the admin bundle.',
  },
  {
    file: 'apps/tailorkit/src/admin/copied-routes/storefront-setup-styling-view.tsx',
    classification: 'active-runtime-adapter',
    notes: 'PageFly styling sub-view for /storefront-setup/styling; grafts the upstream styling page minus its server loader, reading/writing via the bridged GET/UPDATE_GLOBAL_STYLING preference actions.',
  },
  {
    file: 'apps/tailorkit/src/admin/copied-routes/tailorkit-copied-route-i18n.ts',
    classification: 'active-runtime-adapter',
    notes: 'Loads TailorKit locale resources for copied route modules inside the per-app admin bundle.',
  },
  {
    file: 'apps/tailorkit/src/admin/copied-routes/runtime-loading.tsx',
    classification: 'active-runtime-adapter',
    notes: 'Shared Polaris loading state for the copied-route host and runtime fallback.',
  },
  {
    file: 'apps/tailorkit/src/backend/plugin.ts',
    classification: 'active-host',
    notes: 'Registers app-platform API adapters, not TailorKit model services.',
  },
  ...[
    'ai-prompt-helper-api.ts',
    'app-settings-repository.ts',
    'global-styling-repository.ts',
    'preferences-api.ts',
    'product-personalizer-api.ts',
    'product-personalizer-repository.ts',
    'order-capture-graft.ts',
    'order-capture-shim.ts',
    'order-repository.ts',
    'order-webhook-intent.ts',
    'orders-list-api.ts',
    'storefront-setup-api.ts',
    'status-api.ts',
    'storefront-metafield-keys.ts',
    'storefront-prepare-bridge.ts',
    'storefront-proxy-action-parsers.ts',
    'storefront-proxy-api.ts',
    'storefront-runtime-contract.ts',
    'storefront-snapshot-publisher.ts',
    'storefront-styling-publisher.ts',
    'theme-config-api.ts',
  ].map(file => ({
    file: `apps/tailorkit/src/backend/${file}`,
    classification: 'backend-port-adapter' as const,
    notes: 'PageFly app-platform adapter; not proof of copied TailorKit route parity.',
  })),
  ...[
    'capabilities.ts',
    'copied-route-id.ts',
    'migration-boundary.ts',
    'orders-admin-route-host-contract.ts',
    'orders-copied-route-module-manifest.ts',
    'orders-list-adapter.ts',
    'product-personalizer-copied-route-host-gate.ts',
    'product-editor-adapter-contract.ts',
    'product-editor-loader-adapter.ts',
    'product-personalizer-admin-route-host-contract.ts',
    'product-personalizer-api-route-bridge-resolver.ts',
    'product-personalizer-authenticated-fetch-bridge-contract.ts',
    'product-personalizer-copied-route-client-loader-args.ts',
    'product-personalizer-copied-route-execution-plan.ts',
    'product-personalizer-compatibility-contract.ts',
    'product-personalizer-copied-route-module-manifest.ts',
    'product-personalizer-copied-route-request-bridge.ts',
    'product-personalizer-copied-route-stylesheet-loader.ts',
    'product-personalizer-copied-route-vite-assets.ts',
    'product-personalizer-create-flow-navigation.ts',
    'product-personalizer-route-host-readiness.ts',
    'product-personalizer-route-scope.ts',
    'storefront-setup-admin-route-host-contract.ts',
    'storefront-setup-copied-route-module-manifest.ts',
    'personalized-product-taste-guard.ts',
    'order-record.ts',
    'order-property-matchers.ts',
    'source-classification.ts',
    'upstream-mirror-contract.ts',
    'vite-manifest-assets.ts',
  ].map(file => ({
    file: `apps/tailorkit/src/domain/${file}`,
    classification: 'domain-contract' as const,
    notes: 'Boundary contract or pure mapper for app-platform compatibility.',
  })),
  ...[
    'product-editor-populate.ts',
    'product-editor-save-payload-mappers.ts',
    'product-editor-save-payload-utils.ts',
    'product-editor-save-payload.ts',
    'product-editor-state.ts',
    'product-personalizer-integration-action-request.ts',
    'product-personalizer-template-action-request.ts',
    'product-personalizer-list-adapter.ts',
    'product-personalizer-record.ts',
    'product-personalizer.ts',
  ].map(file => ({
    file: `apps/tailorkit/src/domain/${file}`,
    classification: 'provisional-domain-adapter' as const,
    notes:
      'Provisional PageFly data adapter only; not Product Personalizer parity and must be replaced or source-mapped before runtime activation.',
  })),
  ...[
    'admin-mutation-error.ts',
    'api.ts',
    'product-editor-loading.tsx',
  ].map(file => ({
    file: `apps/tailorkit/src/admin/${file}`,
    classification: 'dormant-admin-adapter' as const,
    notes: 'Separate runtime asset or dormant admin adapter; active shell must not import old ProductEditor island hosts.',
  })),
  ...[
    'pagefly-app-handle-fallback.ts',
    'pagefly-authenticated-fetch-shim.ts',
    'pagefly-background-removal-initializer-shim.tsx',
    'pagefly-chatbot-context-shim.tsx',
    'pagefly-contextual-save-bar-shim.tsx',
    'pagefly-feedback-shim.ts',
    'pagefly-interactive-chat-shim.tsx',
    'pagefly-live-chat-shim.ts',
    'pagefly-navigate-app-bridge.ts',
    'pagefly-navigate-app-bridge-shim.tsx',
    'pagefly-product-editor-loader-context.tsx',
    'pagefly-remix-react-shim.tsx',
    'pagefly-root-shim.ts',
    'pagefly-route-behavior-shim.tsx',
    'pagefly-shopify-shim.ts',
    'pagefly-toast-events-shim.ts',
    'pagefly-image-upload-bridge.ts',
  ].map(file => ({
    file: `apps/tailorkit/src/admin/product-editor-island/${file}`,
    classification: 'active-runtime-adapter' as const,
    notes:
      'PageFly adapter used by the active copied-route admin runtime or its Vite aliases; it is not standalone ProductEditor behavior.',
  })),
  {
    file: 'apps/tailorkit/src/admin/product-editor-host.tsx',
    classification: 'quarantined-rewrite',
    notes: 'Deprecated self-coded host kept only as temporary reference.',
  },
  {
    file: 'apps/tailorkit/vite.product-editor-island.config.mts',
    classification: 'source-policy',
    notes: 'Build probe for copied ProductEditor island.',
  },
  {
    file: 'apps/tailorkit/vite.copied-routes.config.mts',
    classification: 'source-policy',
    notes: 'Build config for copied TailorKit admin routes; active host must not import it directly.',
  },
  {
    file: 'apps/tailorkit/vite.tailorkit-admin-aliases.mts',
    classification: 'source-policy',
    notes: 'Shared admin build aliases for copied TailorKit bundles and PageFly host shims.',
  },
  {
    file: 'apps/tailorkit/vite.tailorkit-admin-compatibility.mts',
    classification: 'source-policy',
    notes: 'Compatibility build plugin for copied TailorKit admin source; must not become runtime behavior.',
  },
  {
    file: 'apps/tailorkit/theme-extension/theme-surfaces.ts',
    classification: 'source-policy',
    notes: 'App-owned theme surface metadata; Liquid/CSS sources mirrored and materialized into the PageFly deploy shell.',
  },
] as const satisfies readonly TailorKitPageFlySourceFile[]

export const tailorkitQuarantinedRewriteRoots = [
  'apps/tailorkit/src/storefront',
] as const

export const tailorkitQuarantinedRewriteFiles = [
  'apps/tailorkit/theme-extension/assets/tailorkit.css',
  'apps/tailorkit/theme-extension/blocks/app-embed.liquid',
  'apps/tailorkit/theme-extension/blocks/customizer.liquid',
  'apps/tailorkit/theme-extension/snippets/icons.liquid',
  'apps/tailorkit/theme-extension/snippets/placeholder.liquid',
  'apps/tailorkit/theme-extension/snippets/print-areas.liquid',
  'apps/tailorkit/theme-extension/snippets/tlk-render-layer.liquid',
] as const
