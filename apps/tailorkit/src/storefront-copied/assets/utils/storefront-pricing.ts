/* eslint-disable max-lines */
/**
 * Storefront pricing utilities for displaying option pricing in customer's market currency
 *
 * IMPORTANT: Shopify Product JSON API returns ALL prices in minor units (×100),
 * even for zero-decimal currencies like VND, JPY, KRW.
 *
 * Zero-decimal currencies (no decimal places in display):
 * VND, JPY, KRW, CLP, PYG, RWF, UGX, VUV, XAF, XOF, XPF, etc.
 */

export interface OptionPricing {
  value: number // Original merchant input
  flatRate: number // USD equivalent
}

interface ShopifyCurrency {
  active: string // Customer's market currency code (e.g. 'VND')
  rate: string // Exchange rate from USD to customer's currency (e.g. '26640.972')
}

/**
 * Zero-decimal currencies (currencies that don't display decimal places)
 * Based on ISO 4217 standard
 */
export const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF', // Burundian Franc
  'CLP', // Chilean Peso
  'DJF', // Djiboutian Franc
  'GNF', // Guinean Franc
  'JPY', // Japanese Yen
  'KMF', // Comorian Franc
  'KRW', // South Korean Won
  'MGA', // Malagasy Ariary
  'PYG', // Paraguayan Guarani
  'RWF', // Rwandan Franc
  'UGX', // Ugandan Shilling
  'VND', // Vietnamese Dong
  'VUV', // Vanuatu Vatu
  'XAF', // Central African CFA Franc
  'XOF', // West African CFA Franc
  'XPF', // CFP Franc
])

// Mapping of zero-decimal currencies to a practical "tick" size for our hidden pricing variant.
// Use a larger unit for very low-value currencies so we keep cart quantities small and under
// Shopify’s 9 999-unit limit, while still keeping the rounding error negligible.
export const ZERO_DECIMAL_PRICE_MAP: Record<string, number> = {
  VND: 100, // 100 ₫ (≈ 0.4¢ USD)
  IDR: 100, // 100 Rp (≈ 0.6¢ USD)
  MGA: 100, // 100 Ariary
  KRW: 10, // 10 ₩  (≈ 0.7¢ USD)
  XOF: 10,
  XAF: 10,
  CLP: 10,
}

/**
 * Check if a currency is zero-decimal (no decimal places in display)
 */
export const isZeroDecimalCurrency = (currencyCode: string): boolean => {
  return ZERO_DECIMAL_CURRENCIES.has(currencyCode.toUpperCase())
}

/**
 * Get Shopify currency data from window object
 * Falls back to USD if not available
 */
function getShopifyCurrency(): ShopifyCurrency {
  if (typeof window !== 'undefined' && window.Shopify?.currency) {
    return window.Shopify.currency
  }

  // Fallback to USD
  return {
    active: 'USD',
    rate: '1',
  }
}

