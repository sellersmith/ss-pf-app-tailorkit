import { BlockStack, Box, InlineStack, Scrollable } from '@shopify/polaris'
import { useMemo } from 'react'
import { getCurrencySymbolV2 } from '~/constants/currency-codes'
import { useRootLoaderData } from '~/root'
import type { ColorOptionSet } from '~/types/psd'
import { OptionSetDisplayItem } from '../TextOptionSet/OptionSetListView'
import { ColorChangingBox } from './ColorChangingBox'

const ColorOptionSetListView = (props: { optionSet: any; editMode: boolean; existOptionSetPressed: boolean }) => {
  const { editMode, optionSet, existOptionSetPressed } = props

  // currency symbol
  const { shopData } = useRootLoaderData()
  const currency = shopData?.shopConfig?.currency || 'USD'
  const symbol = getCurrencySymbolV2(currency)

  const colorOptions: (ColorOptionSet & { id: string })[] = useMemo(
    () => (optionSet?.data?.colors || []).map((color: any) => ({ ...color, id: color._id })),
    [optionSet?.data?.colors]
  )

  if (colorOptions.length > 0) {
    return (
      <Scrollable style={{ maxHeight: 220 }}>
        <BlockStack gap={'100'}>
          {optionSet?.data?.colors.map((item: ColorOptionSet & { additionalPricing?: { value: number } }) => {
            const { _id, name, value, additionalPricing } = item
            const pricingValue = additionalPricing?.value

            return (
              <div
                className={`image-option-name-view ${!editMode && existOptionSetPressed ? ' image-option-name-disabled' : ''}`}
                key={_id}
              >
                <Box padding={'200'} borderRadius="200" paddingInlineStart={'800'}>
                  <InlineStack gap={'200'} blockAlign="center" wrap={false}>
                    <ColorChangingBox colorValue={value} disabled style={{ width: '24px' }} />
                    <Box width="calc(100% - 42px)">
                      <OptionSetDisplayItem
                        name={name}
                        pricingValue={pricingValue}
                        symbol={symbol}
                        currency={currency}
                      />
                    </Box>
                  </InlineStack>
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

export default ColorOptionSetListView
