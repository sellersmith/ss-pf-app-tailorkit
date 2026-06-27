/**
 * Pinch-Zoom Settings Helper
 *
 * Reads zoom settings from the app settings data attribute.
 * Used by product-personalizer to configure zoom behavior.
 */

export interface ZoomSettings {
  enabled: boolean
  showIndicator: boolean
}

/**
 * Get zoom settings from the customizer's data-app-settings attribute
 */
export function getZoomSettings(): ZoomSettings {
  try {
    const customizer = document.querySelector('tailorkit-product-personalizer-customizer')
    const appSettingsAttr = customizer?.getAttribute('data-app-settings')

    if (appSettingsAttr) {
      const appSettings = JSON.parse(appSettingsAttr)
      return {
        enabled: appSettings.previewZoom?.enabled ?? true,
        showIndicator: appSettings.previewZoom?.showIndicator ?? false,
      }
    }
  } catch (error) {
    console.warn('[TailorKit] Error parsing zoom settings:', error)
  }

  return { enabled: true, showIndicator: false }
}
