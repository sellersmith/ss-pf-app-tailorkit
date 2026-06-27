import { Box, Text } from '@shopify/polaris'
import type { IRenderPlanProps } from './type'

export function renderPlanName(props: IRenderPlanProps) {
  const { selectedPlan } = props

  return (
    <Box
      background="bg-surface-inverse"
      borderStartStartRadius="100"
      borderStartEndRadius="100"
      paddingBlock={'300'}
      paddingInline={'1200'}
    >
      <Text as="p" variant="headingSm" tone="text-inverse" fontWeight="regular" alignment="center">
        {selectedPlan.name.toLocaleUpperCase()}
      </Text>
    </Box>
  )
}
