/**
 * Returns the origin (protocol + host) of the incoming request.
 *
 * This function respects proxy/load-balancer headers such as 'x-forwarded-proto' and 'x-forwarded-host'
 * to accurately determine the original protocol and host, falling back to the request URL if those headers are absent.
 *
 * @param request - The incoming HTTP request object
 * @returns The origin string in the format 'protocol://host'
 *
 * @example
 * // If behind a proxy with x-forwarded-proto and x-forwarded-host:
 * // x-forwarded-proto: 'https'
 * // x-forwarded-host: 'example.com'
 * // Returns: 'https://example.com'
 */
export function getRequestOrigin(request: Request): string {
  const url = new URL(request.url)

  // Respect proxies / load-balancers that forward the original protocol & host
  const forwardedProtoHeader = request.headers.get('x-forwarded-proto')
  const forwardedProto = forwardedProtoHeader?.split(',')[0]?.trim() ?? ''

  const forwardedHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? url.host

  // Fallbacks: use values from the URL object if headers are not present
  const protocol = forwardedProto || url.protocol.replace(/:$/, '')

  return `${protocol}://${forwardedHost}`
}
