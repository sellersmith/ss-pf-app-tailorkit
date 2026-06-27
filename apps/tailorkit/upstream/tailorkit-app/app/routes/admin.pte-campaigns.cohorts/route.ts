import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import { authenticate } from '~/shopify/app.server'
import { getCohortAnalysis } from '~/models/ShopCampaignStats.server'
import { CAMPAIGN_IDS } from '~/models/Promotion.define'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request)

  const url = new URL(request.url)
  const campaignId = url.searchParams.get('campaignId') ?? CAMPAIGN_IDS.PTE_VALENTINE_2026

  const cohorts = await getCohortAnalysis(campaignId)

  return json({
    success: true,
    cohorts,
  })
}
