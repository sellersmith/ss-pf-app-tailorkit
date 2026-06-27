import numeral from 'numeral'
import type { NodeMedia } from '../types/shopify-product'

export function getMyShopifySubdomainName(shopDomain: string) {
  return shopDomain?.replace('.myshopify.com', '')
}

export function getIdNumberFromIdString(id: number | string) {
  if (typeof id === 'number') {
    return id
  }

  return id?.split('/').pop()
}

export function flattenGraphQLConnectionResults(results: any[], keysToFlatten: string[]) {
  return results.map((result: any) => {
    keysToFlatten.forEach((key: string) => {
      result[key] = result[key]?.nodes
    })

    return result
  })
}

/**
 * Format Shopify price
 * @param _moneyFormat - The money format
 * @param price - The price
 * @param fallback - The fallback
 * @returns The formatted price
 */
export function formatShopifyPrice(_moneyFormat: string, price: number | string, fallback?: string): string {
  let formatted: string
  let resetNumeral = false

  // Remove HTML tags from money format
  const moneyFormat = _moneyFormat.replace(/<[^>]*>/g, '')

  const pattern = /{{([^\}]+)}}/
  const test = moneyFormat.match(/{{([^\}]+)}}/)

  if (
    [
      'amount_with_comma_separator',
      'amount_with_space_separator',
      'amount_with_apostrophe_separator',
      'amount_with_period_and_space_separator',
      'amount_no_decimals_with_comma_separator',
      'amount_no_decimals_with_space_separator',
    ].includes(test?.[1] as string)
  ) {
    resetNumeral = true
    const localeData = numeral.localeData()

    try {
      numeral.localeData('tailorkit')
    } catch (e) {
      numeral.register('locale', 'tailorkit', {
        ...localeData,
        delimiters: {
          thousands: [
            'amount_with_space_separator',
            'amount_with_period_and_space_separator',
            'amount_no_decimals_with_space_separator',
          ].includes(test?.[1] as string)
            ? ' '
            : test?.[1] === 'amount_with_apostrophe_separator'
              ? "'"
              : '.',
          decimal: [
            'amount_with_space_separator',
            'amount_with_period_and_space_separator',
            'amount_no_decimals_with_space_separator',
          ].includes(test?.[1] as string)
            ? test?.[1] === 'amount_with_period_and_space_separator'
              ? '.'
              : ','
            : test?.[1] === 'amount_with_apostrophe_separator'
              ? '.'
              : ',',
        },
      })
    }

    numeral.locale('tailorkit')
  }

  switch (test?.[1]) {
    case 'amount':
    case 'amount_with_comma_separator':
    case 'amount_with_space_separator':
    case 'amount_with_apostrophe_separator':
    case 'amount_with_period_and_space_separator':
      formatted = moneyFormat.replace(pattern, numeral(price).format('0,0.00'))
      break

    case 'amount_no_decimals':
    case 'amount_no_decimals_with_comma_separator':
    case 'amount_no_decimals_with_space_separator':
      formatted = moneyFormat.replace(pattern, numeral(price).format('0,0', Math.round))
      break

    default:
      formatted = test ? (fallback ?? price.toString()) : moneyFormat.replace(pattern, price.toString())
      break
  }

  if (resetNumeral) {
    numeral.reset()
  }

  return formatted
}

export function getOriginalSrc(image: NodeMedia | string) {
  if (typeof image === 'object') {
    return image.originalSrc
  }

  return image
}
