import {
  Card,
  BlockStack,
  InlineStack,
  Text,
  DataTable,
  Tooltip,
  Icon,
  Badge,
  SkeletonBodyText,
} from '@shopify/polaris'
import { InfoIcon } from '@shopify/polaris-icons'
import { useEffect, useState } from 'react'

interface CohortData {
  _id: string // cohortWeek
  totalStarts: number
  stillActive: number
  retentionRate: number
  avgDaysActive: number
  shops: string[]
}

interface CohortAnalysisTableProps {
  campaignId: string
}

export function CohortAnalysisTable({ campaignId }: CohortAnalysisTableProps) {
  const [cohorts, setCohorts] = useState<CohortData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)

    fetch(`/admin/pte-campaigns/cohorts?campaignId=${campaignId}`)
      .then(res => res.json())
      .then(response => {
        if (response.success && response.cohorts) {
          setCohorts(response.cohorts)
        }
      })
      .catch(err => {
        console.error('Failed to load cohort data:', err)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [campaignId])

  const rows = cohorts.map(cohort => {
    // Determine retention badge tone
    const retentionRate = cohort.retentionRate ?? 0
    const retentionTone = retentionRate >= 70 ? 'success' : retentionRate >= 50 ? 'warning' : 'critical'

    return [
      // Cohort Week
      <Text key={`week-${cohort._id}`} variant="bodyMd" fontWeight="semibold" as="span">
        {cohort._id}
      </Text>,

      // Total Starts
      <Text key={`starts-${cohort._id}`} as="span">
        {cohort.totalStarts}
      </Text>,

      // Still Active
      <Text key={`active-${cohort._id}`} as="span">
        {cohort.stillActive}
      </Text>,

      // Retention Rate (color-coded)
      <Badge key={`retention-${cohort._id}`} tone={retentionTone}>
        {retentionRate.toFixed(1)}%
      </Badge>,

      // Avg Days Active
      <Text key={`days-${cohort._id}`} as="span">
        {cohort.avgDaysActive !== null ? cohort.avgDaysActive.toFixed(1) : '0'} days
      </Text>,
    ]
  })

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack gap="200" blockAlign="center">
          <Text variant="headingMd" as="h3">
            Cohort Retention Analysis
          </Text>
          <Tooltip content="Groups stores by first publish week and tracks how many remain active">
            <Icon source={InfoIcon} tone="subdued" />
          </Tooltip>
        </InlineStack>

        {loading ? (
          <SkeletonBodyText lines={5} />
        ) : cohorts.length === 0 ? (
          <Text as="p" tone="subdued">
            No cohort data available
          </Text>
        ) : (
          <DataTable
            columnContentTypes={['text', 'numeric', 'numeric', 'text', 'numeric']}
            headings={['Cohort Week', 'Total Starts', 'Still Active', 'Retention Rate', 'Avg Days Active']}
            rows={rows}
          />
        )}
      </BlockStack>
    </Card>
  )
}
