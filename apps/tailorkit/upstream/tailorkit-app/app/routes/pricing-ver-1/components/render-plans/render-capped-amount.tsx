import { BlockStack, Box, Text } from '@shopify/polaris'
import type { IRenderPlanProps } from './type'
import { APP_CHARGE_CURRENCY } from '~/constants/pricing'

export function renderCappedAmount(props: IRenderPlanProps) {
  const { selectedPlan } = props

  return (
    <Box background="bg-surface-brand" padding={'150'}>
      <BlockStack inlineAlign="center">
        <Text as="p" variant="bodyLg">
          {APP_CHARGE_CURRENCY}
          {selectedPlan?.cappedAmount}
        </Text>
      </BlockStack>
    </Box>
  )
}