export const CURRENCY_MAP = {
  AED: {
    symbol: 'د.إ',
  },
  AFN: {
    symbol: 'Af',
  },
  ALL: {
    symbol: 'L',
  },
  AMD: {
    symbol: '֏',
  },
  ANG: {
    symbol: 'ƒ',
  },
  AOA: {
    symbol: 'Kz',
  },
  ARS: {
    symbol: '$',
  },
  AUD: {
    symbol: 'A$',
  },
  AWG: {
    symbol: 'ƒ',
  },
  AZN: {
    symbol: '₼',
  },
  BAM: {
    symbol: 'KM',
  },
  BBD: {
    symbol: '$',
  },
  BDT: {
    symbol: '৳',
  },
  BGN: {
    symbol: 'лв',
  },
  BHD: {
    symbol: '.د.ب',
  },
  BIF: {
    symbol: 'Fr',
  },
  BMD: {
    symbol: '$',
  },
  BND: {
    symbol: 'B$',
  },
  BOB: {
    symbol: 'Bs',
  },
  BRL: {
    symbol: 'R$',
  },
  BSD: {
    symbol: '$',
  },
  BTN: {
    symbol: 'Nu.',
  },
  BWP: {
    symbol: 'P',
  },
  BYN: {
    symbol: 'Br',
  },
  BYR: {
    symbol: 'BYR',
  },
  BZD: {
    symbol: 'BZ$',
  },
  CAD: {
    symbol: 'C$',
  },
  CDF: {
    symbol: 'Fr',
  },
  CHF: {
    symbol: 'CHF',
  },
  CLF: {
    symbol: 'CLF',
  },
  CLP: {
    symbol: '$',
  },
  CNY: {
    symbol: '¥',
  },
  COP: {
    symbol: '$',
  },
  CRC: {
    symbol: '₡',
  },
  CUC: {
    symbol: 'CUC',
  },
  CUP: {
    symbol: '₱',
  },
  CVE: {
    symbol: '$',
  },
  CZK: {
    symbol: 'Kč',
  },
  DJF: {
    symbol: 'Fr',
  },
  DKK: {
    symbol: 'kr',
  },
  DOP: {
    symbol: '$',
  },
  DZD: {
    symbol: 'د.ج',
  },
  EGP: {
    symbol: 'ج.م',
  },
  ERN: {
    symbol: 'Nfa',
  },
  ETB: {
    symbol: 'Br',
  },
  EUR: {
    symbol: '€',
  },
  FJD: {
    symbol: '$',
  },
  FKP: {
    symbol: '£',
  },
  GBP: {
    symbol: '£',
  },
  GEL: {
    symbol: '₾',
  },
  GGP: {
    symbol: 'GGP',
  },
  GHS: {
    symbol: '₵',
  },
  GIP: {
    symbol: '£',
  },
  GMD: {
    symbol: 'D',
  },
  GNF: {
    symbol: 'Fr',
  },
  GTQ: {
    symbol: 'Q',
  },
  GYD: {
    symbol: '$',
  },
  HKD: {
    symbol: 'HK$',
  },
  HNL: {
    symbol: 'L',
  },
  HRK: {
    symbol: 'kn',
  },
  HTG: {
    symbol: 'G',
  },
  HUF: {
    symbol: 'Ft',
  },
  IDR: {
    symbol: 'Rp',
  },
  ILS: {
    symbol: '₪',
  },
  IMP: {
    symbol: '£',
  },
  INR: {
    symbol: '₹',
  },
  IQD: {
    symbol: 'ع.د',
  },
  IRR: {
    symbol: '﷼',
  },
  ISK: {
    symbol: 'kr',
  },
  JEP: {
    symbol: 'JEP',
  },
  JMD: {
    symbol: 'J$',
  },
  JOD: {
    symbol: 'د.أ',
  },
  JPY: {
    symbol: '¥',
  },
  KES: {
    symbol: 'KSh',
  },
  KGS: {
    symbol: 'сом',
  },
  KHR: {
    symbol: '៛',
  },
  KMF: {
    symbol: 'Fr',
  },
  KPW: {
    symbol: 'KPW',
  },
  KRW: {
    symbol: '₩',
  },
  KWD: {
    symbol: 'د.ك',
  },
  KYD: {
    symbol: '$',
  },
  KZT: {
    symbol: '₸',
  },
  LAK: {
    symbol: '₭',
  },
  LBP: {
    symbol: 'ل.ل',
  },
  LKR: {
    symbol: 'Rs',
  },
  LRD: {
    symbol: '$',
  },
  LSL: {
    symbol: 'M',
  },
  LTL: {
    symbol: 'LTL',
  },
  LVL: {
    symbol: 'LVL',
  },
  LYD: {
    symbol: 'ل.د',
  },
  MAD: {
    symbol: 'د.م.',
  },
  MDL: {
    symbol: 'L',
  },
  MGA: {
    symbol: 'Ar',
  },
  MKD: {
    symbol: 'ден',
  },
  MMK: {
    symbol: 'Ks',
  },
  MNT: {
    symbol: '₮',
  },
  MOP: {
    symbol: 'MOP$',
  },
  MRO: {
    symbol: 'MRO',
  },
  MUR: {
    symbol: 'Rs',
  },
  MVR: {
    symbol: 'MVR',
  },
  MWK: {
    symbol: 'MK',
  },
  MXN: {
    symbol: '$',
  },
  MYR: {
    symbol: 'RM',
  },
  MZN: {
    symbol: 'MT',
  },
  NAD: {
    symbol: '$',
  },
  NGN: {
    symbol: '₦',
  },
  NIO: {
    symbol: 'C$',
  },
  NOK: {
    symbol: 'kr',
  },
  NPR: {
    symbol: 'Rs',
  },
  NZD: {
    symbol: 'NZ$',
  },
  OMR: {
    symbol: 'ر.ع.',
  },
  PAB: {
    symbol: 'B/.',
  },
  PEN: {
    symbol: 'S/.',
  },
  PGK: {
    symbol: 'K',
  },
  PHP: {
    symbol: '₱',
  },
  PKR: {
    symbol: 'Rs',
  },
  PLN: {
    symbol: 'zł',
  },
  PYG: {
    symbol: '₲',
  },
  QAR: {
    symbol: 'ر.ق',
  },
  RON: {
    symbol: 'lei',
  },
  RSD: {
    symbol: 'РСД',
  },
  RUB: {
    symbol: '₽',
  },
  RWF: {
    symbol: 'Fr',
  },
  SAR: {
    symbol: 'ر.س',
  },
  SBD: {
    symbol: '$',
  },
  SCR: {
    symbol: 'SRe',
  },
  SDG: {
    symbol: 'ج.س.',
  },
  SEK: {
    symbol: 'kr',
  },
  SGD: {
    symbol: 'S$',
  },
  SHP: {
    symbol: '£',
  },
  SLL: {
    symbol: 'Le',
  },
  SOS: {
    symbol: 'S',
  },
  SRD: {
    symbol: '$',
  },
  STD: {
    symbol: 'STD',
  },
  SVC: {
    symbol: 'SVC',
  },
  SYP: {
    symbol: 'ل.س',
  },
  SZL: {
    symbol: 'E',
  },
  THB: {
    symbol: '฿',
  },
  TJS: {
    symbol: 'ЅМ',
  },
  TMT: {
    symbol: 'T',
  },
  TND: {
    symbol: 'د.ت',
  },
  TOP: {
    symbol: 'T$',
  },
  TRY: {
    symbol: '₺',
  },
  TTD: {
    symbol: '$',
  },
  TWD: {
    symbol: 'NT$',
  },
  TZS: {
    symbol: 'TSh',
  },
  UAH: {
    symbol: '₴',
  },
  UGX: {
    symbol: 'USh',
  },
  USD: {
    symbol: '$',
  },
  UYU: {
    symbol: '$',
  },
  UZS: {
    symbol: 'сўм',
  },
  VEF: {
    symbol: 'VEF',
  },
  VND: {
    symbol: '₫',
  },
  VUV: {
    symbol: 'VT',
  },
  WST: {
    symbol: 'WS$',
  },
  XAF: {
    symbol: 'Fr',
  },
  XAG: {
    symbol: 'Ag',
  },
  XAU: {
    symbol: 'Au',
  },
  XCD: {
    symbol: '$',
  },
  XDR: {
    symbol: 'XDR',
  },
  XOF: {
    symbol: 'Fr',
  },
  XPF: {
    symbol: 'CFPF',
  },
  YER: {
    symbol: 'ر.ي',
  },
  ZAR: {
    symbol: 'R',
  },
  ZMK: {
    symbol: 'ZK',
  },
  ZMW: {
    symbol: 'ZK',
  },
  ZWL: {
    symbol: '$',
  },
  XPT: {
    symbol: 'XPT',
  },
  XPD: {
    symbol: 'XPD',
  },
  BTC: {
    symbol: 'BTC',
  },
  ETH: {
    symbol: 'ETH',
  },
  BNB: {
    symbol: 'BNB',
  },
  XRP: {
    symbol: 'XRP',
  },
  SOL: {
    symbol: 'SOL',
  },
  DOT: {
    symbol: 'DOT',
  },
  AVAX: {
    symbol: 'AVAX',
  },
  MATIC: {
    symbol: 'MATIC',
  },
  LTC: {
    symbol: 'LTC',
  },
  ADA: {
    symbol: 'ADA',
  },
}

