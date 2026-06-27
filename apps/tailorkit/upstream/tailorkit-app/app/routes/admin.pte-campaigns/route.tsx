import type { LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData, useNavigate, useNavigation } from '@remix-run/react'
import {
  BlockStack,
  Button,
  Card,
  InlineGrid,
  Page,
  Pagination,
  SkeletonBodyText,
  SkeletonDisplayText,
  SkeletonPage,
  Text,
} from '@shopify/polaris'
import { useState, useEffect } from 'react'
import { json } from '~/bootstrap/fns/fetch.server'
import { authenticate } from '~/shopify/app.server'
import Promotion from '~/models/Promotion.server'
import { CAMPAIGN_IDS } from '~/models/Promotion.define'
import Shop from '~/models/Shop.server'
import ShopCampaignStats, { getCampaignAnalytics } from '~/models/ShopCampaignStats.server'
import { CampaignHeader } from './components/CampaignHeader'
import { SummaryCards } from './components/SummaryCards'
import { BadgeDistribution } from './components/BadgeDistribution'
import { StoresTable } from './components/StoresTable'
import { ConversionFunnel } from './components/ConversionFunnel'
import { EngagementChart } from './components/EngagementChart'
import { CohortAnalysisTable } from './components/CohortAnalysisTable'
import type { BadgeBucket } from '~/types/campaign-analytics'
import { PTE_BADGE_THRESHOLDS } from '~/bootstrap/constants/achievements'
import { exportAllCampaignData } from './utils/csvExport'

