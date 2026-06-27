/**
 * Builds a URL with the provided query parameters, dynamically including
 * only the defined (non-null, non-undefined) parameters.
 *
 * @param baseUrl The base URL to which query parameters will be appended.
 * @param params An object containing key-value pairs of query parameters.
 *               Only the defined parameters (non-null, non-undefined) will
 *               be included in the resulting URL.
 * @returns The final URL, with query parameters if any are valid.
 */

export function buildUrlWithParams(baseUrl: string, params: Record<string, any>): string {
  // Initialize an array to collect valid query parameters
  const queryParams: string[] = []

  // Iterate through each key in the params object
  for (const [key, value] of Object.entries(params)) {
    // Only add to queryParams if the value is defined and not null
    if (value !== undefined && value !== null) {
      // Add the parameter to the query string, using encodeURIComponent to safely handle special characters
      queryParams.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    }
  }

  // Determine the appropriate separator based on whether the baseUrl already contains a query string
  const separator = baseUrl.includes('?') ? '&' : '?'

  // Construct the final URL with the query string
  const queryString = queryParams.length ? `${separator}${queryParams.join('&')}` : ''

  return `${baseUrl}${queryString}`
}
