interface IExchangeRate {
  code: string // Currency code (e.g., EUR, JPY)
  value: number // The rate of the currency compared to USD
}

interface IExchangeRates {
  [currencyCode: string]: IExchangeRate // Mapping of currency code to the exchange rate value
}
