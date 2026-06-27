import { Badge, BlockStack, Box, Button, Card, InlineStack, Select, Text, TextField } from '@shopify/polaris'

interface AnalyticsFiltersProps {
  dateRangeType: string
  onDateRangeTypeChange: (value: string) => void
  customStartDate: string
  onCustomStartDateChange: (value: string) => void
  customEndDate: string
  onCustomEndDateChange: (value: string) => void
  excludeEmailInput: string
  onExcludeEmailChange: (value: string) => void
  onApplyFilters: () => void
  isLoading: boolean
  currentDateRange: {
    startDate: string
    endDate: string
    days: number
  }
  currentExcludeEmail: string
}

export function AnalyticsFilters({
  dateRangeType,
  onDateRangeTypeChange,
  customStartDate,
  onCustomStartDateChange,
  customEndDate,
  onCustomEndDateChange,
  excludeEmailInput,
  onExcludeEmailChange,
  onApplyFilters,
  isLoading,
  currentDateRange,
  currentExcludeEmail,
}: AnalyticsFiltersProps) {
  return (
    <Card>
      <BlockStack gap="400">
        <Text variant="headingMd" as="h3">
          Filters
        </Text>

        {/* Date Range Filter */}
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
            onChange={onDateRangeTypeChange}
          />
          {dateRangeType === 'custom' && (
            <>
              <TextField
                label="Start Date"
                type="date"
                value={customStartDate}
                onChange={onCustomStartDateChange}
                autoComplete="off"
              />
              <TextField
                label="End Date"
                type="date"
                value={customEndDate}
                onChange={onCustomEndDateChange}
                autoComplete="off"
              />
            </>
          )}
        </InlineStack>

        {/* Email Exclude Filter */}
        <InlineStack blockAlign="end" gap="200">
          <TextField
            label="Exclude Shop Emails Containing"
            value={excludeEmailInput}
            onChange={onExcludeEmailChange}
            placeholder="e.g., @bravebits.vn"
            helpText="Filter out shops with emails containing this text"
            autoComplete="off"
          />
          <Box>
            <Button variant="primary" onClick={onApplyFilters} loading={isLoading}>
              Apply Filters
            </Button>
          </Box>
        </InlineStack>

        <Text variant="bodySm" tone="subdued" as="p">
          Currently showing data from {new Date(currentDateRange.startDate).toLocaleDateString()} to{' '}
          {new Date(currentDateRange.endDate).toLocaleDateString()} ({currentDateRange.days} days)
          {currentExcludeEmail && (
            <>
              {' • '}
              Excluding emails containing: <Badge>{currentExcludeEmail}</Badge>
            </>
          )}
        </Text>
      </BlockStack>
    </Card>
  )
}
