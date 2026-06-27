import {
  Card,
  BlockStack,
  Text,
  TextField,
  Checkbox,
  Box,
  Select,
  Tooltip,
  Thumbnail,
  InlineStack,
} from '@shopify/polaris'
import { ImageIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import { ClientOnly } from 'remix-utils/client-only'
import { RichTextEditor } from '~/components/.client/RichTextEditor'
import { EPlacementType } from '~/enums/checkbox'
import type { CheckboxContent, EContentType } from '~/types/checkbox'
import { CONTENT_TYPE_OPTIONS } from './types'
import { buildDynamicToolbarConfig } from './richTextToolbarConfig'

interface SelectedVariantData {
  id: string
  title: string
  price?: string
  compareAtPrice?: string
  product: {
    id: string
    title: string
    featuredImage?: { url: string }
    hasOnlyDefaultVariant?: boolean
  }
}

interface DisplayContentCardProps {
  checkboxContent: CheckboxContent
  typePlacement: EPlacementType
  selectedVariantData?: SelectedVariantData | null
  onContentChange: (content: Partial<CheckboxContent>) => void
}

// Single checkbox option with tooltip for disabled state
function TickOption({
  label,
  checked,
  disabled,
  tooltipContent,
  onChange,
}: {
  label: string
  checked: boolean
  disabled: boolean
  tooltipContent?: string
  onChange: (checked: boolean) => void
}) {
  const checkbox = <Checkbox label={label} checked={checked} disabled={disabled} onChange={onChange} />

  if (disabled && tooltipContent) {
    return (
      <Tooltip content={tooltipContent} dismissOnMouseOut>
        {checkbox}
      </Tooltip>
    )
  }

  return checkbox
}

export default function DisplayContentCard({
  checkboxContent,
  typePlacement,
  selectedVariantData,
  onContentChange,
}: DisplayContentCardProps) {
  const { t } = useTranslation()

  const noAddonProductSelected = !selectedVariantData
  const hasOnlyDefaultVariant = selectedVariantData?.product?.hasOnlyDefaultVariant ?? true
  const disabledTooltip = t('select-addon-product-first')
  const variantTooltip = t('addon-has-no-variants')

  // Handle showPrice change - also reset showComparedPrice when unchecked
  const handleShowPriceChange = (checked: boolean) => {
    onContentChange({
      showPrice: checked,
      ...(checked ? {} : { showComparedPrice: false }),
    })
  }

  // Handle showFeaturedImage change - set default image from product when enabled
  const handleShowFeaturedImageChange = (checked: boolean) => {
    if (checked && !checkboxContent.imageUrl && selectedVariantData?.product?.featuredImage?.url) {
      onContentChange({
        showFeaturedImage: checked,
        imageUrl: selectedVariantData.product.featuredImage.url,
      })
    } else {
      onContentChange({ showFeaturedImage: checked })
    }
  }

  // Handle showVariantSelector change - disable if only default variant
  const handleShowVariantSelectorChange = (checked: boolean) => {
    if (hasOnlyDefaultVariant) return
    onContentChange({ showVariantSelector: checked })
  }

  const showHeading
    = checkboxContent.contentType === 'heading_only' || checkboxContent.contentType === 'heading_and_description'
  const showDescription
    = checkboxContent.contentType === 'description_only' || checkboxContent.contentType === 'heading_and_description'
  const headingToolbarConfig = buildDynamicToolbarConfig(t, 'display-heading-toolbar')
  const descriptionToolbarConfig = buildDynamicToolbarConfig(t, 'display-description-toolbar')

  return (
    <Card roundedAbove="sm" padding="0">
      {/* Header */}
      <Box padding="400">
        <Text as="h2" variant="headingMd">
          {t('display-content')}
        </Text>
      </Box>

      {/* Tick Options Section - bordered */}
      <Box padding="400" borderColor="border" borderBlockStartWidth="025" borderBlockEndWidth="025">
        <BlockStack gap="100">
          {/* Pre-check - only shown when NOT cart placement */}
          {typePlacement !== EPlacementType.CART && (
            <TickOption
              label={t('tick-addon-by-default')}
              checked={checkboxContent.preCheck}
              disabled={noAddonProductSelected}
              tooltipContent={disabledTooltip}
              onChange={checked => onContentChange({ preCheck: checked })}
            />
          )}

          {/* Show variant selection */}
          <TickOption
            label={t('show-variant-selection')}
            checked={checkboxContent.showVariantSelector}
            disabled={noAddonProductSelected || hasOnlyDefaultVariant}
            tooltipContent={noAddonProductSelected ? disabledTooltip : variantTooltip}
            onChange={handleShowVariantSelectorChange}
          />

          {/* Show quantity selector */}
          {/* {typePlacement !== EPlacementType.CART && (
            <TickOption
              label={t('show-quantity-selector')}
              checked={checkboxContent.showQuantitySelector}
              disabled={noAddonProductSelected}
              tooltipContent={disabledTooltip}
              onChange={checked => onContentChange({ showQuantitySelector: checked })}
            />
          )} */}

          {/* Show price */}
          <TickOption
            label={t('show-price')}
            checked={checkboxContent.showPrice}
            disabled={noAddonProductSelected}
            tooltipContent={disabledTooltip}
            onChange={handleShowPriceChange}
          />

          {/* Show compare-at price - only shown when showPrice is true */}
          {checkboxContent.showPrice && (
            <TickOption
              label={t('show-compare-at-price')}
              checked={checkboxContent.showComparedPrice}
              disabled={noAddonProductSelected}
              tooltipContent={disabledTooltip}
              onChange={checked => onContentChange({ showComparedPrice: checked })}
            />
          )}

          {/* Show featured image */}
          <TickOption
            label={t('show-featured-image')}
            checked={checkboxContent.showFeaturedImage}
            disabled={noAddonProductSelected}
            tooltipContent={disabledTooltip}
            onChange={handleShowFeaturedImageChange}
          />

          {/* Image source - only shown when showFeaturedImage is true */}
          {checkboxContent.showFeaturedImage && (
            <Box paddingBlockStart="200">
              <InlineStack gap="300" blockAlign="center" wrap={false}>
                <Box minWidth="40px">
                  <Thumbnail size="small" source={checkboxContent.imageUrl || ImageIcon} alt={t('featured-image')} />
                </Box>
                <Box width="100%">
                  <TextField
                    label={t('image-url')}
                    labelHidden
                    value={checkboxContent.imageUrl}
                    onChange={value => onContentChange({ imageUrl: value })}
                    autoComplete="off"
                    placeholder="https://example.com/image.jpg"
                  />
                </Box>
              </InlineStack>
            </Box>
          )}
        </BlockStack>
      </Box>

      {/* Checkbox Content Section */}
      <Box padding="400">
        <BlockStack gap="300">
          {/* Content type selector */}
          <Select
            label={t('content-type')}
            options={CONTENT_TYPE_OPTIONS.map(opt => ({
              label: t(opt.label.toLowerCase().replace(/ /g, '-')),
              value: opt.value,
            }))}
            value={checkboxContent.contentType}
            onChange={value => onContentChange({ contentType: value as EContentType })}
          />

          {/* Heading - shown based on content type */}
          {showHeading && (
            <ClientOnly fallback={null}>
              {() => (
                <RichTextEditor
                  label={t('heading')}
                  value={checkboxContent.heading}
                  onChange={(value: string) => onContentChange({ heading: value })}
                  toolbarConfig={headingToolbarConfig}
                  plainTextPaste
                  placeholder={t('addon-heading-placeholder')}
                />
              )}
            </ClientOnly>
          )}

          {/* Description - shown based on content type */}
          {showDescription && (
            <ClientOnly fallback={null}>
              {() => (
                <RichTextEditor
                  label={t('description')}
                  value={checkboxContent.description}
                  onChange={(value: string) => onContentChange({ description: value })}
                  toolbarConfig={descriptionToolbarConfig}
                  plainTextPaste
                  placeholder={t('addon-description-placeholder')}
                  // style={{ minHeight: '160px' }}
                />
              )}
            </ClientOnly>
          )}
        </BlockStack>
      </Box>
    </Card>
  )
}
