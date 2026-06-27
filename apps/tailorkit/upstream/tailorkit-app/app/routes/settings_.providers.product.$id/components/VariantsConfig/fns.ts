/**
 * @description
 * See more information on the following link:
 * https://help.shopify.com/en/manual/reports-and-analytics/shopify-reports/report-types/default-reports/profit-reports
 */

/**
 * Validates numeric inputs for price calculations
 * @param numbers - Array of numbers to validate
 * @returns boolean indicating if all numbers are valid
 */
const isValidInput = (...numbers: number[]): boolean => numbers.every(num => num >= 0 && isFinite(num))

/**
 * Rounds a number to 2 decimal places
 * @param value - Number to round
 * @returns Rounded number
 */
const roundToTwoDecimals = (value: number): number => Math.round(value * 100) / 100

/**
 * Calculates the final price based on cost and profit margin
 * @param cost - The base cost of the item
 * @param profitMargin - The desired profit margin percentage (0-100)
 * @returns The calculated final price rounded to 2 decimal places
 */
export const calculateFinalPrice = (cost: number, profitMargin: number): number => {
  if (!isValidInput(cost, profitMargin)) return 0
  if (profitMargin >= 100) return 2 * cost // Prevent division by zero

  return roundToTwoDecimals(cost / (1 - profitMargin / 100))
}

/**
 * Calculates the profit amount based on cost and profit margin
 * @param cost - The base cost of the item
 * @param profitMargin - The desired profit margin percentage (0-100)
 * @returns The calculated profit amount rounded to 2 decimal places
 */
export const calculateProfit = (cost: number, profitMargin: number): number => {
  if (!isValidInput(cost, profitMargin)) return 0

  const finalPrice = calculateFinalPrice(cost, profitMargin)
  return roundToTwoDecimals(finalPrice - cost)
}

/**
 * Calculates the profit margin percentage based on cost and final price
 * @param cost - The base cost of the item
 * @param finalPrice - The final selling price
 * @returns The calculated profit margin percentage rounded to 2 decimal places
 */
export const calculateProfitMargin = (cost: number, finalPrice: number): number => {
  if (!isValidInput(cost, finalPrice)) return 0
  if (finalPrice === 0) return 0 // Prevent division by zero

  return roundToTwoDecimals(((finalPrice - cost) / finalPrice) * 100)
}
