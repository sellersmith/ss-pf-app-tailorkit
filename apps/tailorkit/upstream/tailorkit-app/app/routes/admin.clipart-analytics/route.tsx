import type { LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData, useNavigate, useNavigation, useRevalidator } from '@remix-run/react'
import { BlockStack, Box, Button, InlineStack, Page, Tabs } from '@shopify/polaris'
import { useState, useEffect } from 'react'
import { json } from '~/bootstrap/fns/fetch.server'
import { authenticate } from '~/shopify/app.server'
import ClipartClickEventModel from '~/models/ClipartClickEvent.server'
import type { AssetType } from '~/models/ClipartClickEvent'
import { getAssetNames } from '~/utils/getAssetName.server'
import ShopAssetAnalyticsModel from '~/models/ShopAssetAnalytics.server'
import { AnalyticsFilters } from './components/AnalyticsFilters'
import { AnalyticsOverview } from './components/AnalyticsOverview'
import { TopAssetsTable } from './components/TopAssetsTable'
import { TopShopsTable } from './components/TopShopsTable'
import { RecentActivityTable } from './components/RecentActivityTable'
import { exportSummary, exportTopAssets, exportTopShops, exportRecentActivity, exportAllData } from './utils/csvExport'

// MongoDB aggregation result interfaces
interface ClicksByContextAgg {
  _id: string
  count: number
}

interface TopAssetAgg {
  _id: {
    assetId: string
    assetType: AssetType
  }
  totalClicks: number
  uniqueShops: number
  contexts: string[]
}

interface TopShopAgg {
  _id: string
  totalClicks: number
  totalAssets: number
}

interface ClipartClickEventDoc {
  _id?: unknown
  assetId: string
  assetType: AssetType
  shopDomain: string
  clickedAt: Date
  context: string
  [key: string]: unknown
}

interface AnalyticsData {
  summary: {
    totalClicks: number
    totalAssets: number
    totalShops: number
    clicksByContext: Array<{ context: string; count: number }>
  }
  topAssets: Array<{
    assetId: string
    assetName: string
    assetType: AssetType
    totalClicks: number
    uniqueShops: number
    clicksByContext: Array<{ context: string; count: number }>
  }>
  topShops: Array<{
    shopDomain: string
    shopEmail?: string
    shopOwner?: string
    totalClicks: number
    totalAssets: number
  }>
  recentActivity: Array<{
    assetId: string
    assetName?: string
    assetType: AssetType
    shopDomain: string
    shopEmail?: string
    shopOwner?: string
    clickedAt: Date
    context: string
  }>
  dateRange: {
    startDate: string
    endDate: string
    days: number
  }
  excludeEmail: string
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await authenticate.admin(request)

    const url = new URL(request.url)
    const daysParam = url.searchParams.get('days')
    const startDateParam = url.searchParams.get('startDate')
    const endDateParam = url.searchParams.get('endDate')
    const excludeEmail = url.searchParams.get('excludeEmail')

    const days = daysParam ? parseInt(daysParam) : 7

    let startDate: Date
    let endDate: Date

    if (startDateParam && endDateParam) {
      startDate = new Date(startDateParam)
      endDate = new Date(endDateParam)
    } else {
      endDate = new Date()
      startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    }

