import { CURRENCY_MAP } from 'extensions/tailorkit-src/src/assets/utils/storefront-pricing'

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

export function getCurrencySymbolV2(currencyCode: string, locale = 'en-US') {
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
  })

  return formatter?.formatToParts(0).find(part => part.type === 'currency')?.value
}
