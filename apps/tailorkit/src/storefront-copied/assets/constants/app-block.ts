// Copied from TailorKit upstream; type sourced locally instead of backend app/routes for storefront isolation.
import type { AppBlockInstallationSettings } from '../types/app-block-installation'

/**
 * Default app block installation settings.
 *
 * This is the default settings for the app block installation.
 * It is used to initialize the app block installation.
 * And sync with settings in `blocks/customizer.liquid`.
 *
 * @see {@link AppBlockInstallationSettings}
 * @see {@link blocks/customizer.liquid}
 */
export const DEFAULT_APP_BLOCK_INSTALLATION_SETTINGS: AppBlockInstallationSettings = {
  personalized_design_title: 'PERSONALIZED DESIGN',
  featured_image_container_selector: '.product__media-item.is-active .product__media',
  featured_image_position: 1,
  auto_navigate_on_focus: false,
  always_render_live_preview: true,
  layout_type: 'customizer',
}
