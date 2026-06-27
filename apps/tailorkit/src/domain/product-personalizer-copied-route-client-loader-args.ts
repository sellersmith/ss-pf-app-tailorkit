import type { TailorKitMatchedCopiedRoute } from './copied-route-id'

export interface TailorKitCopiedRouteClientLoaderArgs {
  params: Readonly<Record<string, string>>
  request: Request
}

function requestSearch(inputFullPath: string) {
  return new URL(inputFullPath, 'https://pagefly.local').search
}

/** Builds Remix-compatible clientLoader args without importing copied TailorKit route modules. */
export function createTailorKitCopiedRouteClientLoaderArgs(
  route: TailorKitMatchedCopiedRoute,
  inputFullPath: string
): TailorKitCopiedRouteClientLoaderArgs {
  const requestUrl = new URL(route.tailorkitPathname, 'https://tailorkit.local')
  requestUrl.search = requestSearch(inputFullPath)

  return {
    params: route.params,
    request: new Request(requestUrl.toString()),
  }
}