interface ParticipatingStore {
  shopDomain: string
  shopEmail?: string
  currentPublishedCount: number
  peakPublishedCount: number
  firstPublishedAt?: Date
  lastPublishedAt?: Date
  daysSinceLastPublish?: number | null
  isActive?: boolean
  daysToFirstPublish?: number | null
  engagementSpan?: number
  shopCreatedAt?: Date
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request)

  const url = new URL(request.url)
  const campaignId = url.searchParams.get('campaignId') ?? CAMPAIGN_IDS.PTE_VALENTINE_2026
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'))
  const limit = 100 // Items per page
  const skip = (page - 1) * limit

  // Get campaign info from promotions
  const campaignPromotion = await Promotion.findOne({ campaignId })
  if (!campaignPromotion) {
    return json({
      campaignInfo: null,
      allCampaigns: [],
      participatingStores: [],
      selectedCampaign: campaignId,
      stats: null,
      totalActiveStores: 0,
      funnelMetrics: { noBadge: 0, creatorOnly: 0, artisanOnly: 0, master: 0 },
      activityMetrics: { activeCount: 0, dormantCount: 0 },
      timeMetrics: { avgDaysToFirstPublish: '0', avgEngagementSpan: '0' },
      pagination: { currentPage: 1, totalPages: 0, totalStores: 0, pageSize: limit },
    })
  }

  const allCampaigns = await Promotion.find({
    name: { $regex: /^Publish to Earn -/i },
    campaignId: { $exists: true },
  }).distinct('campaignId')

  // Calculate REAL-TIME analytics directly from ShopCampaignStats
  try {
    const campaignAnalytics = await getCampaignAnalytics(campaignId)

    // Cast to proper type and use constants for thresholds
    const badgeDistribution = campaignAnalytics.badgeDistribution as BadgeBucket[]

    const stats = {
      totalParticipatingStores: campaignAnalytics.overview[0]?.totalParticipatingStores || 0,
      totalPublishedProducts: campaignAnalytics.overview[0]?.totalPublishedProducts || 0,
      badgeDistribution: {
        creator: badgeDistribution
          .filter(b => typeof b._id === 'number' && b._id >= PTE_BADGE_THRESHOLDS.CREATOR)
          .reduce((sum, b) => sum + b.count, 0),
        artisan: badgeDistribution
          .filter(b => typeof b._id === 'number' && b._id >= PTE_BADGE_THRESHOLDS.ARTISAN)
          .reduce((sum, b) => sum + b.count, 0),
        master: badgeDistribution
          .filter(b => typeof b._id === 'number' && b._id >= PTE_BADGE_THRESHOLDS.MASTER)
          .reduce((sum, b) => sum + b.count, 0),
      },
    }

    // Get total count for pagination
    const totalCount = await ShopCampaignStats.countDocuments({
      campaignId,
      peakPublishedCount: { $gte: 1 },
    })

    // Query ShopCampaignStats collection for participating stores
    // ✅ Lookup Shop.createdAt to calculate days to first publish
    const participatingStores = await ShopCampaignStats.aggregate([
      {
        $match: {
          campaignId,
          peakPublishedCount: { $gte: 1 },
        },
      },
      {
        $lookup: {
          from: 'shops',
          localField: 'shopDomain',
          foreignField: 'shopDomain',
          as: 'shop',
        },
      },
      {
        $unwind: {
          path: '$shop',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 0,
          shopDomain: 1,
          shopEmail: '$shop.shopConfig.email',
          currentPublishedCount: 1,
          peakPublishedCount: 1,
          firstPublishedAt: 1,
          lastPublishedAt: 1,
          shopCreatedAt: '$shop.createdAt', // Get install date from Shop collection
        },
      },
      { $sort: { peakPublishedCount: -1 } },
      { $skip: skip },
      { $limit: limit },
    ])

    // Calculate total active stores for participation rate
    const totalActiveStores = await Shop.countDocuments({
      uninstalledAt: null,
      createdAt: { $lte: campaignPromotion.endAt },
    })

    // Calculate activity status and time metrics for each store
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const storesWithActivity = participatingStores.map(store => {
      const daysSinceLastPublish = store.lastPublishedAt
        ? Math.floor((now.getTime() - new Date(store.lastPublishedAt).getTime()) / (24 * 60 * 60 * 1000))
        : null

      const isActive = store.lastPublishedAt && new Date(store.lastPublishedAt) >= sevenDaysAgo

      // Calculate days to first publish from the LATER of: campaign start OR shop install date
      // This ensures we don't get negative numbers for shops installed after campaign launch
      const referenceDate
        = store.shopCreatedAt && new Date(store.shopCreatedAt) > new Date(campaignPromotion.startAt)
          ? new Date(store.shopCreatedAt)
          : new Date(campaignPromotion.startAt)

      const daysToFirstPublish = store.firstPublishedAt
        ? Math.floor((new Date(store.firstPublishedAt).getTime() - referenceDate.getTime()) / (24 * 60 * 60 * 1000))
        : null

      // Calculate engagement span using calendar days (not 24h periods)
      // This ensures 12/30 to 12/31 = 1 day, regardless of exact hours
      const engagementSpan
        = store.firstPublishedAt && store.lastPublishedAt
          ? (() => {
              const firstDay = new Date(store.firstPublishedAt)
              firstDay.setHours(0, 0, 0, 0)
              const lastDay = new Date(store.lastPublishedAt)
              lastDay.setHours(0, 0, 0, 0)
              return Math.floor((lastDay.getTime() - firstDay.getTime()) / (24 * 60 * 60 * 1000))
            })()
          : 0

      return {
        ...store,
        daysSinceLastPublish,
        isActive,
        daysToFirstPublish,
        engagementSpan,
      }
    })

    // Calculate funnel metrics
    const noBadge = storesWithActivity.filter(s => s.peakPublishedCount < PTE_BADGE_THRESHOLDS.CREATOR).length
    const creatorOnly = storesWithActivity.filter(
      s => s.peakPublishedCount >= PTE_BADGE_THRESHOLDS.CREATOR && s.peakPublishedCount < PTE_BADGE_THRESHOLDS.ARTISAN
    ).length
    const artisanOnly = storesWithActivity.filter(
      s => s.peakPublishedCount >= PTE_BADGE_THRESHOLDS.ARTISAN && s.peakPublishedCount < PTE_BADGE_THRESHOLDS.MASTER
    ).length
    const master = stats.badgeDistribution.master

    // Calculate activity metrics
    const activeCount = storesWithActivity.filter(s => s.isActive).length
    const dormantCount = storesWithActivity.length - activeCount

    // Calculate time metrics
    const storesWithFirstPublish = storesWithActivity.filter(s => s.daysToFirstPublish !== null)
    const avgDaysToFirstPublish
      = storesWithFirstPublish.length > 0
        ? storesWithFirstPublish.reduce((sum, s) => sum + (s.daysToFirstPublish || 0), 0)
          / storesWithFirstPublish.length
        : 0

    const avgEngagementSpan
      = storesWithActivity.length > 0
        ? storesWithActivity.reduce((sum, s) => sum + s.engagementSpan, 0) / storesWithActivity.length
        : 0

    return json({
      campaignInfo: {
        campaignId,
        campaignName: campaignPromotion.name,
        startAt: campaignPromotion.startAt,
        endAt: campaignPromotion.endAt,
        lastCalculatedAt: new Date(),
      },
      stats,
      allCampaigns,
      participatingStores: storesWithActivity as ParticipatingStore[],
      selectedCampaign: campaignId,
      totalActiveStores,
      funnelMetrics: {
        noBadge,
        creatorOnly,
        artisanOnly,
        master,
      },
      activityMetrics: {
        activeCount,
        dormantCount,
      },
      timeMetrics: {
        avgDaysToFirstPublish: avgDaysToFirstPublish.toFixed(1),
        avgEngagementSpan: avgEngagementSpan.toFixed(1),
      },
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalStores: totalCount,
        pageSize: limit,
      },
    })
  } catch (error) {
    console.error('[PTE Admin] Failed to load campaign analytics:', error)
    return json({
      campaignInfo: null,
      allCampaigns,
      participatingStores: [],
      selectedCampaign: campaignId,
      stats: null,
      totalActiveStores: 0,
      funnelMetrics: { noBadge: 0, creatorOnly: 0, artisanOnly: 0, master: 0 },
      activityMetrics: { activeCount: 0, dormantCount: 0 },
      timeMetrics: { avgDaysToFirstPublish: '0', avgEngagementSpan: '0' },
      pagination: { currentPage: 1, totalPages: 0, totalStores: 0, pageSize: limit },
    })
  }
}

