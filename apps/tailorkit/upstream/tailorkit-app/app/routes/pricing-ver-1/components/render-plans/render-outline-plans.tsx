import { Bleed, BlockStack, Box, Divider, Text } from '@shopify/polaris'
import type { OrderUsages } from '~/models/PricingPlan'
import type { IRenderPlanProps } from './type'

export function renderPlansOutline(props: Pick<IRenderPlanProps, 't' | 'pricingPlans' | 'getSelectedPlan'>) {
  const { t, pricingPlans, getSelectedPlan } = props

  const firstSelectedPlan = getSelectedPlan(pricingPlans[0])

  if (!firstSelectedPlan) return null

  const renderTransactionFeeTitles = () =>
    firstSelectedPlan.usages.orders?.map((rule: OrderUsages, index: number) => {
      return (
        <Box key={index} paddingInline={'400'}>
          <Bleed marginInline={'150'}>
            <Divider borderColor="border-inverse" borderWidth="0165" />
          </Bleed>

          <Box padding={'200'}>
            <BlockStack inlineAlign="start">
              <Text as="span" variant="bodySm">
                {rule.from === 1
                  ? t('first-num-orders', { num: rule.to })
                  : !rule.to
                    ? t('from-order-num-and-above', { num: rule.from })
                    : t('from-order-from-to-to', { from: rule.from, to: rule.to })}
              </Text>
            </BlockStack>
          </Box>
        </Box>
      )
    })

  return (
    <Box
      borderStartStartRadius="200"
      borderEndStartRadius="200"
      borderColor="border-inverse"
      borderWidth="025"
      paddingInlineStart={'100'}
      paddingInlineEnd={'025'}
      paddingBlock={'050'}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <BlockStack>
          <Box padding={'200'}>
            <BlockStack>
              <Text as="h2" variant="heading2xl" breakWord>
                {t('choose').toLocaleUpperCase()}
              </Text>
              <Text as="h2" variant="heading2xl" breakWord>
                {t('your-plan').toLocaleUpperCase()}
              </Text>
            </BlockStack>
          </Box>

          <Divider borderColor="border-inverse" borderWidth="0165" />
          <Box paddingBlock={'150'} paddingInline={'200'}>
            <Text key="price" as="p" variant="bodySm" fontWeight="semibold">
              {t('monthly-free-orders')}
            </Text>
          </Box>

          <Divider borderColor="border-inverse" borderWidth="0165" />
          <Box paddingBlock={'200'} paddingInline={'200'}>
            <Text key="price" as="p" variant="bodySm" fontWeight="semibold">
              {t('transaction-fee-per-order')}
            </Text>
          </Box>

          {/* Render transaction fee title */}
          {renderTransactionFeeTitles()}

          <Divider borderColor="border-inverse" borderWidth="0165" />
          <Box paddingBlock={'150'} paddingInline={'200'}>
            <Text key="price" as="p" variant="bodySm" fontWeight="semibold">
              {t('capped-amount')}
            </Text>
          </Box>

          <Divider borderColor="border-inverse" borderWidth="0165" />
        </BlockStack>

        <div style={{ height: '100%' }}>
          <Box background="bg-surface-brand" borderEndStartRadius="200" minHeight="100%" />
        </div>
      </div>
    </Box>
  )
}
