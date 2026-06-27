import { serverCacheStorage } from '~/bootstrap/fns/serverCacheStorage'
import { CACHE_KEYS } from '~/constants/cache'
import { ALL_CURRENCY_CODE } from '~/constants/currency-codes'
import { ONE_DAY_IN_MILLISECONDS } from '~/constants'
import { FALLBACK_CURRENCY_DATA } from './constants'

const DEFAULT_DECIMALS = 10

/**
 * Define default the exchange currency api key
 */
const DEFAULT_EXCHANGE_CURRENCY_API_KEY = ''

/**
 * Fetch exchange rates from the external API and cache them for later use.
 * This function calls a currency API to get the latest exchange rates to USD for all supported currencies.
 * It uses an API key from the environment variables for authentication.
 * The response is cached for future use to reduce the number of API calls.
 *
 * @returns {Promise<IExchangeRates | null>} A promise that resolves to the latest exchange rates in USD, or null if there is an error.
 */
export async function fetchExchangeRatesToUSD(): Promise<IExchangeRates | null> {
  const EXCHANGE_CURRENCY_API_KEY = process.env.EXCHANGE_CURRENCY_API_KEY || DEFAULT_EXCHANGE_CURRENCY_API_KEY

  try {
    // Fetch the exchange rates from the external API
    const response = await fetch(
      `https://api.currencyapi.com/v3/latest?apikey=${EXCHANGE_CURRENCY_API_KEY}&currencies=${ALL_CURRENCY_CODE.join(',')}`
    )

    const res = await response.json()
    const currencyData = res.data || FALLBACK_CURRENCY_DATA

    // Cache the exchange rates if the fetch is successful
    await setExchangeRatesToUSD(currencyData)

    return currencyData
  } catch (err) {
    // Log and return null if the fetch fails
    console.error('Error when fetching exchange rates to USD', err)
    return FALLBACK_CURRENCY_DATA
  }
}

// Setter for cachedExchangeRatesToUSD
export async function setExchangeRatesToUSD(data: IExchangeRates | null): Promise<void> {
  // Set the cache for 1 day
  await serverCacheStorage.set(CACHE_KEYS.CURRENCY_EXCHANGE_RATES, data, ONE_DAY_IN_MILLISECONDS)
}

/**
 * Retrieve cached exchange rates. If the rates are not cached, they will be fetched from the API.
 * This function will ensure that the rates are always available in your application.
 *
 * @returns {Promise<IExchangeRates | null>} A promise that resolves to the cached exchange rates, or null if no rates are available.
 */
export async function getExchangeRatesToUSD(): Promise<IExchangeRates | null> {
  try {
    // Check if exchange rates are already cached
    const cachedExchangeRatesToUSD = await serverCacheStorage.get(CACHE_KEYS.CURRENCY_EXCHANGE_RATES)

    if (cachedExchangeRatesToUSD === null) {
      // If not cached, fetch from the API and cache the result
      return await fetchExchangeRatesToUSD()
    }

    // Return the cached rates if available
    return cachedExchangeRatesToUSD
  } catch (error) {
    console.error('Error retrieving exchange rates:', error)
    return null
  }
}

/**
 * Convert a currency amount to its equivalent in USD.
 *
 * @param {string} currency - The currency code to convert from.
 * @param {number} amount - The amount to convert.
 * @param {number} [decimals=2] - Number of decimal places to round to (default: 2).
 * @returns {Promise<number>} The equivalent amount in USD, rounded to specified decimal places.
 */
export async function convertCurrencyToDollar(
  currency: string,
  amount: number,
  decimals: number = DEFAULT_DECIMALS
): Promise<number> {
  try {
    const exchangeRates = await getExchangeRatesToUSD()
    const exchangeRate = exchangeRates?.[currency]
    const convertedAmount = exchangeRate ? amount / exchangeRate.value : amount

    return Number(convertedAmount.toFixed(decimals))
  } catch (error) {
    console.error(`Error converting ${currency} to USD:`, error)
    return amount
  }
}

/**
 * Convert a USD amount to its equivalent in the target currency.
 *
 * @param {string} currency - The currency code to convert to.
 * @param {number} amount - The USD amount to convert.
 * @param {number} [decimals=2] - Number of decimal places to round to (default: 2).
 * @returns {Promise<number>} The equivalent amount in the target currency, rounded to specified decimal places.
 */
export async function convertDollarToCurrency(
  currency: string,
  amount: number,
  decimals: number = DEFAULT_DECIMALS
): Promise<number> {
  try {
    const exchangeRates = await getExchangeRatesToUSD()
    const exchangeRate = exchangeRates?.[currency]
    const convertedAmount = exchangeRate ? amount * exchangeRate.value : amount

    return Number(convertedAmount.toFixed(decimals))
  } catch (error) {
    console.error(`Error converting USD to ${currency}:`, error)
    return amount
  }
}