/**
 * List currency codes from currency api
 * This list cover almost currency codes all over the world ~ +170 currencies
 * @see https://currencyapi.com/docs/currency-list
 */
export const ALL_CURRENCY_CODE = Object.keys(CURRENCY_MAP)

/**
 * Get the symbol for a given currency code
 * @param currencyCode - The currency code to get the symbol for
 * @returns The symbol for the given currency code
 */
export const getCurrencySymbol = (currencyCode: string) => {
  return CURRENCY_MAP[currencyCode as keyof typeof CURRENCY_MAP]?.symbol || currencyCode || ''
}

/**
 * Convert USD flatRate to customer's market currency without formatting
 * Useful for calculations
 */
export function convertUSDToCustomerCurrency(usdAmount: number): number {
  const shopifyCurrency = getShopifyCurrency()
  const exchangeRate = parseFloat(shopifyCurrency.rate)

  return usdAmount * exchangeRate
}

/**
 * Get customer's current market currency info
 */
export function getCustomerCurrencyInfo(): { code: string; symbol: string; rate: number } {
  const shopifyCurrency = getShopifyCurrency()

  return {
    code: shopifyCurrency.active,
    symbol: getCurrencySymbol(shopifyCurrency.active),
    rate: parseFloat(shopifyCurrency.rate),
  }
}

/**
 * Format customer price
 * @param amount - The amount to format
 * @param currencyInfo - The currency info
 * @returns The formatted price
 * @example
 * formatCustomerPrice(1000, { code: 'VND' }) // 1,000₫
 * formatCustomerPrice(1000, { code: 'USD' }) // $1,000.00
 * formatCustomerPrice(1000, { code: 'EUR' }) // €1,000.00
 */
export function formatCustomerPrice(amount: number, currencyInfo: { code: string }): string {
  if (isZeroDecimalCurrency(currencyInfo.code)) {
    return Math.round(amount).toLocaleString()
  }

  // Convert to string with two decimals, then remove trailing `.00` when the amount is a whole number
  const fixed = amount.toFixed(2)
  const trimmed = fixed.endsWith('.00') ? fixed.slice(0, -3) : fixed

  return trimmed.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// Extend window interface for TypeScript
declare global {
  interface Window {
    Shopify?: {
      currency?: ShopifyCurrency
      routes?: {
        root?: string
      }
      theme?: {
        schema_name?: string
      }
    }
  }
}
