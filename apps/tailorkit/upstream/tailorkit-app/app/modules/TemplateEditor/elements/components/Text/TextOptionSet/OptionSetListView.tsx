import { BlockStack, Box, Scrollable, Tooltip, Text, InlineStack } from '@shopify/polaris'
import { getCurrencySymbolV2 } from '~/constants/currency-codes'
import { useRootLoaderData } from '~/root'
import { useCallback, useMemo } from 'react'
import { type TextOptionSet } from '~/types/psd'
import { formatCustomerPrice } from 'extensions/tailorkit-src/src/assets/utils/storefront-pricing'

const OptionSetListView = (props: { optionSet: any; editMode: boolean; existOptionSetPressed: boolean }) => {
  const { editMode, optionSet, existOptionSetPressed } = props

  // Get currency symbol for displaying pricing values
  const { shopData } = useRootLoaderData()
  const currency = shopData?.shopConfig?.currency || 'USD'
  const symbol = getCurrencySymbolV2(currency)

  const textOptions: (TextOptionSet & { id: string })[] = useMemo(
    () => (optionSet?.data?.texts || []).map((text: any) => ({ ...text, id: text._id })),
    [optionSet?.data?.texts]
  )

  if (textOptions.length > 0) {
    return (
      <Scrollable style={{ maxHeight: 220 }}>
        <BlockStack gap={'100'}>
          {optionSet?.data?.texts.map((item: TextOptionSet & { additionalPricing?: { value: number } }) => {
            const { _id, name, additionalPricing } = item
            const pricingValue = additionalPricing?.value

            return (
              <div
                className={`image-option-name-view ${!editMode && existOptionSetPressed ? ' image-option-name-disabled' : ''}`}
                key={_id}
              >
                <Box padding={'200'} borderRadius="200" paddingInlineStart={'800'}>
                  <Tooltip content={name}>
                    <Box width="calc(100% - 20px)">
                      <OptionSetDisplayItem
                        name={name}
                        pricingValue={pricingValue}
                        symbol={symbol}
                        currency={currency}
                      />
                    </Box>
                  </Tooltip>
                </Box>
              </div>
            )
          })}
        </BlockStack>
      </Scrollable>
    )
  }
  return null
}

export default OptionSetListView

export function OptionSetDisplayItem({
  name,
  pricingValue,
  symbol,
  currency,
}: {
  name: string
  pricingValue: number | undefined
  symbol: string | undefined
  currency: string
}) {
  const formattedCustomerPrice = useCallback(
    (amount: number) => {
      return formatCustomerPrice(amount, { code: currency })
    },
    [currency]
  )

  return (
    <InlineStack align="space-between" gap="100" wrap={false}>
      <div style={{ maxWidth: `${pricingValue ? '80%' : '100%'}` }}>
        <Text variant="bodySm" as="p" truncate>
          {name}
        </Text>
      </div>
      <Text variant="bodySm" as="span" truncate>
        {pricingValue ? `${symbol}${formattedCustomerPrice(pricingValue)}` : ''}
      </Text>
    </InlineStack>
  )
}
