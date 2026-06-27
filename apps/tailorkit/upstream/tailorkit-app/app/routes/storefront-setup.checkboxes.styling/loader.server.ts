import type { LoaderFunctionArgs } from '@remix-run/node'
import { authenticate } from '~/shopify/app.server'
import { json } from '~/bootstrap/fns/fetch.server'
import { getGlobalStyling } from '~/models/GlobalStyling.server'
import { defaultCheckboxStyling } from '~/types/global-styling'

/**
 * Loader for checkbox styling page
 * Fetches current checkbox styling from GlobalStyling
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const {
    session: { shop: shopDomain },
  } = await authenticate.admin(request)

  // Get global styling from database
  const globalStyling = await getGlobalStyling(shopDomain)

  // Return checkbox styling with defaults as fallback
  const checkboxStyling = globalStyling?.styling?.checkbox || defaultCheckboxStyling

  return json({
    checkboxStyling,
  })
}
