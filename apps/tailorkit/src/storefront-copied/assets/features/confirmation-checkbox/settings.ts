/**
 * Confirmation Checkbox Settings Helper
 *
 * Reads confirmation checkbox settings from the app settings data attribute.
 * Used by product-personalizer to validate checkout.
 */

import { translate } from '../../libraries/translation'

export interface ConfirmationCheckboxSettings {
  enabled: boolean
  message: string
}

/**
 * Get confirmation checkbox settings from the customizer's data-app-settings attribute
 */
export function getConfirmationCheckboxSettings(): ConfirmationCheckboxSettings {
  const defaultMessage = translate(
    'confirmation-checkbox-message',
    "I've reviewed my personalization and ready to proceed"
  )

  try {
    const customizer = document.querySelector('tailorkit-product-personalizer-customizer')
    const appSettingsAttr = customizer?.getAttribute('data-app-settings')

    if (appSettingsAttr) {
      const appSettings = JSON.parse(appSettingsAttr)
      if (appSettings && typeof appSettings === 'object') {
        return {
          enabled: appSettings.confirmationCheckbox?.enabled ?? false,
          message: appSettings.confirmationCheckbox?.message || defaultMessage,
        }
      }
    }
  } catch (error) {
    console.warn('[TailorKit] Error parsing confirmation checkbox settings:', error)
  }

  return { enabled: false, message: defaultMessage }
}
