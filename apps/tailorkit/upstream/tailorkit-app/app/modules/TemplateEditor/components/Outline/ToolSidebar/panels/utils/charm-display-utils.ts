/**
 * Format price with currency symbol (e.g. "$19.99")
 */
export function formatCharmPrice(price: string, currencyCode: string): string {
  const amount = parseFloat(price)
  if (isNaN(amount)) return price
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(amount)
  } catch {
    return `${price} ${currencyCode}`
  }
}
