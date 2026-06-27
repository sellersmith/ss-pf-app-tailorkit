/**
 * Listens for `tailorkit-open-personalizer` events and opens the cross-product modal.
 * Singleton — safe to call multiple times.
 */

import { TAILORKIT_EVENTS } from '../../events'
import type { TailorKitOpenPersonalizerEventDetail } from '../../events'
import { openCrossProductPersonalizerModal } from './index'

let _listenerRegistered = false

export function registerCrossProductModalListener(): void {
  if (_listenerRegistered) return
  _listenerRegistered = true

  document.addEventListener(TAILORKIT_EVENTS.OPEN_PERSONALIZER, (event: Event) => {
    const customEvent = event as CustomEvent<TailorKitOpenPersonalizerEventDetail>
    const detail = customEvent.detail

    if (!detail) {
      console.warn('[TailorKit] tailorkit-open-personalizer event fired without detail — ignoring')
      return
    }

    const { requestId, productHandle, productId, variantId, productTitle } = detail

    if (!requestId || !productHandle || !productId || !variantId) {
      console.warn('[TailorKit] tailorkit-open-personalizer: missing required fields — ignoring', detail)
      return
    }

    openCrossProductPersonalizerModal({
      requestId,
      productHandle,
      productId,
      variantId,
      productTitle,
    })
  })
}
