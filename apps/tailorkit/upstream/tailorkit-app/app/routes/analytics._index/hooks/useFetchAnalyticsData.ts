import { useCallback, useEffect, useState } from 'react'
import { authenticatedFetch } from '~/shopify/fns.client'
import type { IRange } from '../types'
import { TailorKitDataToPolarisDataFormatter } from '../utilities/TailorKitDataToPolarisDataFormatter'
import { type DataSeries } from '@shopify/polaris-viz'
import { type ECardType } from '../constants'

const fetchController: { [key: string]: AbortController | null } = {}

/**
 * @author KhanhNT
 * Custom hook to fetch analytics data, with optional comparison range.
 * It manages fetching, formatting, and setting data while handling loading state.
 *
 * @param {Object} params - The parameters for fetching data.
 * @param {string} params.url - The URL to fetch data from.
 * @param {Object} params.dateRange - The range of dates to fetch data for.
 * @param {string} params.chartKey - A key that determines how the data is formatted.
 * @param {Object} [params.comparedToRange] - An optional range for comparison data.
 *
 * @returns {Object} The current loading state, data, compared data, and the name associated with the data.
 */
export const useFetchAnalyticsData = ({
  url,
  dateRange,
  chartKey,
  comparedToRange,
  chartType,
}: {
  url: string
  dateRange: Omit<IRange, 'label'>
  chartKey: string
  comparedToRange?: Omit<IRange, 'label'>
  chartType: ECardType
}) => {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DataSeries[]>([])
  const [comparedData, setComparedData] = useState<DataSeries[]>([])
  const [overallData, setOverallData] = useState({ sum: 0, percent: 0 })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      if (!url) return

      // Abort any ongoing fetch for the current chartKey
      if (fetchController[chartKey]) {
        fetchController[chartKey].abort()
      }

      const controller = new AbortController()
      fetchController[chartKey] = controller

      const res = await authenticatedFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRange,
          ...(comparedToRange && { comparedToRange }),
        }),
        signal: controller.signal,
      })

      if (res && res.success) {
        const { data, comparedData } = res || {}

        if (data) {
          const formatterData = new TailorKitDataToPolarisDataFormatter({ chartType, chartKey, dateRange })
          const formattedData = formatterData.aggregateAnalyticsData({ chartType, chartKey, items: data.items || [] })
          setData(formattedData)
          setOverallData({ sum: data.total, percent: 0 })

          if (comparedToRange && comparedData) {
            const formatterComparedData = new TailorKitDataToPolarisDataFormatter({
              chartType,
              chartKey,
              dateRange: comparedToRange,
            })
            const formattedComparedData = formatterComparedData.aggregateAnalyticsData({
              chartType,
              chartKey,
              items: comparedData.items || [],
              isComparison: true,
            })
            const percentageChange = ((data.total - comparedData.total) / (comparedData.total || 1)) * 100
            const roundedPercentage = Math.round(percentageChange * 100) / 100

            setComparedData(formattedComparedData)
            setOverallData({ sum: data.total, percent: roundedPercentage })
          }
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.error('Failed to fetch Analytics data:', e)
      }
    } finally {
      setLoading(false)
    }
  }, [chartKey, chartType, comparedToRange, dateRange, url])

  useEffect(() => {
    ;(async () => {
      await fetchData()
    })()
  }, [fetchData])

  return {
    loading,
    data,
    comparedData,
    overallData,
    isEmpty: overallData.sum === 0,
  }
}
