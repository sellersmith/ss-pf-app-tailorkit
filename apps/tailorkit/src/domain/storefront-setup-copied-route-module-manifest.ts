// Storefront-setup (Sales Tools) copied-route module manifest — the storefront-setup-family counterpart to
// the PP + Orders module manifests. The backbone manifest lookup composes PP ∪ orders ∪ storefront-setup.
//
// SINGLE-SHELL: unlike PP/Orders (which load a verbatim upstream route module), the loaded module here is a
// PageFly-owned shell (`storefront-setup-shell.tsx`) that replicates the parent layout and pathname-switches
// the 3 verbatim tab bodies. `modulePath` therefore points at the shell, not the upstream mirror.
// `supportSources` lists the verbatim upstream pieces the shell imports, for parity tracking.
import type { TailorKitCopiedRouteModuleManifestEntry } from './product-personalizer-copied-route-module-manifest'
import { tailorkitStorefrontSetupAdminRouteHostDecisions } from './storefront-setup-admin-route-host-contract'

const STOREFRONT_SETUP_MIRROR_ROOT = 'apps/tailorkit/upstream/tailorkit-app'
const STOREFRONT_SETUP_SHELL_MODULE = 'apps/tailorkit/src/admin/copied-routes/storefront-setup-shell.tsx'

/** Verbatim upstream pieces the shell composes (parity tracking; the shell is the actual loaded module). */
const storefrontSetupSupportSources: readonly string[] = [
  'app/routes/storefront-setup/components/SaleToolsTabNavigation.tsx',
  'app/routes/storefront-setup/contexts/SaleToolsSaveBarContext.tsx',
  // Storefront tab + cards
  'app/routes/storefront-setup.storefront/route.tsx',
  'app/routes/storefront-setup.storefront/components/StorefrontStylingCard.tsx',
  'app/routes/storefront-setup.storefront/components/PreviewModalCard.tsx',
  'app/routes/storefront-setup.storefront/components/ProductPreviewInCartCard.tsx',
  'app/routes/storefront-setup.storefront/components/PreviewZoomCard.tsx',
  'app/routes/storefront-setup.storefront/components/ConfirmationCheckboxCard.tsx',
  'app/routes/storefront-setup.storefront/components/RedirectToCheckoutCard.tsx',
  'app/routes/storefront-setup.storefront/components/ColourGuideCard.tsx',
  'app/routes/storefront-setup.storefront/components/EmojiPickerCard.tsx',
  // ProductPreviewInCartCard's app-embed activator fires ENSURE_PRICING_PRODUCT (option-pricing) on mount.
  'app/components/InstallAppEmbedActivator.tsx',
  // AI Tools tab + card
  'app/routes/storefront-setup.ai-tools/route.tsx',
  'app/routes/storefront-setup.ai-tools/components/AIPersonalizationCard.tsx',
  // Personalization box styling full-page sub-view (StorefrontStylingCard "Customize box styling" target).
  // The PageFly styling view grafts this verbatim editor tree minus the upstream server-loader route module.
  'app/components/GlobalStyling/GlobalStylingEditor.client.tsx',
  'app/components/GlobalStyling/hooks/useGlobalStylingHistory.ts',
]
// Upsell tab (`storefront-setup.sales/*`) intentionally dropped — it is OneTick, a separate product.

const storefrontSetupAuthenticatedFetchSurfaces: readonly string[] = [
  'POST /api/preferences (UPDATE_APP_METAFIELDS)',
  'POST /api/preferences (GET_GLOBAL_STYLING / UPDATE_GLOBAL_STYLING — styling sub-view)',
  'GET /api/preferences?themeConfig=true (useAppConfig)',
  'POST /api/colour-guide/upload (FormData)',
  'POST /api/emoji-picker/apply-to-all',
  'POST /api/option-pricing (ENSURE_PRICING_PRODUCT)',
]

export const tailorkitStorefrontSetupCopiedRouteModuleManifest =
  tailorkitStorefrontSetupAdminRouteHostDecisions.map<TailorKitCopiedRouteModuleManifestEntry>(decision => ({
    routeId: decision.routeId,
    runtimeStatus: 'runtime-hosted-via-copied-route-bundle',
    upstreamSource: decision.upstreamSource,
    mirrorRoot: STOREFRONT_SETUP_MIRROR_ROOT,
    modulePath: STOREFRONT_SETUP_SHELL_MODULE,
    tailorkitPathPattern: decision.tailorkitPathPattern,
    pageflyPathPatterns: decision.pageflyPathPatterns,
    requiredExports: decision.requiredExports,
    supportSources: storefrontSetupSupportSources,
    authenticatedFetchSurfaces: storefrontSetupAuthenticatedFetchSurfaces,
    stylesheetLinks: [],
    notes: 'PageFly hosts Sales Tools through a single shell that owns the tab layout + the 3 verbatim tab bodies.',
  }))
