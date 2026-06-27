import type { OptionPricing } from '~/models/OptionSet'
import { formatCustomerPrice } from 'extensions/tailorkit-src/src/assets/utils/storefront-pricing'

// Client-side cache for exchange rates
let cachedExchangeRates: IExchangeRates | null = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

/**
 * Fetch exchange rates from the server API and cache them on the client
 */
export async function fetchAndCacheExchangeRates(): Promise<IExchangeRates | null> {
  try {
    const response = await fetch('/api/exchange-rates')
    if (!response.ok) {
      throw new Error('Failed to fetch exchange rates')
    }

    const data = await response.json()
    cachedExchangeRates = data
    cacheTimestamp = Date.now()

    return data
  } catch (error) {
    console.error('Error fetching exchange rates:', error)
    return null
  }
}

/**
 * Get cached exchange rates or fetch if cache is expired/empty
 */
export async function getClientExchangeRates(): Promise<IExchangeRates | null> {
  const now = Date.now()
  const isCacheExpired = now - cacheTimestamp > CACHE_DURATION

  if (!cachedExchangeRates || isCacheExpired) {
    return fetchAndCacheExchangeRates()
  }

  return cachedExchangeRates
}

/**
 * Convert currency amount to USD using client-side cached exchange rates
 */
export async function convertCurrencyToUSDClient(
  currency: string,
  amount: number,
  decimals: number = 2
): Promise<number> {
  try {
    const exchangeRates = await getClientExchangeRates()

    if (!exchangeRates || !exchangeRates[currency]) {
      console.warn(`Exchange rate not found for currency: ${currency}`)
      return amount
    }

    const exchangeRate = exchangeRates[currency]
    const convertedAmount = amount / exchangeRate.value

    return Number(convertedAmount.toFixed(decimals))
  } catch (error) {
    console.error(`Error converting ${currency} to USD:`, error)
    return amount
  }
}

/**
 * Calculate the flat rate (USD equivalent) for option pricing
 */
export async function calculateOptionPricingFlatRate(value: number, currency: string): Promise<number> {
  if (currency === 'USD') {
    return value
  }

  return convertCurrencyToUSDClient(currency, value)
}

/**
 * Create or update option pricing object with automatic flat rate calculation
 */
export async function createOptionPricing(value: number): Promise<OptionPricing> {
  // Consider flatRate is equal to value for now
  const flatRate = value

  return {
    value,
    flatRate,
  }
}

/**
 * Format option pricing for display in option labels according to design specs
 * Shows (+$X.XX) format, only displays prices > 0, hides prices = 0
 */
export function formatOptionDisplayPricing(
  pricing: OptionPricing | undefined,
  currency: string,
  showPlusSign: boolean = true
): string {
  if (!pricing || pricing.value === 0) {
    return ''
  }

  // If the option price is already in USD, use it directly
  if (currency === 'USD') {
    const symbol = '$'
    return ` ${showPlusSign ? '+' : ''}${symbol}${formatCustomerPrice(pricing.value, { code: 'USD' })}`
  }

  const displayAmount = pricing.flatRate ?? pricing.value
  return ` ${showPlusSign ? '+' : ''}${formatCustomerPrice(displayAmount, { code: currency })} ${currency}`
}
