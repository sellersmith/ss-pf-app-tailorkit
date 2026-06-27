import { registerTailorKitCustomizerElement } from './customizer-element'
import { initializeTailorKitCartSync } from './cart-change-observer'
import { installTailorKitHiddenPricingFetchInterceptor } from './hidden-pricing-fetch-interceptor'
import { installTailorKitHiddenPricingNativeSubmit } from './hidden-pricing-native-submit'
import { loadTailorKitKonva, readTailorKitStorefrontConfig } from './konva-loader'
import type { TailorKitKonvaGlobal } from './konva-loader'
import { registerOptionListElements } from './option-list-elements'
import { registerTailorKitProductPersonalizerElement } from './personalizer-element'
import { registerTextCustomerElements } from './text-customer-input'
import { registerTailorKitViewsBarElement } from './views-bar-element'

declare global {
  interface Window {
    TailorKitStorefront?: {
      loadKonva(): Promise<TailorKitKonvaGlobal>
    }
  }
}

/** Registers every TailorKit storefront web component owned by the PageFly app platform. */
export function registerTailorKitStorefrontElements() {
  registerTailorKitProductPersonalizerElement()
  registerTextCustomerElements()
  registerOptionListElements()
  registerTailorKitViewsBarElement()
  registerTailorKitCustomizerElement()
  initializeTailorKitCartSync()
  installTailorKitHiddenPricingNativeSubmit()
  installTailorKitHiddenPricingFetchInterceptor()

  window.TailorKitStorefront = {
    loadKonva: loadTailorKitKonva,
  }
}

registerTailorKitStorefrontElements()

console.info('[TailorKit][PageFly] storefront asset loaded', {
  marker: 'pagefly-tailorkit-runtime-20260614-inner-personalizer',
  konvaMode: readTailorKitStorefrontConfig().konva?.mode || 'cdn-lazy',
})
