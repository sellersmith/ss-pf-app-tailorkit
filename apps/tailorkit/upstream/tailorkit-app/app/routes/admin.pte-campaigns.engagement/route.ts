import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import { authenticate } from '~/shopify/app.server'
import { getCampaignEngagementTimeSeries } from '~/models/ShopCampaignStats.server'
import { CAMPAIGN_IDS } from '~/models/Promotion.define'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request)

  const url = new URL(request.url)
  const campaignId = url.searchParams.get('campaignId') ?? CAMPAIGN_IDS.PTE_VALENTINE_2026

  const [timeSeriesData] = await getCampaignEngagementTimeSeries(campaignId)

  // Transform the facet results into a more usable format
  const publishMap = new Map(timeSeriesData.publishes.map((p: any) => [p._id, p.count]))
  const unpublishMap = new Map(timeSeriesData.unpublishes.map((u: any) => [u._id, u.count]))

  // Get all unique dates
  const allDates = new Set([
    ...timeSeriesData.publishes.map((p: any) => p._id),
    ...timeSeriesData.unpublishes.map((u: any) => u._id),
  ])

  // Combine into single array with all dates
  const data = Array.from(allDates)
    .sort()
    .map(date => ({
      date,
      published: publishMap.get(date) || 0,
      unpublished: unpublishMap.get(date) || 0,
      netChange: (publishMap.get(date) || 0) - (unpublishMap.get(date) || 0),
    }))

  // Calculate cumulative totalActive
  let runningTotal = 0
  const dataWithTotal = data.map(d => {
    runningTotal += d.netChange
    return {
      ...d,
      totalActive: runningTotal,
    }
  })

  return json({
    success: true,
    data: dataWithTotal,
  })
}
