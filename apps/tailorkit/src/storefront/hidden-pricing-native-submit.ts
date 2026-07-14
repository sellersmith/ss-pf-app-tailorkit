import {
  type TailorKitHiddenPricingFetcher,
  type TailorKitHiddenPricingProduct,
  buildTailorKitHiddenPricingCartItem,
  createTailorKitHiddenPricingProductCache,
} from './hidden-pricing-product'
import { claimPricingFire } from './pricing-claim'

interface TailorKitFormInputLike {
  name: string
  value: string
}

export interface TailorKitHiddenPricingFormContext {
  additionalCost: number
  mainProductQuantity: number
  productName: string
  propertyPrefix: string
  refId: string
}

export interface TailorKitHiddenPricingNativeSubmitOptions {
  fetcher?: (url: string, init?: any) => Promise<{ ok: boolean; status: number; statusText?: string; json: () => Promise<unknown> }>
  hiddenPricingProduct?: TailorKitHiddenPricingProduct | null
  productCache?: ReturnType<typeof createTailorKitHiddenPricingProductCache>
}

export type TailorKitHiddenPricingSubmitResult =
  | { submitted: true; reason: 'submitted' }
  | { submitted: false; reason: 'invalid-context' | 'missing-hidden-product' | 'empty-cart-item' | 'request-failed' }

declare global {
  interface Window {
    __tailorkitHiddenPricingNativeSubmitInstalled?: boolean
  }
}

function defaultFetcher(): TailorKitHiddenPricingNativeSubmitOptions['fetcher'] {
  if (typeof globalThis.fetch !== 'function') {
    throw new Error('[TailorKit] Hidden pricing native submit requires a fetch implementation.')
  }

  return globalThis.fetch as TailorKitHiddenPricingNativeSubmitOptions['fetcher']
}

function matchPropertyPrefix(name: string, suffix: string) {
  return name.match(new RegExp(`^properties\\[(.+?)${suffix}\\]$`))?.[1] || ''
}

function valueByName(inputs: TailorKitFormInputLike[], name: string) {
  return inputs.find(input => input.name === name)?.value || ''
}

function valueBySuffix(inputs: TailorKitFormInputLike[], suffix: string) {
  return inputs.find(input => input.name.endsWith(`${suffix}]`))?.value || ''
}

/** Extracts hidden pricing submit context from TailorKit add-to-cart form inputs. */
export function extractTailorKitHiddenPricingFormContext(
  inputs: TailorKitFormInputLike[]
): TailorKitHiddenPricingFormContext | null {
  const costInput = inputs.find(input => input.name.includes('_Total_Additional_Cost]'))
  const additionalCost = Number.parseFloat(costInput?.value || '0')
  if (!Number.isFinite(additionalCost) || additionalCost <= 0) return null

  const propertyPrefix =
    (costInput ? matchPropertyPrefix(costInput.name, '_Total_Additional_Cost') : '')
    || matchPropertyPrefix(inputs.find(input => input.name.includes('_ref_id]'))?.name || '', '_ref_id')
    || '__pf_tailorkit'
  const mainProductQuantity = Number.parseInt(valueByName(inputs, 'quantity') || '1', 10) || 1

  return {
    additionalCost,
    mainProductQuantity,
    productName: valueBySuffix(inputs, '_product_name') || 'TailorKit personalized product',
    propertyPrefix,
    refId: valueBySuffix(inputs, '_ref_id'),
  }
}

async function resolveHiddenPricingProduct(options: TailorKitHiddenPricingNativeSubmitOptions) {
  if (options.hiddenPricingProduct !== undefined) return options.hiddenPricingProduct

  const cache =
    options.productCache
    || createTailorKitHiddenPricingProductCache({ fetcher: options.fetcher as TailorKitHiddenPricingFetcher })
  return cache.get()
}

export async function submitTailorKitHiddenPricingProductFromContext(
  context: TailorKitHiddenPricingFormContext | null,
  options: TailorKitHiddenPricingNativeSubmitOptions = {}
): Promise<TailorKitHiddenPricingSubmitResult> {
  if (!context || !context.refId) return { submitted: false, reason: 'invalid-context' }

  const hiddenProduct = await resolveHiddenPricingProduct(options)
  if (!hiddenProduct) return { submitted: false, reason: 'missing-hidden-product' }

  const item = buildTailorKitHiddenPricingCartItem({
    hiddenProduct,
    additionalCost: context.additionalCost,
    mainProductQuantity: context.mainProductQuantity,
    productName: context.productName,
    propertyPrefix: context.propertyPrefix,
    refId: context.refId,
  })
  if (!item) return { submitted: false, reason: 'empty-cart-item' }

  const fetcher = options.fetcher || defaultFetcher()
  const response = await fetcher('/cart/add.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-TailorKit-Internal': '1' },
    body: JSON.stringify({ items: [item] }),
    keepalive: true,
  })

  return response.ok ? { submitted: true, reason: 'submitted' } : { submitted: false, reason: 'request-failed' }
}

function formInputs(form: HTMLFormElement): TailorKitFormInputLike[] {
  return Array.from(form.querySelectorAll<HTMLInputElement>('input')).map(input => ({
    name: input.name,
    value: input.value,
  }))
}

/** Installs TailorKit's native POST hidden pricing submit handler for non-AJAX themes. */
export function installTailorKitHiddenPricingNativeSubmit() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return
  if (window.__tailorkitHiddenPricingNativeSubmitInstalled) return
  window.__tailorkitHiddenPricingNativeSubmitInstalled = true

  document.addEventListener(
    'submit',
    event => {
      const form = event.target as HTMLFormElement | null
      if (!form?.action?.includes('/cart/add')) return

      const context = extractTailorKitHiddenPricingFormContext(formInputs(form))
      if (!context) return

      // Claim before submitting, not gated on event.defaultPrevented — themes
      // using XHR (not fetch) also call preventDefault() to stop page
      // navigation, so defaultPrevented alone can't tell "the fetch
      // interceptor will handle this" apart from "nothing will". See
      // pricing-claim.ts for the full reasoning and how this coordinates with
      // storefront-copied's separate (upstream-mirrored) interceptor pair.
      if (!claimPricingFire(form)) return

      submitTailorKitHiddenPricingProductFromContext(context).catch(error =>
        console.error('[TailorKit] Hidden pricing native submit failed:', error)
      )
    },
    false
  )
}
