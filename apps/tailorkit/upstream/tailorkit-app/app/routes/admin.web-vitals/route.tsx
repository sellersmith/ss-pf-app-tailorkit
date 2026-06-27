/* eslint-disable max-lines */
import type { LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import {
  Badge,
  BlockStack,
  Box,
  Card,
  Divider,
  IndexTable,
  InlineGrid,
  InlineStack,
  Page,
  Tabs,
  Text,
  Select,
  TextField,
  Button,
} from '@shopify/polaris'
import { useState, useEffect } from 'react'
import { json } from '~/bootstrap/fns/fetch.server'
import { getWebVitalsAggregatedByPage, getWebVitalsStats, getWorstPerformingPages } from '~/models/WebVitals.server'

interface PerformanceData {
  summary: Array<{
    type: string
    count: number
    average: number
    performanceRating: 'good' | 'needs-improvement' | 'poor'
  }>
  worstLcp: any[]
  worstCls: any[]
  worstFid: any[]
  pageAnalysis: any[]
  dateRange: {
    startDate: string
    endDate: string
    days: number
  }
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    // No authentication required - show global web vitals data from all shops
    const url = new URL(request.url)
    const daysParam = url.searchParams.get('days')
    const startDateParam = url.searchParams.get('startDate')
    const endDateParam = url.searchParams.get('endDate')

    // Default to last 7 days if no parameters provided
    const days = daysParam ? parseInt(daysParam) : 7

    let startDate: Date
    let endDate: Date

    if (startDateParam && endDateParam) {
      // Use custom date range if provided
      startDate = new Date(startDateParam)
      endDate = new Date(endDateParam)
    } else {
      // Use days-based range
      endDate = new Date()
      startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    }

    // Get summary for all metric types (all shops)
    const metricTypes: Array<'LCP' | 'CLS' | 'FID'> = ['LCP', 'CLS', 'FID']

    console.log(`[WebVitals Debug] Querying data for ALL SHOPS`)
    console.log(`[WebVitals Debug] Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`)

    const summary = await Promise.all(
      metricTypes.map(async metricType => {
        const stats = await getWebVitalsStats(undefined, {
          startDate,
          endDate,
          type: metricType,
          limit: 1000,
        })

        console.log(`[WebVitals Debug] ${metricType} stats found: ${stats.length} records`)
        if (stats.length > 0) {
          console.log(`[WebVitals Debug] First ${metricType} record:`, stats[0])
        }

        if (!stats.length) {
          return {
            type: metricType,
            count: 0,
            average: 0,
            performanceRating: 'good' as const,
          }
        }

        const values = stats.map((s: any) => s.value)
        const average = values.reduce((acc: number, val: number) => acc + val, 0) / values.length
        const performanceRating = getPerformanceRating(metricType, average)

        return {
          type: metricType,
          count: stats.length,
          average: Math.round(average),
          performanceRating,
        }
      })
    )

    // Get worst performing pages for each metric (all shops)
    const [worstLcp, worstCls, worstFid] = await Promise.all([
      getWorstPerformingPages(undefined, 'LCP', 10),
      getWorstPerformingPages(undefined, 'CLS', 10),
      getWorstPerformingPages(undefined, 'FID', 10),
    ])

    // Get page analysis (all shops)
    const aggregatedData = await getWebVitalsAggregatedByPage(undefined, {
      startDate,
      endDate,
    })

    const pageAnalysis = aggregatedData.map((item: any) => {
      const { _id, avgValue, minValue, maxValue, count, values } = item

      // Calculate percentiles from values
      const sortedValues = (values || []).sort((a: number, b: number) => a - b)
      const p95 = calculatePercentile(sortedValues, 95)

      // Determine performance rating
      const performanceRating = getPerformanceRating(_id.type, avgValue)

      return {
        id: `${_id.shopDomain}-${_id.pathname}-${_id.type}`,
        shopDomain: _id.shopDomain,
        pathname: _id.pathname,
        type: _id.type,
        metrics: {
          count,
          average: Math.round(avgValue),
          minimum: Math.round(minValue),
          maximum: Math.round(maxValue),
          p95: Math.round(p95),
        },
        performanceRating,
        isProblematic: performanceRating === 'poor',
      }
    })

    // Sort by performance impact (worse performance first)
    pageAnalysis.sort((a, b) => {
      if (a.performanceRating === 'poor' && b.performanceRating !== 'poor') return -1
      if (a.performanceRating !== 'poor' && b.performanceRating === 'poor') return 1
      return b.metrics.average - a.metrics.average
    })

    return json({
      summary,
      worstLcp,
      worstCls,
      worstFid,
      pageAnalysis: pageAnalysis.slice(0, 20), // Limit to top 20 for UI performance
      dateRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        days,
      },
    })
  } catch (error) {
    console.error('Error loading web vitals data:', error)
    return json({
      summary: [],
      worstLcp: [],
      worstCls: [],
      worstFid: [],
      pageAnalysis: [],
    })
  }
}

