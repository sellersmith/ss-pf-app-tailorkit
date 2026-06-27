import type { GlobalStyling } from '~/types/global-styling'
import { applyAllGlobalStylingVariables } from 'extensions/tailorkit-src/src/shared/utils/global-styling-variables'

/**
 * Apply global styling CSS variables to the document root
 * Used for live preview in the styling editor
 */
export function applyGlobalStylingToContainer(styling: GlobalStyling, root: HTMLElement | null): void {
  if (!root) return

  const docRoot = document.documentElement

  const setVar = (name: string, value: string) => {
    if (docRoot.style.getPropertyValue(name) !== value) {
      docRoot.style.setProperty(name, value)
    }
  }

  // Apply all styling variables using shared utility
  applyAllGlobalStylingVariables(styling, setVar)
}
