import type { LoaderFunctionArgs } from '@remix-run/node'
import { getClipartsListFromIndex } from '~/services/cliparts.server'

import type { ClipartListItem } from '~/services/cliparts.server'

export async function getCombinedClipartsList(
  request: LoaderFunctionArgs['request'],
  _shopDomain: string
): Promise<{ items: ClipartListItem[]; total: number; page: number }> {
  return getClipartsListFromIndex(request)
}
