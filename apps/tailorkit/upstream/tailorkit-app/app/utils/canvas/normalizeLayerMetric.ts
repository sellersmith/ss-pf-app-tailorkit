import isInteger from 'lodash/isInteger'

/**
 * This function to normalize/round the decimal if number is decimal and remain if number is integer
 * @param num number
 * @returns number
 */

export function normalizeLayerMetric(num: number, notation = 2) {
  return !isInteger(num) ? +num.toFixed(notation) : num
}
