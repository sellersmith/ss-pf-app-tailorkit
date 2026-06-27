import { Card, BlockStack, Text, SkeletonBodyText } from '@shopify/polaris'
import { LineChart } from '@shopify/polaris-viz'
import { useEffect, useState } from 'react'

interface EngagementData {
  date: string
  published: number
  unpublished: number
  netChange: number
  totalActive: number
}

interface EngagementChartProps {
  campaignId: string
}

export function EngagementChart({ campaignId }: EngagementChartProps) {
  const [data, setData] = useState<EngagementData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)

    fetch(`/admin/pte-campaigns/engagement?campaignId=${campaignId}`)
      .then(res => res.json())
      .then(response => {
        if (response.success && response.data) {
          setData(response.data)
        }
      })
      .catch(err => {
        console.error('Failed to load engagement data:', err)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [campaignId])

  const chartData = [
    {
      name: 'New Publishes',
      data: data.map(d => ({ key: d.date, value: d.published })),
      color: '#108043',
    },
    {
      name: 'Unpublishes',
      data: data.map(d => ({ key: d.date, value: d.unpublished })),
      color: '#D72C0D',
    },
    {
      name: 'Total Active',
      data: data.map(d => ({ key: d.date, value: d.totalActive })),
      color: '#2C6ECB',
    },
  ]

  return (
    <Card>
      <BlockStack gap="400">
        <Text variant="headingMd" as="h3">
          Engagement Trends
        </Text>

        {loading ? (
          <SkeletonBodyText lines={8} />
        ) : data.length === 0 ? (
          <Text as="p" tone="subdued">
            No engagement data available
          </Text>
        ) : (
          <LineChart data={chartData} />
        )}
      </BlockStack>
    </Card>
  )
}
