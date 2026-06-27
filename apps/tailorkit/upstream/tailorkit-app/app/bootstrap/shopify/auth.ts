import { authenticate } from '~/shopify/app.server'

/**
 * Authenticate app proxy request
 * Places that use this function must handle the error by itself
 * @param request
 * @returns
 */
export const authenticateAppProxy = async (request: Request) => {
  const { session, storefront, ...context } = await authenticate.public.appProxy(request)

  if (!session || !storefront) {
    throw new Error('App proxy authentication failed', { cause: 'UNAUTHORIZED' })
  }

  return { ...context, session, storefront }
}
