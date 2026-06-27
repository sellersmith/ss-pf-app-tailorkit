export function getShopifyImageInSpecificWidth(src: any, width: number): any {
  const w = Math.round(width)

  const isShopifyCDN
    = typeof src === 'string' && src.match(/^(https?:)?\/\/([^.]+\.myshopify\.com\/cdn\/|cdn\.shopify\.com)/)

  if (!isShopifyCDN) {
    return src
  }

  return src.indexOf(`width=${w}`) < 0
    ? `${src.replace(/&*width=\d+/, '')}${src.includes('?') ? '&' : '?'}width=${w}`
    : src
}

export function getShopifyImageInSpecificHeight(src: any, height: number): any {
  const h = Math.round(height)

  const isShopifyCDN
    = typeof src === 'string' && src.match(/^(https?:)?\/\/([^.]+\.myshopify\.com\/cdn\/|cdn\.shopify\.com)/)

  if (!isShopifyCDN) {
    return src
  }

  return src.indexOf(`height=${h}`) < 0
    ? `${src.replace(/&*height=\d+/, '')}${src.includes('?') ? '&' : '?'}height=${h}`
    : src
}

/**
 * For our own CDN (CLOUDFRONT_URL), prefer pre-generated small variant filename.
 * If the URL is from our CDN and a variant exists (uploaded as `<name>_w200.<ext>` or `<name>_w400.<ext>`),
 * rewrite to that. Otherwise, fallback to Shopify-style width query if applicable.
 */
export function getTailorKitSmallVariant(src: any): any {
  const isString = typeof src === 'string'
  if (!isString) return src

  const isOurCdn = !!src.match(/^(https?:)?\/\/[^/]*ecomate\.co\//) || !!src.match(/CLOUDFRONT_URL_PLACEHOLDER/)
  if (!isOurCdn) return src

  const qIndex = src.indexOf('?')
  const base = qIndex >= 0 ? src.slice(0, qIndex) : src
  const query = qIndex >= 0 ? src.slice(qIndex + 1) : ''

  // Rewrite to small variant based on version param
  const params = new URLSearchParams(query)
  const version = params.get('v')

  // v=3 uses 400px variant, v=2 uses 200px variant
  if (version !== '2' && version !== '3') return src

  const lastDot = base.lastIndexOf('.')
  if (lastDot < 0) return src

  // Use appropriate variant based on version
  const variantSuffix = version === '3' ? '_w400' : '_w200'
  const small = `${base.slice(0, lastDot)}${variantSuffix}${base.slice(lastDot)}${qIndex >= 0 ? src.slice(qIndex) : ''}`
  return small
}
