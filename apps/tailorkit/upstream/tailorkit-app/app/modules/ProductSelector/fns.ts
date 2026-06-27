/* eslint-disable max-len */
import type { ProductData } from './type'
import numeral from 'numeral'
import { formatShopifyPrice } from '~/shopify/fns'
import { camelToTitleCase } from '~/bootstrap/fns/misc'

export function getProductId(product: ProductData) {
  return product?.id || product?.blueprintId || ''
}

export function getProductName(product: ProductData) {
  return product?.title || product?.name || ''
}

export function getProductDescription(product: any) {
  const description = [`${product?.description}<br/>`]

  if (product?.details instanceof Array) {
    description.push(`<p><b>Details:</b></p><ul><li>${product?.details.join('</li><li>')}</li></ul>`)
  }

  if (product?.features instanceof Array) {
    description.push(
      `<p><b>Features:</b></p><ul>${product?.features.map((item: any) => `<li><b>${item.name}</b>: ${item.description}</li>`).join('')}</ul>`
    )
  }

  if (product?.care_sets instanceof Array) {
    description.push(
      `<p><b>Care instructions:</b></p><ul>${product?.care_sets.map((item: any) => `<li><b>${item.set}</b>: ${item.option}</li>`).join('')}</ul>`
    )
  }

  return description.join('<br/>')
}

export function getProductImage(product: ProductData) {
  return (
    product.featuredImage?.url
    || (product.images?.[0]?.src && `https://images.printify.com/${product.images?.[0]?.src}`)
  )
}

export function getProductPrice(product: ProductData, moneyFormat?: string) {
  // Sort variants by price
  const sortedVariants
    = product?.variants?.[0]?.price !== undefined && product?.variants?.sort((a: any, b: any) => a.price - b.price)

  const formattedMinPrice = sortedVariants
    ? moneyFormat
      ? formatShopifyPrice(moneyFormat, sortedVariants[0].price)
      : sortedVariants[0].price
    : numeral((product?.minPrice || product?.min_price || product?.price)?.toString().replace(/(\d\d)$/, '.$1')).format(
        moneyFormat ? '$0,0.00' : '0,0.00'
      )

  const formattedMaxPrice = sortedVariants
    ? moneyFormat
      ? formatShopifyPrice(moneyFormat, sortedVariants[sortedVariants.length - 1].price)
      : sortedVariants[sortedVariants.length - 1].price
    : numeral(
        (product?.maxPrice || product?.max_price || product?.minPrice || product?.min_price || product?.price)
          ?.toString()
          .replace(/(\d\d)$/, '.$1')
      ).format(moneyFormat ? '$0,0.00' : '0,0.00')

  return formattedMinPrice === formattedMaxPrice
    ? `${formattedMinPrice}`
    : `${formattedMinPrice} - ${formattedMaxPrice}`
}

export function getProductOptions(product: ProductData) {
  const options: any = {}

  Object.keys(product).forEach(key => {
    if (key.match(/Count$/) && product[key as keyof ProductData] > 0) {
      options[
        camelToTitleCase(key === 'printProviderCount' ? 'printProviders' : key.replace(/Count$/, '')).toLowerCase()
      ] = product[key as keyof ProductData]
    }
  })

  return options
}

export function getProductBrandNameAndModel(product: ProductData) {
  return `${product.brandName || ''} ${product.model || ''}`.trim()
}

/**
 * Generates product variants from options object
 * @param options Object with option names as keys and arrays of values
 * @returns Array of variant objects with title and options
 */
export function generateVariants(options: { [optionName: string]: string[] }) {
  const optionKeys = Object.keys(options)

  if (optionKeys.length === 0) {
    return []
  }

  // Get all option values arrays
  const optionValues = optionKeys.map(key => options[key])

  // Generate cartesian product
  const combinations = cartesianProduct(optionValues)

  // Map combinations to variant objects
  return combinations.map((combination, index) => {
    const variantOptions: { [key: string]: string } = {}

    // Map each value to its corresponding option key
    combination.forEach((value, optionIndex) => {
      variantOptions[optionKeys[optionIndex]] = value
    })

    return {
      id: `variant-${index + 1}`,
      name: combination.join(' / '),
      options: variantOptions,
    }
  })
}

/**
 * Computes cartesian product of arrays
 */
function cartesianProduct<T>(arrays: T[][]): T[][] {
  if (arrays.length === 0) return [[]]
  if (arrays.length === 1) return arrays[0].map(item => [item])

  return arrays.reduce<T[][]>(
    (acc, curr) => {
      return acc.flatMap(combination => curr.map(value => [...combination, value]))
    },
    [[]]
  )
}
