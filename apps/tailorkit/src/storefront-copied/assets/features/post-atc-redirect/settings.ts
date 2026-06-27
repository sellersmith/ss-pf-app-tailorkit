/**
 * Reads post-add-to-cart redirect settings from the customizer's
 * data-app-settings attribute. Controls whether buyers go straight to
 * `/checkout` after a successful add-to-cart instead of the cart page.
 */

export interface PostAtcRedirectSettings {
  enabled: boolean
}

export function getPostAtcRedirectSettings(): PostAtcRedirectSettings {
  try {
    const customizer = document.querySelector('tailorkit-product-personalizer-customizer')
    const appSettingsAttr = customizer?.getAttribute('data-app-settings')

    if (appSettingsAttr) {
      const appSettings = JSON.parse(appSettingsAttr)
      if (appSettings && typeof appSettings === 'object') {
        return {
          enabled: appSettings.redirectToCheckoutAfterAtc?.enabled ?? false,
        }
      }
    }
  } catch (error) {
    console.warn('[TailorKit] Error parsing post-ATC redirect settings:', error)
  }

  return { enabled: false }
}
