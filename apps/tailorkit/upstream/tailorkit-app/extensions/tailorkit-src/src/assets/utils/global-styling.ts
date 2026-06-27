import { applyAllGlobalStylingVariables, type GlobalStylingInput } from '../../shared/utils/global-styling-variables'

export type TailorKitGlobalStyling = GlobalStylingInput

const GLOBAL_STYLING_ELEMENT_ID = 'tailorkit-global-styling'

const parseGlobalStyling = (): TailorKitGlobalStyling | null => {
  const node = document.getElementById(GLOBAL_STYLING_ELEMENT_ID)
  if (!node) return null

  try {
    return JSON.parse(node.textContent || '{}') as TailorKitGlobalStyling
  } catch (error) {
    console.error('[TailorKit] Failed to parse global styling JSON', error)
    return null
  }
}

/**
 * Apply global styling CSS variables from the embedded JSON script tag
 * Used on the storefront to apply merchant-configured styling
 */
export const applyGlobalStylingVariables = () => {
  const styling = parseGlobalStyling()
  const rootStyle = document.documentElement?.style
  if (!styling || !rootStyle) return

  const setVar = (name: string, value: string) => {
    rootStyle.setProperty(name, value)
  }

  // Apply all styling variables using shared utility
  applyAllGlobalStylingVariables(styling, setVar)
}
