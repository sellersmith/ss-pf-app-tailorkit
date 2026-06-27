import { BlockStack, Box, Scrollable, Tooltip, Spinner, InlineStack } from '@shopify/polaris'
import { useMemo } from 'react'
import type { FontOptionSet, OptionSet } from '~/types/psd'
import { fontLoader } from '../instances'
import { useLoadFonts } from '../../../hooks/useLoadFonts'
import { getCurrencySymbolV2 } from '~/constants/currency-codes'
import { useRootLoaderData } from '~/root'
import { OptionSetDisplayItem } from '../TextOptionSet/OptionSetListView'

const OptionSetListView = (props: { optionSet: OptionSet; editMode: boolean; existOptionSetPressed: boolean }) => {
  const { editMode, optionSet, existOptionSetPressed } = props

  const { shopData } = useRootLoaderData()
  const currency = shopData?.shopConfig?.currency || 'USD'
  const symbol = getCurrencySymbolV2(currency)

  const fontOptions: (FontOptionSet & { id: string })[] = useMemo(
    () => (optionSet?.data?.fonts || []).map((font: FontOptionSet) => ({ ...font, id: font._id })),
    [optionSet?.data?.fonts]
  )

  const { fontLoading } = useLoadFonts({ fonts: fontOptions })

  if (fontLoading) {
    return (
      <div style={{ height: 120 }}>
        <InlineStack align="center">
          <Spinner size="small" />
        </InlineStack>
      </div>
    )
  }

  if (fontOptions.length > 0) {
    return (
      <Scrollable style={{ maxHeight: 220 }}>
        <BlockStack gap={'100'}>
          {fontOptions.map((item: FontOptionSet & { additionalPricing?: { value: number } }) => {
            const { _id, name, additionalPricing } = item
            const pricingValue = additionalPricing?.value
            const font = fontLoader.getLoadedFonts().find(font => font === item.family)

            return (
              <div
                className={`image-option-name-view ${!editMode && existOptionSetPressed ? ' image-option-name-disabled' : ''}`}
                key={_id}
              >
                <Box padding={'200'} borderRadius="200" paddingInlineStart={'800'}>
                  <Tooltip content={name}>
                    <Box width="calc(100% - 20px)">
                      <div style={{ fontFamily: `'${font}'` }}>
                        <OptionSetDisplayItem
                          name={name}
                          pricingValue={pricingValue}
                          symbol={symbol}
                          currency={currency}
                        />
                      </div>
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
