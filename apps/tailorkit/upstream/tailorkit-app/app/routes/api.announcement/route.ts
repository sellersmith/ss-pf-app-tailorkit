import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import { authenticate } from '~/shopify/app.server'
import { getActiveAnnouncements } from '~/modules/Announcement/fns.server'

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request)

  return json(await getActiveAnnouncements())
}
