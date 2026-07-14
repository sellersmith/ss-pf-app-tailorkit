import { FontLoader } from '../../assets/utils/font-loader'

/**
 * Shared storefront font loader singleton.
 *
 * IMPORTANT: this lives in its own leaf module (it only depends on FontLoader)
 * to break a circular dependency with `registerOptionSetElements`. The cycle —
 * components/index.ts → registerOptionSetElements (auto-runs at import) →
 * FontOptionSet → FontDropdownElement/FontSwatchElement → back to
 * components/index.ts — caused a Temporal Dead Zone ReferenceError.
 *
 * When the inline customizer injects option-set markup into the DOM *before*
 * its bundle script runs, `customElements.define()` synchronously upgrades the
 * already-present elements. Their `connectedCallback → renderOptionSet()` then
 * reads `fontStorefrontLoader` while the `const` in components/index.ts is still
 * in its TDZ (the index module body executes after its dependencies). The throw
 * lands right after `container.innerHTML = ''`, silently aborting the render and
 * leaving font dropdowns/swatches blank.
 *
 * Importing the singleton from this leaf module guarantees it is fully
 * initialised before any option-set element is defined or upgraded.
 */
export const fontStorefrontLoader = new FontLoader()