function calculatePercentile(values: number[], percentile: number): number {
  if (!values.length) return 0
  const index = Math.ceil((percentile / 100) * values.length) - 1
  return values[Math.max(0, index)] || 0
}

function getPerformanceRating(type: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const thresholds = {
    LCP: { good: 2500, poor: 4000 },
    CLS: { good: 0.1, poor: 0.25 },
    FID: { good: 100, poor: 300 },
  }

  const threshold = thresholds[type as keyof typeof thresholds]
  if (!threshold) return 'good'

  if (value <= threshold.good) return 'good'
  if (value <= threshold.poor) return 'needs-improvement'
  return 'poor'
}

function getPerformanceBadge(rating: 'good' | 'needs-improvement' | 'poor') {
  switch (rating) {
    case 'good':
      return <Badge tone="success">Good</Badge>
    case 'needs-improvement':
      return <Badge tone="attention">Needs Improvement</Badge>
    case 'poor':
      return <Badge tone="critical">Poor</Badge>
    default:
      return <Badge>Unknown</Badge>
  }
}

function getMetricDescription(type: string): string {
  switch (type) {
    case 'LCP':
      return 'Largest Contentful Paint - Time to render the largest visible element'
    case 'CLS':
      return 'Cumulative Layout Shift - Visual stability of the page'
    case 'FID':
      return 'First Input Delay - Time from first user interaction to response'
    default:
      return 'Performance metric'
  }
}

