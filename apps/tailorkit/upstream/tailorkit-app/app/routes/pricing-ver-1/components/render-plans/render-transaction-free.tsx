import { BlockStack, Box, Text } from '@shopify/polaris'
import type { OrderUsages } from '~/models/PricingPlan'
import type { IRenderPlanProps } from './type'

export function renderTransactionFee(props: IRenderPlanProps) {
  const { selectedPlan: plan, pricingPlans, getSelectedPlan, t } = props

  // Get the selected plan for the first pricing plan
  const firstPlan = getSelectedPlan(pricingPlans[0])

  // If no selected plan or no transaction fees, return nothing
  if (!firstPlan || !firstPlan.usages?.orders) {
    return null
  }

  const transactionFeePerOrder = firstPlan.usages.orders

  return (
    <Box>
      <Box paddingBlock={'150'} paddingInline={'200'} background="bg-surface-secondary">
        <div style={{ visibility: 'hidden' }}>
          <Text key="price" as="p" variant="bodyLg" fontWeight="semibold">
            Hidden
          </Text>
        </div>
      </Box>
      <BlockStack>
        {transactionFeePerOrder.map((rule: OrderUsages, index: number) => {
          const backgroundColor = index % 2 !== 0 ? 'bg-surface-secondary' : 'bg-surface-brand'

          // Get rule of transaction fee
          const _rule: OrderUsages | undefined = plan?.usages.orders.find(
            (_rule: any) => _rule.from === rule.from && _rule.to === rule.to
          )

          const { transactionFee } = _rule || {}

          return (
            <Box key={index} background={backgroundColor} padding="150">
              <BlockStack inlineAlign="center">
                <Text as="span" variant="bodyLg">
                  {transactionFee ? `$${transactionFee}` : t('free')}
                </Text>
              </BlockStack>
            </Box>
          )
        })}
      </BlockStack>
    </Box>
  )
}
