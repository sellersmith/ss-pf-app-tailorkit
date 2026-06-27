import { BlockStack, Box, Scrollable, InlineStack, Thumbnail } from '@shopify/polaris'
import { getCurrencySymbolV2 } from '~/constants/currency-codes'
import { useRootLoaderData } from '~/root'
import { useMemo } from 'react'
import { getShopifyThumbnail } from '~/utils/loadImage'
import type { ImageOptionSet, OptionSet } from '~/types/psd'
import { optionSetDataKeys } from '~/types/psd'
import { OptionSetDisplayItem } from '~/modules/TemplateEditor/elements/components/Text/TextOptionSet/OptionSetListView'
import { useImageWithOverlay } from '~/hooks/useImageWithOverlay'

interface ImageOptionListItemProps {
  file: ImageOptionSet & { additionalPricing?: { value: number } }
  editMode: boolean
  existOptionSetPressed: boolean
  symbol: string
  currency: string
}

function ImageOptionListItem({ file, editMode, existOptionSetPressed, symbol, currency }: ImageOptionListItemProps) {
  const { _id, name, src, additionalPricing, overlay } = file
  const pricingValue = additionalPricing?.value

  const { imageUrl: compositedUrl } = useImageWithOverlay({
    imageUrl: src,
    overlay: overlay || null,
    enabled: !!overlay?.overlaySvg,
  })

  const thumbnailSource = compositedUrl || getShopifyThumbnail(src)

  return (
    <div
      key={_id}
      className={`image-option-name-view ${!editMode && existOptionSetPressed ? ' image-option-name-disabled' : ''}`}
    >
      <Box padding={'200'} borderRadius="200">
        <InlineStack gap="200" blockAlign="center" wrap={false}>
          {src && (
            <Box paddingBlock="100">
              <Thumbnail size="extraSmall" source={thumbnailSource} alt={name} />
            </Box>
          )}
          <Box width="calc(100% - 42px)">
            <OptionSetDisplayItem name={name} pricingValue={pricingValue} symbol={symbol} currency={currency} />
          </Box>
        </InlineStack>
      </Box>
    </div>
  )
}

interface ImageOptionListViewProps {
  optionSet: OptionSet
  editMode: boolean
  existOptionSetPressed: boolean
}

export default function ImageOptionListView({ optionSet, editMode, existOptionSetPressed }: ImageOptionListViewProps) {
  // Determine key that holds files (images or masks)
  const optionSetType = optionSet?.type as keyof typeof optionSetDataKeys
  const optionSetDataKey = optionSetDataKeys[optionSetType]

  const files: (ImageOptionSet & { id: string })[] = useMemo(
    () => (optionSet?.data?.[optionSetDataKey] || []).map((file: any) => ({ ...file, id: file._id })),
    [optionSet?.data, optionSetDataKey]
  )

  // currency symbol
  const { shopData } = useRootLoaderData()
  const currency = shopData?.shopConfig?.currency || 'USD'
  const symbol = getCurrencySymbolV2(currency)

  if (!files.length) return null

  return (
    <Scrollable style={{ maxHeight: 220 }} className="image-option-list-view">
      <BlockStack gap={'100'}>
        {files.map(file => (
          <ImageOptionListItem
            key={file._id}
            file={file}
            editMode={editMode}
            existOptionSetPressed={existOptionSetPressed}
            symbol={symbol}
            currency={currency}
          />
        ))}
      </BlockStack>
    </Scrollable>
  )
}