export default function WebVitalsAdmin() {
  const { summary, worstLcp, worstCls, worstFid, pageAnalysis, dateRange } = useLoaderData<PerformanceData>()
  const [selectedTab, setSelectedTab] = useState(0)
  const [dateRangeType, setDateRangeType] = useState('7')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [cleanupStats, setCleanupStats] = useState<any>(null)
  const [isLoadingCleanup, setIsLoadingCleanup] = useState(false)

  // Handle date range filtering
  const handleDateRangeChange = () => {
    setIsLoadingData(true)

    const params = new URLSearchParams()

    if (dateRangeType === 'custom') {
      if (customStartDate && customEndDate) {
        params.set('startDate', customStartDate)
        params.set('endDate', customEndDate)
      }
    } else {
      params.set('days', dateRangeType)
    }

    // Navigate to the same page with new parameters
    window.location.href = `/admin/web-vitals?${params.toString()}`
  }

  // Initialize date range type based on current data
  useEffect(() => {
    if (dateRange.days) {
      setDateRangeType(dateRange.days.toString())
    }
  }, [dateRange.days])

  // Cleanup functions
  const fetchCleanupStats = async () => {
    setIsLoadingCleanup(true)
    try {
      const response = await fetch('/api/web-vitals.cleanup')
      const data = await response.json()
      if (data.success) {
        setCleanupStats(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch cleanup stats:', error)
    } finally {
      setIsLoadingCleanup(false)
    }
  }

  const performDryRun = async (days: number) => {
    setIsLoadingCleanup(true)
    try {
      const response = await fetch('/api/web-vitals.cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dry-run', maxAgeDays: days }),
      })
      const result = await response.json()
      console.log('Dry run result:', result)
      alert(result.message)
      await fetchCleanupStats()
    } catch (error) {
      console.error('Failed to perform dry run:', error)
      alert('Failed to perform dry run')
    } finally {
      setIsLoadingCleanup(false)
    }
  }

  const performCleanup = async (days: number) => {
    if (
      !confirm(
        `Are you sure you want to delete all Web Vitals data older than ${days} days? This action cannot be undone.`
      )
    ) {
      return
    }

    setIsLoadingCleanup(true)
    try {
      const response = await fetch('/api/web-vitals.cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cleanup', maxAgeDays: days }),
      })
      const result = await response.json()
      console.log('Cleanup result:', result)
      alert(result.message)
      await fetchCleanupStats()
    } catch (error) {
      console.error('Failed to perform cleanup:', error)
      alert('Failed to perform cleanup')
    } finally {
      setIsLoadingCleanup(false)
    }
  }

  const tabs = [
    { id: 'overview', content: 'Overview' },
    { id: 'pages', content: 'Page Analysis' },
    { id: 'lcp', content: 'LCP Issues' },
    { id: 'cls', content: 'CLS Issues' },
    { id: 'fid', content: 'FID Issues' },
    { id: 'management', content: 'Database Management' },
  ]

  const renderDateRangeFilter = () => (
    <Card>
      <BlockStack gap="400">
        <Text variant="headingMd" as="h3">
          Date Range Filter
        </Text>

        <InlineStack blockAlign="end" gap="200">
          <Select
            label="Time Period"
            options={[
              { label: 'Last 24 Hours', value: '1' },
              { label: 'Last 7 Days', value: '7' },
              { label: 'Last 30 Days', value: '30' },
              { label: 'Last 90 Days', value: '90' },
              { label: 'Custom Range', value: 'custom' },
            ]}
            value={dateRangeType}
            onChange={setDateRangeType}
          />

          {dateRangeType === 'custom' && (
            <>
              <TextField
                label="Start Date"
                type="date"
                value={customStartDate}
                onChange={setCustomStartDate}
                autoComplete="off"
              />
              <TextField
                label="End Date"
                type="date"
                value={customEndDate}
                onChange={setCustomEndDate}
                autoComplete="off"
              />
            </>
          )}

          <Box>
            <Button variant="primary" onClick={handleDateRangeChange} loading={isLoadingData}>
              Apply Filter
            </Button>
          </Box>
        </InlineStack>

        <Text variant="bodySm" tone="subdued" as="p">
          Currently showing data from {new Date(dateRange.startDate).toLocaleDateString()} to{' '}
          {new Date(dateRange.endDate).toLocaleDateString()} ({dateRange.days} days)
        </Text>
      </BlockStack>
    </Card>
  )

  const renderOverview = () => (
    <BlockStack gap="400">
      <Text variant="headingLg" as="h2">
        Global Performance Summary (All Shops)
      </Text>

      <InlineGrid columns={{ xs: 1, sm: 2, md: 3 }} gap="400">
        {summary.map(metric => (
          <Card key={metric.type}>
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text variant="headingMd" as="h3">
                  {metric.type}
                </Text>
                {getPerformanceBadge(metric.performanceRating)}
              </InlineStack>

              <Text variant="bodyMd" tone="subdued" as="p">
                {getMetricDescription(metric.type)}
              </Text>

              <BlockStack gap="100">
                <InlineStack align="space-between">
                  <Text variant="bodySm" as="span">
                    Average:
                  </Text>
                  <Text variant="bodySm" as="span">
                    {metric.average}
                    {metric.type === 'CLS' ? '' : 'ms'}
                  </Text>
                </InlineStack>
                <InlineStack align="space-between">
                  <Text variant="bodySm" as="span">
                    Samples:
                  </Text>
                  <Text variant="bodySm" as="span">
                    {metric.count}
                  </Text>
                </InlineStack>
              </BlockStack>
            </BlockStack>
          </Card>
        ))}
      </InlineGrid>

      <Divider />
    </BlockStack>
  )

  const renderPageAnalysis = () => (
    <BlockStack gap="400">
      <Text variant="headingLg" as="h2">
        Global Page Performance Analysis (All Shops)
      </Text>

      <Card>
        <IndexTable
          resourceName={{ singular: 'page', plural: 'pages' }}
          itemCount={pageAnalysis.length}
          selectedItemsCount={0}
          onSelectionChange={() => {}}
          headings={[
            { title: 'Shop Domain' },
            { title: 'Page' },
            { title: 'Metric' },
            { title: 'Average' },
            { title: 'P95' },
            { title: 'Samples' },
            { title: 'Performance' },
          ]}
        >
          {pageAnalysis.map(page => (
            <IndexTable.Row id={page.id} key={page.id} position={pageAnalysis.indexOf(page)}>
              <IndexTable.Cell>
                <Text variant="bodyMd" as="span">
                  {page.shopDomain}
                </Text>
              </IndexTable.Cell>
              <IndexTable.Cell>
                <Text variant="bodyMd" fontWeight="medium" as="span">
                  {page.pathname}
                </Text>
              </IndexTable.Cell>
              <IndexTable.Cell>
                <Badge>{page.type}</Badge>
              </IndexTable.Cell>
              <IndexTable.Cell>
                {page.metrics.average}
                {page.type === 'CLS' ? '' : 'ms'}
              </IndexTable.Cell>
              <IndexTable.Cell>
                {page.metrics.p95}
                {page.type === 'CLS' ? '' : 'ms'}
              </IndexTable.Cell>
              <IndexTable.Cell>{page.metrics.count}</IndexTable.Cell>
              <IndexTable.Cell>{getPerformanceBadge(page.performanceRating)}</IndexTable.Cell>
            </IndexTable.Row>
          ))}
        </IndexTable>
      </Card>
    </BlockStack>
  )

  const renderWorstPages = (data: any[], type: string) => (
    <BlockStack gap="400">
      <Text variant="headingLg" as="h2">
        Worst {type} Performance (All Shops)
      </Text>

      {data.length === 0 ? (
        <Card>
          <Text as="p">No data available for {type} metrics.</Text>
        </Card>
      ) : (
        <Card>
          <IndexTable
            resourceName={{ singular: 'page', plural: 'pages' }}
            itemCount={data.length}
            selectedItemsCount={0}
            onSelectionChange={() => {}}
            headings={[
              { title: 'Shop Domain' },
              { title: 'Page' },
              { title: 'Average' },
              { title: 'P75' },
              { title: 'P90' },
              { title: 'P95' },
              { title: 'Max' },
              { title: 'Count' },
            ]}
          >
            {data.map((page, index) => (
              <IndexTable.Row id={`${type}-${index}`} key={`${type}-${index}`} position={index}>
                <IndexTable.Cell>
                  <Text variant="bodyMd" as="span">
                    {page.shopDomain}
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text variant="bodyMd" fontWeight="medium" as="span">
                    {page.pathname}
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  {page.avgValue}
                  {type === 'CLS' ? '' : 'ms'}
                </IndexTable.Cell>
                <IndexTable.Cell>
                  {page.p75 || 0}
                  {type === 'CLS' ? '' : 'ms'}
                </IndexTable.Cell>
                <IndexTable.Cell>
                  {page.p90 || 0}
                  {type === 'CLS' ? '' : 'ms'}
                </IndexTable.Cell>
                <IndexTable.Cell>
                  {page.p95 || 0}
                  {type === 'CLS' ? '' : 'ms'}
                </IndexTable.Cell>
                <IndexTable.Cell>
                  {page.maxValue}
                  {type === 'CLS' ? '' : 'ms'}
                </IndexTable.Cell>
                <IndexTable.Cell>{page.count}</IndexTable.Cell>
              </IndexTable.Row>
            ))}
          </IndexTable>
        </Card>
      )}
    </BlockStack>
  )

  const renderDatabaseManagement = () => (
    <BlockStack gap="400">
      <Text variant="headingLg" as="h2">
        Database Management & Cleanup
      </Text>

      <InlineStack gap="400">
        <Button variant="primary" onClick={fetchCleanupStats} loading={isLoadingCleanup}>
          Refresh Database Stats
        </Button>
      </InlineStack>

      {cleanupStats && (
        <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h3">
                Database Overview
              </Text>

              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text variant="bodySm" as="span">
                    Total Records:
                  </Text>
                  <Text variant="bodySm" fontWeight="medium" as="span">
                    {cleanupStats.totalRecords.toLocaleString()}
                  </Text>
                </InlineStack>

                <InlineStack align="space-between">
                  <Text variant="bodySm" as="span">
                    Estimated Size:
                  </Text>
                  <Text variant="bodySm" fontWeight="medium" as="span">
                    {cleanupStats.dbSizeEstimate}
                  </Text>
                </InlineStack>

                <InlineStack align="space-between">
                  <Text variant="bodySm" as="span">
                    Oldest Record:
                  </Text>
                  <Text variant="bodySm" as="span">
                    {cleanupStats.oldestRecord ? new Date(cleanupStats.oldestRecord).toLocaleDateString() : 'N/A'}
                  </Text>
                </InlineStack>

                <InlineStack align="space-between">
                  <Text variant="bodySm" as="span">
                    Newest Record:
                  </Text>
                  <Text variant="bodySm" as="span">
                    {cleanupStats.newestRecord ? new Date(cleanupStats.newestRecord).toLocaleDateString() : 'N/A'}
                  </Text>
                </InlineStack>
              </BlockStack>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h3">
                Records by Age
              </Text>

              <BlockStack gap="200">
                {cleanupStats.recordsByAge.map((item: any) => (
                  <InlineStack key={item.days} align="space-between">
                    <Text variant="bodySm" as="span">
                      Last {item.days} days:
                    </Text>
                    <Text variant="bodySm" fontWeight="medium" as="span">
                      {item.count.toLocaleString()}
                    </Text>
                  </InlineStack>
                ))}
              </BlockStack>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h3">
                Records by Metric Type
              </Text>

              <BlockStack gap="200">
                {cleanupStats.recordsByType.map((item: any) => (
                  <InlineStack key={item.type} align="space-between">
                    <Text variant="bodySm" as="span">
                      {item.type}:
                    </Text>
                    <Text variant="bodySm" fontWeight="medium" as="span">
                      {item.count.toLocaleString()}
                    </Text>
                  </InlineStack>
                ))}
              </BlockStack>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h3">
                Data Cleanup Actions
              </Text>

              <Text variant="bodySm" tone="subdued" as="p">
                Clean up old data to improve database performance. Always perform a dry run first!
              </Text>

              <BlockStack gap="200">
                <InlineStack gap="200">
                  <Button onClick={() => performDryRun(90)} loading={isLoadingCleanup}>
                    Dry Run (90 days)
                  </Button>
                  <Button tone="critical" onClick={() => performCleanup(90)} loading={isLoadingCleanup}>
                    Delete Data {'>'} 90 days
                  </Button>
                </InlineStack>

                <InlineStack gap="200">
                  <Button onClick={() => performDryRun(180)} loading={isLoadingCleanup}>
                    Dry Run (180 days)
                  </Button>
                  <Button tone="critical" onClick={() => performCleanup(180)} loading={isLoadingCleanup}>
                    Delete Data {'>'} 180 days
                  </Button>
                </InlineStack>

                <InlineStack gap="200">
                  <Button onClick={() => performDryRun(365)} loading={isLoadingCleanup}>
                    Dry Run (365 days)
                  </Button>
                  <Button tone="critical" onClick={() => performCleanup(365)} loading={isLoadingCleanup}>
                    Delete Data {'>'} 365 days
                  </Button>
                </InlineStack>
              </BlockStack>
            </BlockStack>
          </Card>
        </InlineGrid>
      )}

      {!cleanupStats && (
        <Card>
          <Text as="p">Click "Refresh Database Stats" to load database information.</Text>
        </Card>
      )}
    </BlockStack>
  )

  const renderTabContent = () => {
    switch (selectedTab) {
      case 0:
        return renderOverview()
      case 1:
        return renderPageAnalysis()
      case 2:
        return renderWorstPages(worstLcp, 'LCP')
      case 3:
        return renderWorstPages(worstCls, 'CLS')
      case 4:
        return renderWorstPages(worstFid, 'FID')
      case 5:
        return renderDatabaseManagement()
      default:
        return renderOverview()
    }
  }

  return (
    <Page
      title="Global Web Vitals Performance Monitoring"
      subtitle="Track and analyze Core Web Vitals performance across ALL shops and applications"
      backAction={{ content: 'Admin Dashboard', url: '/admin' }}
    >
      <BlockStack gap="500">
        {renderDateRangeFilter()}

        <Box>
          <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab} fitted />
        </Box>

        <Box paddingBlockStart="400">{renderTabContent()}</Box>
      </BlockStack>
    </Page>
  )
}
