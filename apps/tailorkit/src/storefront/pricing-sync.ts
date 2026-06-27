export const TOTAL_ADDITIONAL_COST_PROPERTY_SUFFIX = '_Total_Additional_Cost'
export const TOTAL_ADDITIONAL_COST_DISPLAY_PROPERTY_SUFFIX = '_Total_Additional_Cost_Display'

type ShopifyCurrency = {
  active?: string
  rate?: string
}

type AdditionalPricing = {
  flatRate?: number
}

export type TailorKitAdditionalPricing = {
  totalAdditionalCost: number
  formattedTotal: string
  currency: string
}

declare global {
  interface Window {
    Shopify?: {
      currency?: ShopifyCurrency
    }
  }
}

const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF',
  'CLP',
  'DJF',
  'GNF',
  'JPY',
  'KMF',
  'KRW',
  'MGA',
  'PYG',
  'RWF',
  'UGX',
  'VND',
  'VUV',
  'XAF',
  'XOF',
  'XPF',
])

const CURRENCY_SYMBOLS: Record<string, string> = {
  AUD: 'A$',
  CAD: 'C$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  USD: '$',
  VND: '₫',
}

function isJSON(value: unknown): value is string {
  if (typeof value !== 'string' || !value) return false
  try {
    JSON.parse(value)
    return true
  } catch {
    return false
  }
}

function getCustomerCurrencyInfo() {
  const shopifyCurrency = window.Shopify?.currency || {}
  const code = shopifyCurrency.active || 'USD'
  const rate = Number.parseFloat(shopifyCurrency.rate || '1')

  return {
    code,
    rate: Number.isFinite(rate) ? rate : 1,
    symbol: CURRENCY_SYMBOLS[code.toUpperCase()] || '$',
  }
}

function formatCustomerPrice(amount: number, currencyCode: string) {
  if (ZERO_DECIMAL_CURRENCIES.has(currencyCode.toUpperCase())) {
    return Math.round(amount).toLocaleString()
  }

  const fixed = amount.toFixed(2)
  return (fixed.endsWith('.00') ? fixed.slice(0, -3) : fixed).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function selectedPricingElement(fieldset: Element) {
  return (
    fieldset.querySelector<HTMLElement>('.emtlkit--option-container.active input')
    || fieldset.querySelector<HTMLElement>('.emtlkit--checkbox-input:checked')
    || fieldset.querySelector<HTMLSelectElement>('select')?.selectedOptions[0]
    || (fieldset as HTMLElement)
  )
}

function parseAdditionalPricing(pricingData: string | null): AdditionalPricing | null {
  if (!isJSON(pricingData)) return null

  try {
    return JSON.parse(pricingData) as AdditionalPricing
  } catch (error) {
    console.warn('[TailorKit][PageFly] Failed to parse pricing data', error)
    return null
  }
}

function pricingFlatRateFrom(element: Element | null) {
  if (!element) return 0

  const fieldset = element.closest('fieldset')
  const pricing = parseAdditionalPricing(element.getAttribute('data-pricing') || fieldset?.getAttribute('data-pricing') || '')
  const flatRate = Number(pricing?.flatRate || 0)

  return Number.isFinite(flatRate) && flatRate > 0 ? flatRate : 0
}

/** Mirrors TailorKit's option display pricing suffix for storefront cart properties. */
export function getDisplayValueWithPricing(fieldset: Element, value: string) {
  const currencyInfo = getCustomerCurrencyInfo()
  const flatRate = pricingFlatRateFrom(selectedPricingElement(fieldset))
  if (!flatRate) return value

  const customerPrice = flatRate * currencyInfo.rate
  return `${value} (+${currencyInfo.symbol}${formatCustomerPrice(customerPrice, currencyInfo.code)})`
}

/** Collects TailorKit additional option pricing without bundling the original pricing manager. */
export function collectTailorKitAdditionalPricing(productPersonalizer: HTMLElement): TailorKitAdditionalPricing | null {
  const currencyInfo = getCustomerCurrencyInfo()
  let totalAdditionalCost = 0

  productPersonalizer.querySelectorAll('fieldset[data-layer-id]').forEach(fieldset => {
    const element = fieldset as HTMLElement
    if (element.hidden || element.style.display === 'none' || element.closest('[hidden], [style*="display: none"]')) return

    const flatRate = pricingFlatRateFrom(selectedPricingElement(fieldset))
    if (flatRate > 0) totalAdditionalCost += flatRate * currencyInfo.rate
  })

  if (totalAdditionalCost <= 0) return null

  return {
    totalAdditionalCost,
    formattedTotal: `${currencyInfo.symbol}${formatCustomerPrice(totalAdditionalCost, currencyInfo.code)}`,
    currency: currencyInfo.code,
  }
}

export function dispatchTailorKitPricingUpdated(pricing: TailorKitAdditionalPricing | null) {
  if (!pricing) return

  window.dispatchEvent(
    new CustomEvent('tailorkit-pricing-updated', {
      detail: {
        totalCost: pricing.totalAdditionalCost,
        formattedCost: pricing.formattedTotal,
        currency: pricing.currency,
      },
    })
  )
}
