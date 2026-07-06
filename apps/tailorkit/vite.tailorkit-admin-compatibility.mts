import type { Plugin } from 'vite'

const PRODUCT_EDITOR_PARAMS_HOOK_SOURCE = '/upstream/tailorkit-app/app/modules/ProductEditor/hooks/useEditorParams.ts'
const TAILORKIT_EDITOR_ROUTE_PREDICATE = "window.location.pathname.startsWith('/personalized-products/')"
const PAGEFLY_HOSTED_EDITOR_ROUTE_PREDICATE =
  "(window.location.pathname.startsWith('/personalized-products/') || window.location.pathname.startsWith('/app-extensions/tailorkit/personalized-products/'))"

// Bug #6: Quick Setup (SimplifiedOnboarding 5-step wizard) is not ported to the PageFly island, so
// picking it silently falls into Full Editor (see product-personalizer-create-flow-navigation.ts).
// Decision for beta: hide the option instead of porting the wizard. Dropping it here (build-time
// transform of the bundled runtime output) keeps apps/tailorkit/upstream/** byte-for-byte identical.
const CREATE_FLOW_OPTIONS_SOURCE = '/upstream/tailorkit-app/app/components/CreateFlowDropdown/options.ts'
const QUICK_SETUP_OPTION_ENTRY = `  {
    flow: 'quick_setup',
    title: 'Quick Setup',
    subtitle: 'Guided 5-step wizard with realistic mockups',
    icon: ImageMagicIcon,
  },
`
const QUICK_SETUP_DEFAULT_FLOW = "export const DEFAULT_CREATE_FLOW: CreateFlow = 'quick_setup'"
const PAGEFLY_DEFAULT_FLOW = "export const DEFAULT_CREATE_FLOW: CreateFlow = 'full_editor'"

/**
 * Applies tiny runtime-only compatibility fixes to copied TailorKit admin source
 * while keeping `apps/tailorkit/upstream/**` byte-for-byte identical to upstream.
 */
export function createTailorKitAdminCompatibilityPlugin(): Plugin {
  return {
    name: 'pagefly-tailorkit-admin-compatibility',
    enforce: 'pre',
    transform(code, id) {
      if (id.includes(PRODUCT_EDITOR_PARAMS_HOOK_SOURCE)) {
        if (!code.includes(TAILORKIT_EDITOR_ROUTE_PREDICATE)) {
          this.error('TailorKit useEditorParams route predicate changed upstream; review PageFly compatibility transform.')
        }

        return {
          code: code.replace(TAILORKIT_EDITOR_ROUTE_PREDICATE, PAGEFLY_HOSTED_EDITOR_ROUTE_PREDICATE),
          map: null,
        }
      }

      if (id.includes(CREATE_FLOW_OPTIONS_SOURCE)) {
        if (!code.includes(QUICK_SETUP_OPTION_ENTRY) || !code.includes(QUICK_SETUP_DEFAULT_FLOW)) {
          this.error('TailorKit CreateFlowDropdown options changed upstream; review PageFly Quick Setup hide transform.')
        }

        return {
          code: code.replace(QUICK_SETUP_OPTION_ENTRY, '').replace(QUICK_SETUP_DEFAULT_FLOW, PAGEFLY_DEFAULT_FLOW),
          map: null,
        }
      }

      return null
    },
  }
}
