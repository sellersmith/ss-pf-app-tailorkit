import type { AssetType } from '~/models/ClipartClickEvent'

interface TopAsset {
  assetName: string
  assetId: string
  assetType: AssetType
  totalClicks: number
  uniqueShops: number
  clicksByContext: Array<{ context: string; count: number }>
}

interface TopShop {
  shopDomain: string
  shopEmail?: string
  shopOwner?: string
  totalClicks: number
  totalAssets: number
}

interface RecentActivityEvent {
  clickedAt: Date | string
  assetName?: string
  assetId: string
  assetType: AssetType
  shopDomain: string
  shopEmail?: string
  shopOwner?: string
  context: string
}

interface SummaryData {
  totalClicks: number
  totalAssets: number
  totalShops: number
}

/**
 * Convert array of objects to CSV format
 */
export function convertToCSV(data: any[], headers: string[]): string {
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
export function downloadCSV(csvContent: string, filename: string): void {
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
 * Export summary data to CSV
 */
export function exportSummary(summary: SummaryData): void {
  const csvContent = convertToCSV(
    [
      { metric: 'Total Clicks', value: summary.totalClicks },
      { metric: 'Total Assets', value: summary.totalAssets },
      { metric: 'Total Shops', value: summary.totalShops },
      {
        metric: 'Avg Clicks/Asset',
        value: summary.totalAssets > 0 ? Math.round(summary.totalClicks / summary.totalAssets) : 0,
      },
    ],
    ['metric', 'value']
  )
  const filename = `clipart-analytics-summary-${new Date().toISOString().split('T')[0]}.csv`
  downloadCSV(csvContent, filename)
}

/**
 * Export top assets to CSV
 */
export function exportTopAssets(assets: TopAsset[]): void {
  const csvContent = convertToCSV(
    assets.map(asset => ({
      assetName: asset.assetName,
      assetId: asset.assetId,
      assetType: asset.assetType,
      totalClicks: asset.totalClicks,
      uniqueShops: asset.uniqueShops,
      topContexts: asset.clicksByContext.map(c => `${c.context}:${c.count}`).join('; '),
    })),
    ['assetName', 'assetId', 'assetType', 'totalClicks', 'uniqueShops', 'topContexts']
  )
  const filename = `clipart-analytics-top-assets-${new Date().toISOString().split('T')[0]}.csv`
  downloadCSV(csvContent, filename)
}

/**
 * Export top shops to CSV
 */
export function exportTopShops(shops: TopShop[]): void {
  const csvContent = convertToCSV(
    shops.map(shop => ({
      shopDomain: shop.shopDomain,
      shopEmail: shop.shopEmail || '-',
      shopOwner: shop.shopOwner || '-',
      totalClicks: shop.totalClicks,
      totalAssets: shop.totalAssets,
      avgClicksPerAsset: shop.totalAssets > 0 ? Math.round(shop.totalClicks / shop.totalAssets) : 0,
    })),
    ['shopDomain', 'shopEmail', 'shopOwner', 'totalClicks', 'totalAssets', 'avgClicksPerAsset']
  )
  const filename = `clipart-analytics-top-shops-${new Date().toISOString().split('T')[0]}.csv`
  downloadCSV(csvContent, filename)
}

/**
 * Export recent activity to CSV
 */
export function exportRecentActivity(events: RecentActivityEvent[]): void {
  const csvContent = convertToCSV(
    events.map(event => ({
      clickedAt: new Date(event.clickedAt).toLocaleString(),
      assetName: event.assetName,
      assetId: event.assetId,
      assetType: event.assetType,
      shopDomain: event.shopDomain,
      shopEmail: event.shopEmail || '-',
      shopOwner: event.shopOwner || '-',
      context: event.context,
    })),
    ['clickedAt', 'assetName', 'assetId', 'assetType', 'shopDomain', 'shopEmail', 'shopOwner', 'context']
  )
  const filename = `clipart-analytics-recent-activity-${new Date().toISOString().split('T')[0]}.csv`
  downloadCSV(csvContent, filename)
}

/**
 * Export all data (summary + top assets + top shops) to CSV
 */
export function exportAllData(summary: SummaryData, assets: TopAsset[], shops: TopShop[]): void {
  const allData = [
    '~~~~~~~~~~~~~ SUMMARY ~~~~~~~~~~~~~',
    convertToCSV(
      [
        { metric: 'Total Clicks', value: summary.totalClicks },
        { metric: 'Total Assets', value: summary.totalAssets },
        { metric: 'Total Shops', value: summary.totalShops },
      ],
      ['metric', 'value']
    ),
    '',
    '~~~~~~~~~~~~~ TOP ASSETS ~~~~~~~~~~~~~',
    convertToCSV(
      assets.map(asset => ({
        assetName: asset.assetName,
        assetId: asset.assetId,
        totalClicks: asset.totalClicks,
        uniqueShops: asset.uniqueShops,
      })),
      ['assetName', 'assetId', 'totalClicks', 'uniqueShops']
    ),
    '',
    '~~~~~~~~~~~~~ TOP SHOPS ~~~~~~~~~~~~~',
    convertToCSV(
      shops.map(shop => ({
        shopDomain: shop.shopDomain,
        shopEmail: shop.shopEmail || '-',
        shopOwner: shop.shopOwner || '-',
        totalClicks: shop.totalClicks,
        totalAssets: shop.totalAssets,
      })),
      ['shopDomain', 'shopEmail', 'shopOwner', 'totalClicks', 'totalAssets']
    ),
  ].join('\n')

  const filename = `clipart-analytics-all-data-${new Date().toISOString().split('T')[0]}.csv`
  downloadCSV(allData, filename)
}
