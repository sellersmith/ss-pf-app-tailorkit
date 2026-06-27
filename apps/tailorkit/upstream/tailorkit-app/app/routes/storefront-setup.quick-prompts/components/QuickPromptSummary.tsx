import { BlockStack, Card, InlineStack, Text } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'

interface QuickPromptSummaryProps {
  totalCount: number
  filteredCount: number
  isFiltering: boolean
}

export function QuickPromptSummary({ totalCount, filteredCount, isFiltering }: QuickPromptSummaryProps) {
  const { t } = useTranslation()

  return (
    <Card>
      <BlockStack gap="400">
        <Text as="h2" variant="headingMd" fontWeight="bold">
          {t('summary')}
        </Text>
        <InlineStack align="space-between">
          <Text as="span" variant="bodyMd">
            {t('quick-prompts')}
          </Text>
          <Text as="span" variant="bodyMd">
            {isFiltering ? `${filteredCount} of ${totalCount}` : totalCount}
          </Text>
        </InlineStack>
      </BlockStack>
    </Card>
  )
}
