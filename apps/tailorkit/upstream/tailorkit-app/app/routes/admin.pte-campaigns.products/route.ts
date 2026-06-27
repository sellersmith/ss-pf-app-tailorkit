import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import { authenticate } from '~/shopify/app.server'
import { getCampaignIntegrations } from '~/models/ShopCampaignStats.server'
import { CAMPAIGN_IDS } from '~/models/Promotion.define'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request)

  const url = new URL(request.url)
  const campaignId = url.searchParams.get('campaignId') ?? CAMPAIGN_IDS.PTE_VALENTINE_2026
  const shopDomain = url.searchParams.get('shopDomain') || undefined
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'))
  const limit = Math.min(100, Math.max(10, parseInt(url.searchParams.get('limit') ?? '50')))

  // Parse filter parameters
  const filters = {
    status: (url.searchParams.get('status') as 'published' | 'unpublished' | 'all') || 'all',
    lifecycleStage: (url.searchParams.get('lifecycle') as 'new' | 'active' | 'veteran' | 'churned' | 'all') || 'all',
    minDays: url.searchParams.get('minDays') ? parseInt(url.searchParams.get('minDays')!) : undefined,
    maxDays: url.searchParams.get('maxDays') ? parseInt(url.searchParams.get('maxDays')!) : undefined,
    dateFrom: url.searchParams.get('dateFrom') || null,
    dateTo: url.searchParams.get('dateTo') || null,
  }

  const result = await getCampaignIntegrations({
    campaignId,
    shopDomain,
    page,
    limit,
    filters,
  })

  return json({
    success: true,
    ...result,
  })
}
