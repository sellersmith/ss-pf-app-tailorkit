import type { LoaderFunctionArgs } from '@remix-run/node'
import { Link, useLoaderData, useLocation, useNavigate } from '@remix-run/react'
import {
  Badge,
  BlockStack,
  Box,
  Button,
  Card,
  IndexTable,
  InlineGrid,
  InlineStack,
  Page,
  Text,
  TextField,
} from '@shopify/polaris'
import { BarChart, LineChart, PolarisVizProvider, type DataSeries } from '@shopify/polaris-viz'
import polarisVizStyles from '@shopify/polaris-viz/build/esm/styles.css?url'
import { differenceInCalendarDays, format } from 'date-fns'
import React, { useMemo, useState } from 'react'
import { ClientOnly } from 'remix-utils/client-only'
import { json } from '~/bootstrap/fns/fetch.server'
import withTranslation from '~/bootstrap/hoc/withTranslation'
import ApiUsageLog, { ApiQuotaModel } from '~/models/ApiUsageLog.server'
import DateRangePicker, { type IDateRangePickerState } from '~/routes/analytics._index/components/DateRangePicker'
import { EOptionsComparing, NO_COMPARE_LABEL_KEY, todayRange } from '~/routes/analytics._index/constants'

export const links = () => [{ rel: 'stylesheet', href: polarisVizStyles }]

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url)

  const userId = url.searchParams.get('userId') ?? undefined

  // Parse ?start=YYYY-MM-DD&end=YYYY-MM-DD
  const startDateParam = url.searchParams.get('start')
  const endDateParam = url.searchParams.get('end')

  let endDate = endDateParam ? new Date(endDateParam) : new Date()
  let startDate = startDateParam ? new Date(startDateParam) : new Date()

  // If dates are invalid, fall back to last 30 days
  if (isNaN(endDate.getTime())) endDate = new Date()
  if (isNaN(startDate.getTime())) {
    startDate = new Date(endDate)
    startDate.setDate(endDate.getDate() - 6)
  }

  // Ensure start <= end; if not swap
  if (startDate > endDate) {
    const tmp = startDate
    startDate = endDate
    endDate = tmp
  }

  const [costSummary, dailyStats, quotas] = await Promise.all([
    ApiUsageLog.getCostSummary({ userId, startDate, endDate }),
    ApiUsageLog.getDailyStats({
      userId,
      // shopDomain,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      limit: 60,
    }),
    ApiQuotaModel.find({}).limit(50).lean(),
  ])

  const quotasSnapshot = quotas

  return json({
    costSummary,
    dailyStats,
    quotas,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    quotasSnapshot,
  })
}

type LoaderData = {
  costSummary: {
    totalCost: number
    totalTokens: number
    totalRequests: number
    mostExpensiveModel: string
  }
  dailyStats: any[]
  quotas: any[]
  startDate: string
  endDate: string
  quotasSnapshot: React.ReactNode[]
}

function calcTotal<T extends { [k: string]: any }>(arr: T[], field: keyof T) {
  return arr.reduce((sum, item) => sum + Number(item[field] || 0), 0)
}

function formatPercent(current: number, previous: number) {
  if (!previous) return '—'
  const diff = ((current - previous) / previous) * 100
  return `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`
}

