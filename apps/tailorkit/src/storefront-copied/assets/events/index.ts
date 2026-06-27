/**
 * TailorKit Public Events — inter-app communication via CustomEvents.
 *
 * @example
 * document.addEventListener('tailorkit-prepare-cart-data', (event) => {
 *   const { formData, variantId } = event.detail
 *   formData.append('your_custom_field', 'value')
 * })
 */

export const TAILORKIT_EVENTS = {
  /** Dispatched before cart submission — allows apps to inject data into formData */
  PREPARE_CART_DATA: 'tailorkit-prepare-cart-data',
  /** Dispatched to open the cross-product personalizer modal */
  OPEN_PERSONALIZER: 'tailorkit-open-personalizer',
  /** Dispatched when buyer clicks "Done" in the cross-product personalizer modal */
  PERSONALIZER_COMPLETE: 'tailorkit-personalizer-complete',
  /** Dispatched when buyer cancels or closes the cross-product personalizer modal */
  PERSONALIZER_CANCELLED: 'tailorkit-personalizer-cancelled',
} as const

export const TAILORKIT_EVENTS_INSTRUCTIONS: Record<keyof typeof TAILORKIT_EVENTS, string> = {
  PREPARE_CART_DATA: `- Dispatched before Buy It Now cart submission
    - Detail: { formData: FormData, variantId: string }`,
  OPEN_PERSONALIZER: `- Dispatch to open the cross-product personalizer modal
    - Detail: { requestId: string, productHandle: string, productId: string, variantId: string, productTitle?: string }`,
  PERSONALIZER_COMPLETE: `- Dispatched when buyer clicks "Done" in modal
    - Detail: { requestId: string, properties: Record<string, string> }`,
  PERSONALIZER_CANCELLED: `- Dispatched when buyer cancels or closes modal
    - Detail: { requestId: string }`,
}

export interface TailorKitPrepareCartEventDetail {
  formData: FormData
  variantId: string
}

/**
 * @example
 * document.dispatchEvent(new CustomEvent(TAILORKIT_EVENTS.OPEN_PERSONALIZER, {
 *   detail: { requestId: 'upsell-abc123', productHandle: 'my-product', productId: '987', variantId: '123' }
 * }))
 */
export interface TailorKitOpenPersonalizerEventDetail {
  requestId: string
  productHandle: string
  productId: string
  variantId: string
  productTitle?: string
}

export interface TailorKitPersonalizerCompleteEventDetail {
  requestId: string
  /** Keys match Shopify cart property names (without `properties[...]` wrapper). */
  properties: Record<string, string>
}

export interface TailorKitPersonalizerCancelledEventDetail {
  requestId: string
}

export function dispatchTailorKitEvent<T>(eventName: string, detail: T): void {
  const event = new CustomEvent<T>(eventName, { detail })
  document.dispatchEvent(event)

  if (typeof window !== 'undefined' && (window as any).__tailorkit__?.debugMode) {
    console.log(`[TailorKit Event] ${eventName}`, detail)
  }
}

export function logAvailableEvents(): void {
  console.log(
    '%c TailorKit Events API %c',
    'background:#6366f1;padding:2px 6px;border-radius:3px;color:#fff;font-weight:bold',
    'background:transparent'
  )
  console.log(`%cAvailable events for inter-app communication:`, 'color:#6366f1;font-weight:bold')
  console.log(TAILORKIT_EVENTS_INSTRUCTIONS)
}
