import { Box, Button, InlineStack } from '@shopify/polaris'
import type { IRenderPlanProps } from './type'

export function renderChoosePlan(props: IRenderPlanProps) {
  const { selectedPlan, selectPlanHandler, t, processing } = props

  return (
    <Box paddingBlockStart={'600'} paddingBlockEnd={'400'} paddingInline={'400'}>
      <InlineStack align="center">
        <Button size="large" variant="primary" loading={processing} onClick={() => selectPlanHandler(selectedPlan._id)}>
          {t('start-now')}
        </Button>
      </InlineStack>
    </Box>
  )
}