function ApiUsageDashboard() {
  const {
    costSummary,
    dailyStats,
    startDate: startDateStr,
    endDate: endDateStr,
    quotasSnapshot,
  } = useLoaderData<LoaderData>()

  const DUMMY_PASSWORD = process.env.TAILORKIT_INTERNAL_ADMIN_PASSWORD || ''

  const initialDateRange: IDateRangePickerState = {
    startDate: new Date(startDateStr),
    endDate: new Date(endDateStr),
    label: 'Custom',
  }

  const navigate = useNavigate()
  const location = useLocation()

  const [dateRangePicker, _setDateRangePicker] = useState<IDateRangePickerState>(initialDateRange)

  // Authentication state
  const [authToken, setAuthToken] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('TK_ADMIN_AUTH') === 'true'
    }
    return false
  })

  const handleAuthenticate = () => {
    if (authToken === DUMMY_PASSWORD) {
      setIsAuthenticated(true)
      if (typeof window !== 'undefined') {
        localStorage.setItem('TK_ADMIN_AUTH', 'true')
      }
    }
  }

  const setDateRangePicker: React.Dispatch<React.SetStateAction<IDateRangePickerState>> = value => {
    const nextRange
      = typeof value === 'function'
        ? (value as (prev: IDateRangePickerState) => IDateRangePickerState)(dateRangePicker)
        : (value as IDateRangePickerState)
    _setDateRangePicker(nextRange)
    const params = new URLSearchParams(location.search)
    params.set('start', format(nextRange.startDate, 'yyyy-MM-dd'))
    params.set('end', format(nextRange.endDate, 'yyyy-MM-dd'))
    navigate(`${location.pathname}?${params.toString()}`)
  }

  // Dummy compared state (no comparison feature yet)
  const [compared, setCompared] = useState<{ startDate: Date; endDate: Date; label: string; value: string }>({
    ...todayRange,
    label: NO_COMPARE_LABEL_KEY,
    value: EOptionsComparing.NO_COMPARISON,
  })

  // Totals for previous period (only when comparing)
  const prevTotals = useMemo(() => {
    if (compared.value !== EOptionsComparing.PREVIOUS_PERIOD) return null

    const prevStats = dailyStats
      .filter((s: any) => s.date < format(new Date(startDateStr), 'yyyy-MM-dd'))
      .slice(-differenceInCalendarDays(new Date(endDateStr), new Date(startDateStr)) - 1)

    return {
      requests: calcTotal(prevStats, 'totalRequests'),
      tokens: calcTotal(prevStats, 'totalTokens'),
      cost: calcTotal(prevStats, 'totalCost'),
    }
  }, [compared, dailyStats, startDateStr, endDateStr])

  const requestsPerDay: DataSeries[] = useMemo(
    () => [
      {
        name: 'Total requests',
        data: dailyStats
          .slice()
          .reverse()
          .map((stat: any) => ({ key: stat.date, value: stat.totalRequests })),
      },
    ],
    [dailyStats]
  )

  const costPerDay: DataSeries[] = useMemo(() => {
    const current = {
      name: 'Total cost (USD)',
      data: dailyStats
        .filter(
          (s: any) =>
            s.date >= format(new Date(startDateStr), 'yyyy-MM-dd')
            && s.date <= format(new Date(endDateStr), 'yyyy-MM-dd')
        )
        .map((stat: any) => ({ key: stat.date, value: Math.round(stat.totalCost * 1e6) / 1e6 }))
        .reverse(),
    }

    if (compared.value === EOptionsComparing.PREVIOUS_PERIOD) {
      const prev = {
        name: 'Total cost (previous)',
        data: dailyStats
          .filter((s: any) => s.date < format(new Date(startDateStr), 'yyyy-MM-dd'))
          .slice(-current.data.length)
          .map((stat: any) => ({ key: stat.date, value: Math.round(stat.totalCost * 1e6) / 1e6 }))
          .reverse(),
      }
      return [current, prev]
    }

    return [current]
  }, [dailyStats, compared, startDateStr, endDateStr])

  const tokensPerDay: DataSeries[] = useMemo(() => {
    const current = {
      name: 'Total tokens',
      data: dailyStats
        .filter(
          (s: any) =>
            s.date >= format(new Date(startDateStr), 'yyyy-MM-dd')
            && s.date <= format(new Date(endDateStr), 'yyyy-MM-dd')
        )
        .map((stat: any) => ({ key: stat.date, value: stat.totalTokens }))
        .reverse(),
    }

    if (compared.value === EOptionsComparing.PREVIOUS_PERIOD) {
      const prev = {
        name: 'Total tokens (previous)',
        data: dailyStats
          .filter((s: any) => s.date < format(new Date(startDateStr), 'yyyy-MM-dd'))
          .slice(-current.data.length)
          .map((stat: any) => ({ key: stat.date, value: stat.totalTokens }))
          .reverse(),
      }
      return [current, prev]
    }
    return [current]
  }, [dailyStats, compared, startDateStr, endDateStr])

  // Quota rows
  const quotaRows = useMemo(() => {
    return quotasSnapshot.map((q: any, idx: number) => {
      const reqPct = Math.min((q.currentRequests / q.dailyRequestLimit) * 100, 999).toFixed(0)
      const detailUrl = `/admin/quotas?userId=${encodeURIComponent(q.userId)}&shopDomain=${encodeURIComponent(
        q.shopDomain || ''
      )}`

      return (
        <IndexTable.Row id={`${idx}`} position={idx} key={idx}>
          <IndexTable.Cell>
            <Link to={detailUrl}>{q.userId}</Link>
          </IndexTable.Cell>
          <IndexTable.Cell>{q.shopDomain || '—'}</IndexTable.Cell>
          <IndexTable.Cell>{`${q.currentRequests}/${q.dailyRequestLimit} (${reqPct}%)`}</IndexTable.Cell>
        </IndexTable.Row>
      )
    })
  }, [quotasSnapshot])

  // Render login screen if not authenticated
  if (!isAuthenticated) {
    return (
      <Page title="Admin Login" fullWidth>
        <Card>
          <BlockStack gap="400">
            <TextField
              label="Secret Token"
              value={authToken}
              type="password"
              autoComplete="off"
              onChange={value => setAuthToken(value)}
            />
            <InlineStack align="end">
              <Button variant="primary" onClick={handleAuthenticate} disabled={!authToken}>
                Enter
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>
      </Page>
    )
  }

  return (
    <div>
      {
        <ClientOnly fallback={<div>Loading...</div>}>
          {() => (
            <PolarisVizProvider>
              <Page title="API Usage" fullWidth backAction={{ content: 'Admin Dashboard', url: '/admin' }}>
                <BlockStack gap="400">
                  {/* Date range filter */}
                  <DateRangePicker
                    dateRangePicker={dateRangePicker}
                    setDateRangePicker={setDateRangePicker}
                    compared={compared}
                    setCompared={setCompared}
                  />

                  {/* Summary cards */}
                  <InlineGrid columns={{ xs: 1, md: 'repeat(4, 1fr)' }} gap="400">
                    <Card>
                      <Box padding="400">
                        <BlockStack gap="200">
                          <Text as="p" variant="headingXs">
                            Total Requests
                          </Text>
                          <InlineStack gap="200" blockAlign="center">
                            <Text as="h2" variant="headingLg">
                              {costSummary.totalRequests.toLocaleString()}
                            </Text>
                            {compared.value === EOptionsComparing.PREVIOUS_PERIOD && prevTotals && (
                              <Badge
                                tone={costSummary.totalRequests - prevTotals.requests >= 0 ? 'success' : 'critical'}
                              >
                                {formatPercent(costSummary.totalRequests, prevTotals.requests)}
                              </Badge>
                            )}
                          </InlineStack>
                        </BlockStack>
                      </Box>
                    </Card>
                    <Card>
                      <Box padding="400">
                        <BlockStack gap="200">
                          <Text as="p" variant="headingXs">
                            Total Tokens
                          </Text>
                          <Text as="h2" variant="headingLg">
                            {costSummary.totalTokens.toLocaleString()}
                          </Text>
                          {compared.value === EOptionsComparing.PREVIOUS_PERIOD && prevTotals && (
                            <Badge tone={costSummary.totalTokens - prevTotals.tokens >= 0 ? 'success' : 'critical'}>
                              {formatPercent(costSummary.totalTokens, prevTotals.tokens)}
                            </Badge>
                          )}
                        </BlockStack>
                      </Box>
                    </Card>
                    <Card>
                      <Box padding="400">
                        <BlockStack gap="200">
                          <Text as="p" variant="headingXs">
                            Total Cost (USD)
                          </Text>
                          <Text as="h2" variant="headingLg">
                            ${costSummary.totalCost.toFixed(4)}
                          </Text>
                          {compared.value === EOptionsComparing.PREVIOUS_PERIOD && prevTotals && (
                            <Badge tone={costSummary.totalCost - prevTotals.cost >= 0 ? 'success' : 'critical'}>
                              {formatPercent(costSummary.totalCost, prevTotals.cost)}
                            </Badge>
                          )}
                        </BlockStack>
                      </Box>
                    </Card>
                    <Card>
                      <Box padding="400">
                        <BlockStack gap="200">
                          <Text as="p" variant="headingXs">
                            Most Expensive Model
                          </Text>
                          <Text as="h2" variant="headingLg">
                            {costSummary.mostExpensiveModel || 'N/A'}
                          </Text>
                        </BlockStack>
                      </Box>
                    </Card>
                  </InlineGrid>

                  {/* Charts */}
                  <Card>
                    <Box padding="400">
                      <BlockStack gap="400">
                        <Text as="h3" variant="headingMd">
                          Requests per day
                        </Text>
                        <LineChart data={requestsPerDay} />
                      </BlockStack>
                    </Box>
                  </Card>

                  <InlineGrid columns={{ xs: 1, md: 'repeat(2, 1fr)' }} gap="400">
                    <Card>
                      <Box padding="400">
                        <BlockStack gap="400">
                          <Text as="h3" variant="headingMd">
                            Cost per day (USD)
                          </Text>
                          <LineChart data={costPerDay} />
                        </BlockStack>
                      </Box>
                    </Card>
                    <Card>
                      <Box padding="400">
                        <BlockStack gap="400">
                          <Text as="h3" variant="headingMd">
                            Tokens per day
                          </Text>
                          <BarChart data={tokensPerDay} />
                        </BlockStack>
                      </Box>
                    </Card>
                  </InlineGrid>

                  {/* Quotas Snapshot */}
                  <Card>
                    <BlockStack gap="200">
                      <Text variant="headingMd" as="h3">
                        Quotas (top 50)
                      </Text>
                      <IndexTable
                        itemCount={quotaRows.length}
                        selectable={false}
                        headings={[{ title: 'User' }, { title: 'Shop' }, { title: 'Requests today' }]}
                      >
                        {quotaRows}
                      </IndexTable>
                    </BlockStack>
                  </Card>
                </BlockStack>
              </Page>
            </PolarisVizProvider>
          )}
        </ClientOnly>
      }
    </div>
  )
}

export default withTranslation(ApiUsageDashboard)