    // Get summary statistics from ClipartClickEvent (date-filtered)
    const [totalAssetsResult, clicksByContextResult] = await Promise.all([
      ClipartClickEventModel.distinct('assetId', {
        clickedAt: { $gte: startDate, $lte: endDate },
      }),
      ClipartClickEventModel.aggregate([
        { $match: { clickedAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: '$context',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),
    ])

    const clicksByContext = clicksByContextResult.map((item: ClicksByContextAgg) => ({
      context: item._id || 'unknown',
      count: item.count,
    }))

    // Get top clicked assets (from events in date range)
    const topAssetsAgg = await ClipartClickEventModel.aggregate([
      { $match: { clickedAt: { $gte: startDate, $lte: endDate } } },
      {
        $group: {
          _id: { assetId: '$assetId', assetType: '$assetType' },
          totalClicks: { $sum: 1 },
          uniqueShops: { $addToSet: '$shopDomain' },
          contexts: { $push: '$context' },
        },
      },
      {
        $project: {
          _id: 1,
          totalClicks: 1,
          uniqueShops: { $size: '$uniqueShops' },
          contexts: 1,
        },
      },
      { $sort: { totalClicks: -1 } },
      { $limit: 20 },
    ])

    // Get asset names for top assets
    const topAssetsWithTypes = topAssetsAgg.map((item: TopAssetAgg) => ({
      id: item._id.assetId,
      type: item._id.assetType,
    }))
    const topAssetNamesMap = getAssetNames(topAssetsWithTypes)

    const topAssets = topAssetsAgg.map((item: TopAssetAgg) => {
      // Count clicks by context
      const contextCounts: Record<string, number> = {}
      item.contexts.forEach((context: string) => {
        contextCounts[context] = (contextCounts[context] || 0) + 1
      })

      const clicksByContext = Object.entries(contextCounts)
        .map(([context, count]) => ({ context, count }))
        .sort((a, b) => b.count - a.count)

      return {
        assetId: item._id.assetId,
        assetName: topAssetNamesMap.get(item._id.assetId) || 'Deleted',
        assetType: item._id.assetType,
        totalClicks: item.totalClicks,
        uniqueShops: item.uniqueShops,
        clicksByContext,
      }
    })

    // Get top shops by activity (from events in date range)
    const topShopsAgg = await ClipartClickEventModel.aggregate([
      { $match: { clickedAt: { $gte: startDate, $lte: endDate } } },
      {
        $group: {
          _id: '$shopDomain',
          totalClicks: { $sum: 1 },
          uniqueAssets: { $addToSet: '$assetId' },
        },
      },
      {
        $project: {
          _id: 1,
          totalClicks: 1,
          totalAssets: { $size: '$uniqueAssets' },
        },
      },
      { $sort: { totalClicks: -1 } },
      { $limit: 20 },
    ])

    // Batch fetch shop email/owner from ShopAssetAnalytics
    const shopDomains = topShopsAgg.map(shop => shop._id)
    const shopAnalytics = await ShopAssetAnalyticsModel.find({
      shopDomain: { $in: shopDomains },
    }).lean()

    const shopInfoMap = new Map(shopAnalytics.map(shop => [shop.shopDomain, shop]))

    const topShops = topShopsAgg.map((item: TopShopAgg) => ({
      shopDomain: item._id,
      shopEmail: shopInfoMap.get(item._id)?.shopEmail || '-',
      shopOwner: shopInfoMap.get(item._id)?.shopOwner || '-',
      totalClicks: item.totalClicks,
      totalAssets: item.totalAssets,
    }))

    // Get recent activity
    const recentActivity = await ClipartClickEventModel.find({
      clickedAt: { $gte: startDate, $lte: endDate },
    })
      .sort({ clickedAt: -1 })
      .limit(50)
      .lean()

    // Get asset names for recent activity
    const recentAssetsWithTypes = (recentActivity as unknown as ClipartClickEventDoc[]).map(e => ({
      id: e.assetId,
      type: e.assetType,
    }))
    const recentAssetNamesMap = getAssetNames(recentAssetsWithTypes)

    // Batch fetch shop info for recent activity
    const recentShopDomains = Array.from(
      new Set((recentActivity as unknown as ClipartClickEventDoc[]).map(e => e.shopDomain))
    )
    const recentShopAnalytics = await ShopAssetAnalyticsModel.find({
      shopDomain: { $in: recentShopDomains },
    }).lean()

    const recentShopInfoMap = new Map(recentShopAnalytics.map(shop => [shop.shopDomain, shop]))

    // Filter function for email exclusion
    const shouldExcludeShop = (shopEmail?: string) => {
      if (!shopEmail || shopEmail === '-') return false
      if (!excludeEmail || excludeEmail.trim() === '') return false
      return shopEmail.includes(excludeEmail.trim())
    }

    // Apply filter to topShops
    const filteredTopShops = topShops.filter(shop => !shouldExcludeShop(shop.shopEmail))

    // Apply filter to recentActivity and add shop info
    const recentActivityWithShopInfo = (recentActivity as unknown as ClipartClickEventDoc[]).map(event => ({
      assetId: event.assetId,
      assetName: recentAssetNamesMap.get(event.assetId) || 'Deleted',
      assetType: event.assetType,
      shopDomain: event.shopDomain,
      shopEmail: recentShopInfoMap.get(event.shopDomain)?.shopEmail || '-',
      shopOwner: recentShopInfoMap.get(event.shopDomain)?.shopOwner || '-',
      clickedAt: event.clickedAt,
      context: event.context,
    }))

    const filteredRecentActivity = recentActivityWithShopInfo.filter(event => !shouldExcludeShop(event.shopEmail))

    // Recalculate summary stats without excluded shops
    const excludedShopDomains = new Set(
      topShops.filter(shop => shouldExcludeShop(shop.shopEmail)).map(shop => shop.shopDomain)
    )

    const filteredClicksCount = await ClipartClickEventModel.countDocuments({
      clickedAt: { $gte: startDate, $lte: endDate },
      shopDomain: { $nin: Array.from(excludedShopDomains) },
    })

    const filteredTotalShops = await ClipartClickEventModel.distinct('shopDomain', {
      clickedAt: { $gte: startDate, $lte: endDate },
      shopDomain: { $nin: Array.from(excludedShopDomains) },
    })

    return json({
      summary: {
        totalClicks: filteredClicksCount,
        totalAssets: totalAssetsResult.length,
        totalShops: filteredTotalShops.length,
        clicksByContext,
      },
      topAssets,
      topShops: filteredTopShops,
      recentActivity: filteredRecentActivity,
      dateRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        days,
      },
      excludeEmail,
    })
  } catch (error) {
    console.error('Error loading clipart analytics:', error)
    return json({
      summary: {
        totalClicks: 0,
        totalAssets: 0,
        totalShops: 0,
        clicksByContext: [],
      },
      topAssets: [],
      topShops: [],
      recentActivity: [],
      dateRange: {
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        days: 7,
      },
      excludeEmail: '@bravebits.vn',
    })
  }
}

const buildUrl = (params: URLSearchParams) => `/admin/clipart-analytics?${params.toString()}`

export default function ClipartAnalyticsAdmin() {
  const { summary, topAssets, topShops, recentActivity, dateRange, excludeEmail } = useLoaderData<AnalyticsData>()
  const navigate = useNavigate()
  const navigation = useNavigation()
  const revalidator = useRevalidator()
  const [selectedTab, setSelectedTab] = useState(0)
  const [dateRangeType, setDateRangeType] = useState('7')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [excludeEmailInput, setExcludeEmailInput] = useState('@bravebits.vn')

  const isLoadingData = navigation.state === 'loading' || revalidator.state === 'loading'

  useEffect(() => {
    if (excludeEmail) {
      setExcludeEmailInput(excludeEmail)
    }
  }, [excludeEmail])

  useEffect(() => {
    if (dateRange.days) {
      setDateRangeType(dateRange.days.toString())
    }
  }, [dateRange.days])

  const handleApplyFilters = () => {
    const params = new URLSearchParams()
    if (dateRangeType === 'custom' && customStartDate && customEndDate) {
      params.set('startDate', customStartDate)
      params.set('endDate', customEndDate)
    } else {
      params.set('days', dateRangeType)
    }
    if (excludeEmailInput) {
      params.set('excludeEmail', excludeEmailInput)
    }
    const newUrl = buildUrl(params)
    const currentUrl = buildUrl(new URLSearchParams(window.location.search))
    newUrl === currentUrl ? revalidator.revalidate() : navigate(newUrl)
  }

  const handleExportCurrentTab = () => {
    switch (selectedTab) {
      case 1: // Top Assets
        exportTopAssets(topAssets)
        break
      case 2: // Top Shops
        exportTopShops(topShops)
        break
      case 3: // Recent Activity
        exportRecentActivity(recentActivity)
        break
      default: // Overview
        exportSummary(summary)
    }
  }

  const handleExportAllData = () => {
    exportAllData(summary, topAssets, topShops)
  }

  const renderExportButtons = () => (
    <InlineStack gap="200">
      <Button onClick={handleExportCurrentTab}>Export Current Tab</Button>
      <Button onClick={handleExportAllData} variant="secondary">
        Export All Data
      </Button>
    </InlineStack>
  )

  const tabs = [
    { id: 'overview', content: 'Overview' },
    { id: 'assets', content: 'Top Assets' },
    { id: 'shops', content: 'Top Shops' },
    { id: 'activity', content: 'Recent Activity' },
  ]

  const renderTabContent = () => {
    switch (selectedTab) {
      case 1:
        return <TopAssetsTable assets={topAssets} />
      case 2:
        return <TopShopsTable shops={topShops} />
      case 3:
        return <RecentActivityTable events={recentActivity} />
      default:
        return <AnalyticsOverview summary={summary} />
    }
  }

  return (
    <Page
      fullWidth
      title="Clipart Analytics Dashboard"
      subtitle="Track and analyze clipart usage across all shops and applications"
      backAction={{ content: 'Admin Dashboard', url: '/admin' }}
      primaryAction={renderExportButtons()}
    >
      <BlockStack gap="500">
        <AnalyticsFilters
          dateRangeType={dateRangeType}
          onDateRangeTypeChange={setDateRangeType}
          customStartDate={customStartDate}
          onCustomStartDateChange={setCustomStartDate}
          customEndDate={customEndDate}
          onCustomEndDateChange={setCustomEndDate}
          excludeEmailInput={excludeEmailInput}
          onExcludeEmailChange={setExcludeEmailInput}
          onApplyFilters={handleApplyFilters}
          isLoading={isLoadingData}
          currentDateRange={dateRange}
          currentExcludeEmail={excludeEmail}
        />

        <Box>
          <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab} fitted />
        </Box>

        {renderTabContent()}
      </BlockStack>
    </Page>
  )
}
