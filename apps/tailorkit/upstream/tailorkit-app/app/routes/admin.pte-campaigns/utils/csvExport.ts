interface Store {
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

interface CampaignIntegration {
  _id: string
  title: string
  shopDomain: string
  publishedAt: Date | null
  unpublishedAt?: Date | null
  daysActive: number
  lifecycleStage: string
  status: string
}

interface CohortData {
  _id: string // cohortWeek
  totalStarts: number
  stillActive: number
  retentionRate: number
  avgDaysActive: number
  shops: string[]
}

/**
 * Convert array of objects to CSV format
 */
function convertToCSV(data: any[], headers: string[]): string {
  const headerRow = headers.join(',')
  const rows = data.map(row =>
    headers
      .map(header => {
        const value = row[header] ?? ''
        const stringValue = String(value)
        // Escape values containing commas, quotes, or newlines
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`
        }
        return stringValue
      })
      .join(',')
  )
  return [headerRow, ...rows].join('\n')
}

/**
 * Download CSV file to user's computer
 */
function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Format date to YYYY-MM-DD
 */
function formatDate(date?: Date | null): string {
  if (!date) return '-'
  const d = new Date(date)
  return d.toISOString().split('T')[0]
}

/**
 * Export stores data to CSV
 */
export function exportStoresData(stores: Store[]): void {
  const csvContent = convertToCSV(
    stores.map(store => ({
      shopDomain: store.shopDomain,
      shopEmail: store.shopEmail || '-',
      currentPublishedCount: store.currentPublishedCount,
      peakPublishedCount: store.peakPublishedCount,
      firstPublishedAt: formatDate(store.firstPublishedAt),
      lastPublishedAt: formatDate(store.lastPublishedAt),
      daysSinceLastPublish: store.daysSinceLastPublish ?? '-',
      status: store.isActive ? 'Active' : 'Dormant',
      daysToFirstPublish: store.daysToFirstPublish ?? '-',
      engagementSpan: store.engagementSpan ?? '-',
      shopCreatedAt: formatDate(store.shopCreatedAt),
    })),
    [
      'shopDomain',
      'shopEmail',
      'currentPublishedCount',
      'peakPublishedCount',
      'firstPublishedAt',
      'lastPublishedAt',
      'daysSinceLastPublish',
      'status',
      'daysToFirstPublish',
      'engagementSpan',
      'shopCreatedAt',
    ]
  )
  const filename = `pte-campaign-stores-${new Date().toISOString().split('T')[0]}.csv`
  downloadCSV(csvContent, filename)
}

/**
 * Export products data to CSV
 */
export function exportProductsData(integrations: CampaignIntegration[]): void {
  const csvContent = convertToCSV(
    integrations.map(integration => ({
      title: integration.title,
      shopDomain: integration.shopDomain,
      status: integration.status,
      publishedAt: formatDate(integration.publishedAt),
      unpublishedAt: formatDate(integration.unpublishedAt),
      daysActive: integration.daysActive,
      lifecycleStage: integration.lifecycleStage,
    })),
    ['title', 'shopDomain', 'status', 'publishedAt', 'unpublishedAt', 'daysActive', 'lifecycleStage']
  )
  const filename = `pte-campaign-products-${new Date().toISOString().split('T')[0]}.csv`
  downloadCSV(csvContent, filename)
}

/**
 * Export cohort analysis data to CSV
 */
export function exportCohortsData(cohorts: CohortData[]): void {
  const csvContent = convertToCSV(
    cohorts.map(cohort => ({
      cohortWeek: cohort._id,
      totalStarts: cohort.totalStarts,
      stillActive: cohort.stillActive,
      retentionRate: cohort.retentionRate !== null ? cohort.retentionRate.toFixed(2) : '0',
      avgDaysActive: cohort.avgDaysActive !== null ? cohort.avgDaysActive.toFixed(1) : '0',
      shopCount: cohort.shops.length,
    })),
    ['cohortWeek', 'totalStarts', 'stillActive', 'retentionRate', 'avgDaysActive', 'shopCount']
  )
  const filename = `pte-campaign-cohorts-${new Date().toISOString().split('T')[0]}.csv`
  downloadCSV(csvContent, filename)
}

/**
 * Export all campaign data to a single CSV file
 */
export function exportAllCampaignData(
  stores: Store[],
  integrations: CampaignIntegration[],
  cohorts: CohortData[]
): void {
  const allData = [
    '~~~~~~~~~~~~~ PARTICIPATING STORES ~~~~~~~~~~~~~',
    convertToCSV(
      stores.map(store => ({
        shopDomain: store.shopDomain,
        shopEmail: store.shopEmail || '-',
        currentPublishedCount: store.currentPublishedCount,
        peakPublishedCount: store.peakPublishedCount,
        firstPublishedAt: formatDate(store.firstPublishedAt),
        lastPublishedAt: formatDate(store.lastPublishedAt),
        status: store.isActive ? 'Active' : 'Dormant',
      })),
      [
        'shopDomain',
        'shopEmail',
        'currentPublishedCount',
        'peakPublishedCount',
        'firstPublishedAt',
        'lastPublishedAt',
        'status',
      ]
    ),
    '',
    '~~~~~~~~~~~~~ CAMPAIGN PRODUCTS ~~~~~~~~~~~~~',
    convertToCSV(
      integrations.map(integration => ({
        title: integration.title,
        shopDomain: integration.shopDomain,
        status: integration.status,
        daysActive: integration.daysActive,
        lifecycleStage: integration.lifecycleStage,
      })),
      ['title', 'shopDomain', 'status', 'daysActive', 'lifecycleStage']
    ),
    '',
    '~~~~~~~~~~~~~ COHORT ANALYSIS ~~~~~~~~~~~~~',
    convertToCSV(
      cohorts.map(cohort => ({
        cohortWeek: cohort._id,
        totalStarts: cohort.totalStarts,
        stillActive: cohort.stillActive,
        retentionRate: cohort.retentionRate !== null ? cohort.retentionRate.toFixed(2) : '0',
        avgDaysActive: cohort.avgDaysActive !== null ? cohort.avgDaysActive.toFixed(1) : '0',
      })),
      ['cohortWeek', 'totalStarts', 'stillActive', 'retentionRate', 'avgDaysActive']
    ),
  ].join('\n')

  const filename = `pte-campaign-analytics-${new Date().toISOString().split('T')[0]}.csv`
  downloadCSV(allData, filename)
}
