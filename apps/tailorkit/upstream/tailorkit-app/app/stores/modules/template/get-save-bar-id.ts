import { SAVE_BAR_ID } from '~/constants/save-bar'
import { getTemplateEnvAdapter } from './env-adapter'
import { NavMenuItems } from '~/bootstrap/app-config'

/**
 * Get the correct SaveBar ID based on the current editor context.
 *
 * Checks the environment adapter first (for unified editor), then falls back
 * to pathname detection (for standalone template editor).
 *
 * @returns The appropriate SAVE_BAR_ID for the current context
 */
export function getSaveBarId(): SAVE_BAR_ID {
  try {
    // Check environment adapter first (unified editor context)
    const env = getTemplateEnvAdapter()
    if (env?.getMode() === 'unified') {
      return SAVE_BAR_ID.PERSONALIZED_PRODUCTS_SAVE_BAR
    }

    // Fallback to pathname detection for standalone template editor
    if (typeof window !== 'undefined') {
      const isInPersonalizedProducts = window.location.pathname.includes(NavMenuItems.PERSONALIZED_PRODUCTS)
      return isInPersonalizedProducts
        ? SAVE_BAR_ID.PERSONALIZED_PRODUCTS_SAVE_BAR
        : SAVE_BAR_ID.TEMPLATE_EDITOR_SAVE_BAR
    }
  } catch (error) {
    // Silent fail - return default
  }
  return SAVE_BAR_ID.TEMPLATE_EDITOR_SAVE_BAR
}
