import { BlockStack, Box, ProgressBar, SkeletonBodyText, Text } from '@shopify/polaris'
import type { TFunction } from 'i18next'

interface AiCreditsSectionProps {
  aiCredits: {
    used: number
    total: number
    purchased: number
    purchasedTotal: number
    purchasedUsed: number
  }
  t: TFunction
  purchasedCreditsLoading?: boolean
}

export function AiCreditsSection(props: AiCreditsSectionProps) {
  const { aiCredits, t, purchasedCreditsLoading = false } = props

  return (
    <div
      style={{
        border: '1px solid var(--p-color-border)',
        borderRadius: '12px',
        padding: '12px',
      }}
    >
      <BlockStack gap="300">
        <BlockStack gap="100">
          <Text as="p" variant="bodyMd" fontWeight="semibold">
            {t('free-ai-credits')}
          </Text>
          <Text as="p" variant="bodyMd">
            <Text as="span" variant="bodyMd" fontWeight="semibold">
              {aiCredits.used}
            </Text>{' '}
            {t('of')} {aiCredits.total}
          </Text>
          <ProgressBar progress={(aiCredits.used / aiCredits.total) * 100} tone="primary" size="small" />
        </BlockStack>

        <BlockStack gap="100">
          <Text as="p" variant="bodyMd" fontWeight="semibold">
            {t('purchased-ai-credits')}
          </Text>
          {purchasedCreditsLoading ? (
            <Box width="80px">
              <SkeletonBodyText lines={1} />
            </Box>
          ) : (
            <>
              <Text as="p" variant="bodyMd">
                <Text as="span" variant="bodyMd" fontWeight="semibold">
                  {aiCredits.purchasedUsed}
                </Text>{' '}
                {t('of')} {aiCredits.purchasedTotal}
              </Text>
              <ProgressBar
                progress={aiCredits.purchasedTotal > 0 ? (aiCredits.purchasedUsed / aiCredits.purchasedTotal) * 100 : 0}
                tone="primary"
                size="small"
              />
            </>
          )}
        </BlockStack>
      </BlockStack>
    </div>
  )
}
