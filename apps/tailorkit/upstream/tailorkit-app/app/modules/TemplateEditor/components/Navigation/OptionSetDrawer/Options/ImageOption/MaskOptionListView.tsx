import { BlockStack, Box, Scrollable, InlineStack, Thumbnail } from '@shopify/polaris'
import { useMemo } from 'react'
import { getShopifyThumbnail } from '~/utils/loadImage'
import type { OptionSet } from '~/types/psd'
import { optionSetDataKeys } from '~/types/psd'
import { useRootLoaderData } from '~/root'
import { getCurrencySymbolV2 } from '~/constants/currency-codes'
import { OptionSetDisplayItem } from '~/modules/TemplateEditor/elements/components/Text/TextOptionSet/OptionSetListView'

interface MaskOptionListViewProps {
  optionSet: OptionSet
  editMode: boolean
  existOptionSetPressed: boolean
}

export default function MaskOptionListView({ optionSet, editMode, existOptionSetPressed }: MaskOptionListViewProps) {
  // Determine the key that holds masks array
  const optionSetType = optionSet?.type as keyof typeof optionSetDataKeys
  const optionSetDataKey = optionSetDataKeys[optionSetType]

  const masks: any[] = useMemo(
    () => (optionSet?.data?.[optionSetDataKey] || []).map((m: any) => ({ ...m, id: m._id })),
    [optionSet?.data, optionSetDataKey]
  )

  // currency symbol for displaying pricing
  const { shopData } = useRootLoaderData()
  const currency = shopData?.shopConfig?.currency || 'USD'
  const symbol = getCurrencySymbolV2(currency)

  if (!masks.length) return null

  return (
    <Scrollable style={{ maxHeight: 220 }} className="mask-option-list-view">
      <BlockStack gap="100">
        {masks.map(mask => {
          const { _id, name, src, additionalPricing } = mask
          const pricingValue = additionalPricing?.value

          return (
            <div
              key={_id}
              className={`image-option-name-view ${!editMode && existOptionSetPressed ? ' image-option-name-disabled' : ''}`}
            >
              <Box padding="200" borderRadius="200" paddingInlineStart="800">
                <InlineStack gap="200" blockAlign="center" wrap={false}>
                  {src && (
                    <Box paddingBlock="100">
                      <Thumbnail size="extraSmall" source={getShopifyThumbnail(src)} alt={name} />
                    </Box>
                  )}
                  <Box width="calc(100% - 42px)">
                    <OptionSetDisplayItem name={name} pricingValue={pricingValue} symbol={symbol} currency={currency} />
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
