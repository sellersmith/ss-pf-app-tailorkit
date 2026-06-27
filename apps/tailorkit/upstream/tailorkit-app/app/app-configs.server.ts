/**
 * @important Make sure this file has no context outside import
 */

/**
 * Check if current environment is development rc environment
 */
export const isWIPAndRCEnv = () => {
  /*const isDevelopment = process.env.NODE_ENV === 'development'

  if (isDevelopment) {
    return true
  }*/

  const HOST = process.env.HOST
  const SHOPIFY_APP_URL = process.env.SHOPIFY_APP_URL
  const pattern = /^https?:\/\/(rc|wip)-tailorkit\.ecomate\.co(\/|$)/

  const _isWIPAndRCEnv = HOST?.match(pattern) || SHOPIFY_APP_URL?.match(pattern)

  return !!_isWIPAndRCEnv
}
