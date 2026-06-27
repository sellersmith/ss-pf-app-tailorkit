import { BlockStack, Box, InlineStack, Text } from '@shopify/polaris'
import type { IRenderPlanProps } from './type'

export function renderMonthlyFreeOrders(props: IRenderPlanProps) {
  const { selectedPlan } = props

  return (
    <Box background="bg-surface-brand" padding={'150'}>
      <BlockStack inlineAlign="center">
        <InlineStack gap="100">
          <Text as="span" variant="bodyLg">
            {selectedPlan.usages.orders?.[0].to}
          </Text>
        </InlineStack>
      </BlockStack>
    </Box>
  )
}