export default function AdminPTECampaigns() {
  const navigate = useNavigate()
  const navigation = useNavigation()
  const {
    campaignInfo,
    stats,
    allCampaigns,
    participatingStores,
    selectedCampaign,
    totalActiveStores,
    funnelMetrics,
    activityMetrics,
    pagination,
  } = useLoaderData<typeof loader>()

  const [isAuthenticated] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('TK_ADMIN_AUTH') === 'true'
    }
    return false
  })

  const [cohorts, setCohorts] = useState<any[]>([])
  const [integrations, setIntegrations] = useState<any[]>([])

  // Fetch cohorts data for CSV export
  useEffect(() => {
    fetch(`/admin/pte-campaigns/cohorts?campaignId=${selectedCampaign}`)
      .then(res => res.json())
      .then(response => {
        if (response.success && response.cohorts) {
          setCohorts(response.cohorts)
        }
      })
      .catch(err => {
        console.error('Failed to load cohorts for export:', err)
      })
  }, [selectedCampaign])

  // Fetch integrations data for CSV export
  useEffect(() => {
    fetch(`/admin/pte-campaigns/products?campaignId=${selectedCampaign}`)
      .then(res => res.json())
      .then(response => {
        if (response.success && response.integrations) {
          setIntegrations(response.integrations)
        }
      })
      .catch(err => {
        console.error('Failed to load integrations for export:', err)
      })
  }, [selectedCampaign])

  const isLoading = navigation.state === 'loading'

  if (!isAuthenticated) {
    return (
      <Page title="Admin Login Required" fullWidth>
        <Card>
          <BlockStack gap="400">
            <Text as="p">You need to authenticate to view this page.</Text>
            <Button onClick={() => navigate('/admin')}>Go to Admin Login</Button>
          </BlockStack>
        </Card>
      </Page>
    )
  }

  if (isLoading) {
    return (
      <Page title="PTE Campaign Analytics" fullWidth backAction={{ content: 'Admin', url: '/admin' }}>
        <SkeletonPage primaryAction>
          <BlockStack gap="400">
            <SkeletonDisplayText size="small" />
            <SkeletonBodyText lines={3} />
            <SkeletonBodyText lines={3} />
            <SkeletonBodyText lines={3} />
          </BlockStack>
        </SkeletonPage>
      </Page>
    )
  }

  if (!campaignInfo || !stats) {
    return (
      <Page title="PTE Campaign Analytics" fullWidth backAction={{ url: '/admin' }}>
        <Card>
          <Text as="p">Campaign not found</Text>
        </Card>
      </Page>
    )
  }

  const avgProductsPerStore
    = participatingStores.length > 0 ? (stats.totalPublishedProducts / participatingStores.length).toFixed(1) : '0'

  const participationRate
    = totalActiveStores > 0 ? ((participatingStores.length / totalActiveStores) * 100).toFixed(1) : '0'

  return (
    <Page
      title="PTE Campaign Analytics"
      fullWidth
      backAction={{ content: 'Admin', url: '/admin' }}
      primaryAction={{
        content: 'Export Data (CSV)',
        onAction: () => {
          exportAllCampaignData(participatingStores, integrations, cohorts)
        },
      }}
    >
      <BlockStack gap="400">
        <CampaignHeader
          selectedCampaign={selectedCampaign}
          allCampaigns={allCampaigns}
          lastCalculatedAt={campaignInfo.lastCalculatedAt}
          startAt={campaignInfo.startAt}
          endAt={campaignInfo.endAt}
        />
        <SummaryCards
          totalParticipatingStores={stats.totalParticipatingStores}
          totalPublishedProducts={stats.totalPublishedProducts}
          avgProductsPerStore={avgProductsPerStore}
          startAt={campaignInfo.startAt}
          endAt={campaignInfo.endAt}
          totalActiveStores={totalActiveStores}
          participationRate={participationRate}
          activeCount={activityMetrics.activeCount}
          dormantCount={activityMetrics.dormantCount}
        />
        <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
          <ConversionFunnel
            totalParticipating={participatingStores.length}
            noBadge={funnelMetrics.noBadge}
            creatorOnly={funnelMetrics.creatorOnly}
            artisanOnly={funnelMetrics.artisanOnly}
            master={funnelMetrics.master}
          />
          <BadgeDistribution
            creator={stats.badgeDistribution.creator}
            artisan={stats.badgeDistribution.artisan}
            master={stats.badgeDistribution.master}
          />
        </InlineGrid>

        {/* Analytics Charts */}
        <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
          <EngagementChart campaignId={selectedCampaign} />
          <CohortAnalysisTable campaignId={selectedCampaign} />
        </InlineGrid>

        <StoresTable stores={participatingStores} campaignId={selectedCampaign} />
        {pagination.totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
            <Pagination
              hasPrevious={pagination.currentPage > 1}
              onPrevious={() => {
                const newPage = pagination.currentPage - 1
                navigate(`?campaignId=${selectedCampaign}&page=${newPage}`)
              }}
              hasNext={pagination.currentPage < pagination.totalPages}
              onNext={() => {
                const newPage = pagination.currentPage + 1
                navigate(`?campaignId=${selectedCampaign}&page=${newPage}`)
              }}
              label={`Page ${pagination.currentPage} of ${pagination.totalPages}`}
            />
          </div>
        )}
      </BlockStack>
    </Page>
  )
}
