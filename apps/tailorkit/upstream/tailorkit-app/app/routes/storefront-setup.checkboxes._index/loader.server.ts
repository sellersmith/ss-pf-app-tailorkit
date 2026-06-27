import type { LoaderFunctionArgs } from '@remix-run/node'
import { authenticate } from '~/shopify/app.server'
import { json } from '~/bootstrap/fns/fetch.server'
import { getCheckboxCount, getUpsellProductLimit } from '~/services/checkbox.server'
import { getShopData } from '~/models/Shop.server'

/**
 * Loader for checkboxes list page
 * Returns checkbox count and upsell product limit for enforcing plan restrictions
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const {
    session: { shop: shopDomain },
  } = await authenticate.admin(request)

  const [checkboxCount, shopData] = await Promise.all([getCheckboxCount(shopDomain), getShopData(shopDomain)])

  const upsellProductLimit = getUpsellProductLimit(shopData)

  return json({ checkboxCount, upsellProductLimit })
}
