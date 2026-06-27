/**
 * SVG Data URI Utilities
 *
 * Functions for converting between SVG strings and data URIs.
 */

/**
 * Convert SVG string to base64 data URI
 *
 * @param svgString - SVG string to convert
 * @returns Base64 data URI
 *
 * @example
 * svgToDataUri('<svg>...</svg>') // 'data:image/svg+xml;base64,...'
 */
export function svgToDataUri(svgString: string): string {
  const base64 = Buffer.from(svgString).toString('base64')
  return `data:image/svg+xml;base64,${base64}`
}

/**
 * Convert SVG string to URL-encoded data URI
 * This format is often more compact for simple SVGs
 *
 * @param svgString - SVG string to convert
 * @returns URL-encoded data URI
 *
 * @example
 * svgToUrlEncodedDataUri('<svg>...</svg>') // 'data:image/svg+xml,...'
 */
export function svgToUrlEncodedDataUri(svgString: string): string {
  const encoded = encodeURIComponent(svgString).replace(/'/g, '%27').replace(/"/g, '%22')
  return `data:image/svg+xml,${encoded}`
}

/**
 * Convert data URI back to SVG string
 *
 * @param dataUri - Data URI to convert
 * @returns SVG string or null if invalid format
 *
 * @example
 * dataUriToSvg('data:image/svg+xml;base64,...') // '<svg>...</svg>'
 */
export function dataUriToSvg(dataUri: string): string | null {
  if (!isSvgDataUri(dataUri)) {
    return null
  }

  // Check if base64 encoded
  if (dataUri.includes(';base64,')) {
    const base64 = dataUri.split(';base64,')[1]
    return Buffer.from(base64, 'base64').toString('utf-8')
  }

  // URL encoded
  const encoded = dataUri.replace(/^data:image\/svg\+xml,/, '')
  return decodeURIComponent(encoded)
}

/**
 * Check if a string is an SVG data URI
 *
 * @param uri - String to check
 * @returns True if SVG data URI
 */
export function isSvgDataUri(uri: string): boolean {
  return uri.startsWith('data:image/svg+xml')
}

/**
 * Check if a string is any type of data URI
 *
 * @param uri - String to check
 * @returns True if data URI
 */
export function isDataUri(uri: string): boolean {
  return uri.startsWith('data:')
}

/**
 * Extract MIME type from data URI
 *
 * @param dataUri - Data URI to parse
 * @returns MIME type or null if invalid
 */
export function getDataUriMimeType(dataUri: string): string | null {
  const match = dataUri.match(/^data:([^;,]+)/)
  return match ? match[1] : null
}
