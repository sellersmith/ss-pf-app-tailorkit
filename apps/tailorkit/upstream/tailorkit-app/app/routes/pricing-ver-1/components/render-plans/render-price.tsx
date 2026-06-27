import { BlockStack, Box, Text } from '@shopify/polaris'
import type { IRenderPlanProps } from './type'

export function renderPrice(props: IRenderPlanProps) {
  const { t, selectedPlan } = props

  // Destructure values, ensuring defaults for missing data
  const { price = 0, periodical, highlighted = false } = selectedPlan || {}

  // Determine the correct suffix based on periodical
  const suffix = periodical === 'one-time' ? t('lifetime') : `/ ${periodical === 'annually' ? t('year') : t('month')}`

  // Return price component
  const renderPriceComponent = (
    <Box>
      <Text as="span" variant={highlighted ? 'heading2xl' : 'headingXl'} fontWeight="bold">
        {price > 0 ? `$${price}` : t('free')}
      </Text>
      {price > 0 && (
        <Text as="span" variant="bodyLg">
          {suffix}
        </Text>
      )}
    </Box>
  )

  return (
    <Box paddingBlock="200">
      <BlockStack inlineAlign="center">{renderPriceComponent}</BlockStack>
    </Box>
  )
}
