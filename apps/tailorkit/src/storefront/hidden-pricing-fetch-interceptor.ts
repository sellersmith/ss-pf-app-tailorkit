import {
  type TailorKitHiddenPricingNativeSubmitOptions,
  type TailorKitHiddenPricingSubmitResult,
  submitTailorKitHiddenPricingProductFromContext,
} from './hidden-pricing-native-submit'
import {
  type TailorKitInputPair,
  extractTailorKitHiddenPricingContextFromCartAddBody,
  injectTailorKitDomInputsIntoCartAddBody,
  variantIdFromCartAddBody,
} from './hidden-pricing-cart-add-body'

export {
  extractTailorKitHiddenPricingContextFromCartAddBody,
  injectTailorKitDomInputsIntoCartAddBody,
} from './hidden-pricing-cart-add-body'

interface TailorKitFetchInitLike {
  headers?: Headers | Record<string, string>
  body?: unknown
}

type TailorKitFetchInputLike = RequestInfo | URL | string

export type TailorKitHiddenPricingFetchInterceptorResult =
  | TailorKitHiddenPricingSubmitResult
  | { submitted: false; reason: 'skipped' | 'missing-context' }

declare global {
  interface Window {
    __tailorkitHiddenPricingFetchInterceptorInstalled?: boolean
  }
}

function inputUrl(input: TailorKitFetchInputLike): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return (input as Request).url || ''
}

export function isTailorKitCartAddFetch(input: TailorKitFetchInputLike): boolean {
  return /\/cart\/add(\.js|\.json)?(\?|$)/.test(inputUrl(input))
}

function headerValue(headers: TailorKitFetchInitLike['headers'], key: string) {
  if (!headers) return ''
  if (typeof Headers !== 'undefined' && headers instanceof Headers) return headers.get(key) || ''

  const record = headers as Record<string, string>
  return record[key] || record[key.toLowerCase()] || ''
}

export function readTailorKitHiddenPricingInputsFromDom(variantId?: string | number): TailorKitInputPair[] {
  if (typeof document === 'undefined') return []

  const forms = document.querySelectorAll<HTMLFormElement>('form[action*="/cart/add"]')
  for (const form of Array.from(forms)) {
    const idInput = form.querySelector<HTMLInputElement>('input[name="id"]')
    if (variantId !== undefined && idInput?.value && idInput.value !== String(variantId)) continue

    const inputs = Array.from(form.querySelectorAll<HTMLInputElement>('input[type="hidden"][name^="properties["]')).map(
      input => ({ name: input.name, value: input.value })
    )
    if (inputs.length) return inputs
  }

  return []
}

export async function handleTailorKitHiddenPricingCartAddFetch(
  input: TailorKitFetchInputLike,
  init: TailorKitFetchInitLike | undefined,
  options: TailorKitHiddenPricingNativeSubmitOptions = {}
): Promise<TailorKitHiddenPricingFetchInterceptorResult> {
  if (!isTailorKitCartAddFetch(input)) return { submitted: false, reason: 'skipped' }
  if (headerValue(init?.headers, 'X-TailorKit-Internal') === '1') return { submitted: false, reason: 'skipped' }

  const context = extractTailorKitHiddenPricingContextFromCartAddBody(
    init?.body,
    readTailorKitHiddenPricingInputsFromDom(variantIdFromCartAddBody(init?.body))
  )
  if (!context) return { submitted: false, reason: 'missing-context' }

  return submitTailorKitHiddenPricingProductFromContext(context, options)
}

function nextInitWithTailorKitProperties(input: TailorKitFetchInputLike, init?: RequestInit) {
  if (!isTailorKitCartAddFetch(input)) return init
  if (headerValue(init?.headers, 'X-TailorKit-Internal') === '1') return init

  const fallbackInputs = readTailorKitHiddenPricingInputsFromDom(variantIdFromCartAddBody(init?.body))
  if (!fallbackInputs.length) return init

  return {
    ...(init || {}),
    body: injectTailorKitDomInputsIntoCartAddBody(init?.body, fallbackInputs) as BodyInit | null | undefined,
  }
}

/** Installs TailorKit's AJAX/fetch hidden pricing submit handler for themes that prevent native submit. */
export function installTailorKitHiddenPricingFetchInterceptor() {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return
  if (window.__tailorkitHiddenPricingFetchInterceptorInstalled) return
  window.__tailorkitHiddenPricingFetchInterceptorInstalled = true

  const originalFetch = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const nextInit = nextInitWithTailorKitProperties(input, init)
    await handleTailorKitHiddenPricingCartAddFetch(input, nextInit).catch(error =>
      console.error('[TailorKit] Hidden pricing fetch interceptor failed:', error)
    )

    return originalFetch(input, nextInit)
  }
}
