/* eslint-disable max-len */
/* eslint-disable react/no-danger */
import { Card, BlockStack, Text, Box, InlineStack, Scrollable, Icon, Link, Button, TextField } from '@shopify/polaris'
import { LightbulbIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import { useState, useEffect, memo, useCallback, type SyntheticEvent } from 'react'
import { useRootLoaderData } from '~/root'
import { formatShopifyPrice } from '~/shopify/fns'
import type { CheckboxFormState } from './types'
import type { CheckboxGlobalStyling } from '~/types/global-styling'
import { defaultCheckboxStyling } from '~/types/global-styling'
import { useNavigateAppBridge } from '~/bootstrap/hooks/useNavigateAppBridge'
import { NavMenuItems } from '~/bootstrap/app-config'

// Default fallback currency format if shop config is not available
// eslint-disable-next-line no-template-curly-in-string
const DEFAULT_MONEY_FORMAT = '${{amount}}'

// Placeholder image for when no image is available
const PLACEHOLDER_IMAGE = 'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png'

// Declare custom elements for TypeScript
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'onetick-checkbox': {
        children: React.ReactNode
        class: string
        style?: React.CSSProperties
      }
      'onetick-variant-selector-container': {
        children: React.ReactNode
      }
      'onetick-variant-selector': {
        children: React.ReactNode
      }
      'onetick-popup': {
        children: React.ReactNode
        class?: string
        onClick?: (e: Event) => void
      }
    }
  }
}

interface VariantOption {
  id: string
  title: string
  price?: string
  compareAtPrice?: string
}

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
    variants?: VariantOption[]
  }
}

interface CheckboxPreviewProps {
  formState: CheckboxFormState
  selectedVariantData?: SelectedVariantData | null
  checkboxStyling?: CheckboxGlobalStyling
}

export default function CheckboxPreview({ formState, selectedVariantData, checkboxStyling }: CheckboxPreviewProps) {
  const { t } = useTranslation()
  const navigate = useNavigateAppBridge()
  const rootLoaderData = useRootLoaderData()
  const { checkboxContent, popup } = formState

  // Get money format from shop config (similar to OneTick's globalConfigStore)
  const moneyFormat = rootLoaderData?.shopData?.shopConfig?.money_format || DEFAULT_MONEY_FORMAT

  // Currency formatting function (similar to OneTick's formatCurrency)
  const formatCurrency = useCallback(
    (value: string | undefined) => {
      if (!value) return ''
      return formatShopifyPrice(moneyFormat, parseFloat(value))
    },
    [moneyFormat]
  )

  // Local state for checkbox toggle in preview
  const [isChecked, setIsChecked] = useState(checkboxContent.preCheck)

  // Local state for selected variant in preview
  const [previewVariant, setPreviewVariant] = useState<VariantOption | null>(null)
  const [quantity, setQuantity] = useState<number>(1)

  // Sync isChecked state when preCheck changes
  useEffect(() => {
    setIsChecked(checkboxContent.preCheck)
  }, [checkboxContent.preCheck])

  // Sync preview variant when selectedVariantData changes
  useEffect(() => {
    if (selectedVariantData) {
      setPreviewVariant({
        id: selectedVariantData.id,
        title: selectedVariantData.title,
        price: selectedVariantData.price,
        compareAtPrice: selectedVariantData.compareAtPrice,
      })
    } else {
      setPreviewVariant(null)
    }
  }, [selectedVariantData])

  // Check if we have an addon product to preview
  const hasAddonProduct = formState.upsellProducts.length > 0 && selectedVariantData

  // Get values for display
  const productTitle = selectedVariantData?.product?.title || ''
  const variantTitle = previewVariant?.title || selectedVariantData?.title || ''
  const rawPrice = previewVariant?.price || selectedVariantData?.price
  const rawCompareAtPrice = previewVariant?.compareAtPrice || selectedVariantData?.compareAtPrice
  const imageUrl = checkboxContent.imageUrl || selectedVariantData?.product?.featuredImage?.url || PLACEHOLDER_IMAGE

  // Format prices with currency
  const price = formatCurrency(rawPrice) || '$0.00'
  const compareAtPrice = formatCurrency(rawCompareAtPrice)

  // Get variants list for selector
  const variants = selectedVariantData?.product?.variants || []
  const hasMultipleVariants = variants.length > 1 && !selectedVariantData?.product?.hasOnlyDefaultVariant

  // Replace dynamic fields in text
  const updateDynamicFieldsText = (text: string): string => {
    if (!text) return ''
    return text
      .replace(/\{\{price\}\}/g, price)
      .replace(/\{\{compare_at_price\}\}/g, compareAtPrice || '')
      .replace(/\{\{variant_name\}\}/g, variantTitle)
      .replace(/\{\{product_title\}\}/g, productTitle)
  }

  // Check content type for conditional rendering
  const showHeading
    = checkboxContent.contentType === 'heading_only' || checkboxContent.contentType === 'heading_and_description'
  const showDescription
    = checkboxContent.contentType === 'description_only' || checkboxContent.contentType === 'heading_and_description'

  return (
    <BlockStack gap="200">
      <Card padding="0" roundedAbove="sm">
        {/* Header */}
        <Box padding="400" borderBlockEndWidth="025" borderColor="border">
          <Text variant="headingMd" as="span">
            {t('preview-addon')}
          </Text>
        </Box>

        {/* Content */}
        <Scrollable style={{ maxHeight: 'calc(100vh - 156px)' }}>
          {hasAddonProduct ? (
            <Box padding="400">
              <PreviewLayout
                checkboxContent={checkboxContent}
                popup={popup}
                isChecked={isChecked}
                setIsChecked={setIsChecked}
                previewVariant={previewVariant}
                setPreviewVariant={setPreviewVariant}
                variants={variants}
                hasMultipleVariants={hasMultipleVariants}
                imageUrl={imageUrl}
                showHeading={showHeading}
                showDescription={showDescription}
                updateDynamicFieldsText={updateDynamicFieldsText}
                price={price}
                compareAtPrice={compareAtPrice}
                variantTitle={variantTitle}
                showQuantitySelector={checkboxContent.showQuantitySelector}
                quantity={quantity}
                setQuantity={setQuantity}
                checkboxStyling={checkboxStyling}
              />
            </Box>
          ) : (
            /* Empty state */
            <Box paddingBlockStart="1000" paddingBlockEnd="1000" paddingInlineStart="400" paddingInlineEnd="400">
              <Text as="span" variant="bodyMd" tone="subdued" alignment="center">
                {t('complete-adding-upsell-details-first-to-preview-this-widget-here')}
              </Text>
            </Box>
          )}
        </Scrollable>
      </Card>

      {/* Footer with styling link */}
      <Box borderRadius="200" padding="300">
        <InlineStack gap="200" wrap={false} align="center" blockAlign="center">
          <Box minWidth="20px" minHeight="20px">
            <Icon source={LightbulbIcon} tone="subdued" />
          </Box>
          <Text as="span" variant="bodySm" tone="subdued">
            {t('by-default-all-addon-products-are-applied-the-same-styles-as-defined-in')}{' '}
            <Link onClick={() => navigate(NavMenuItems.STOREFRONT_SETUP_CHECKBOXES_STYLING)}>{t('styling')}</Link>
          </Text>
        </InlineStack>
      </Box>
    </BlockStack>
  )
}

// Preview Layout Component - Similar to OneTick's PreviewLayout
interface PreviewLayoutProps {
  checkboxContent: CheckboxFormState['checkboxContent']
  popup: CheckboxFormState['popup']
  isChecked: boolean
  setIsChecked: React.Dispatch<React.SetStateAction<boolean>>
  previewVariant: VariantOption | null
  setPreviewVariant: React.Dispatch<React.SetStateAction<VariantOption | null>>
  variants: VariantOption[]
  hasMultipleVariants: boolean
  imageUrl: string
  showHeading: boolean
  showDescription: boolean
  updateDynamicFieldsText: (text: string) => string
  price: string
  compareAtPrice?: string
  variantTitle: string
  showQuantitySelector: boolean
  quantity: number
  setQuantity: React.Dispatch<React.SetStateAction<number>>
  checkboxStyling?: CheckboxGlobalStyling
}

function PreviewLayout({
  checkboxContent,
  popup,
  isChecked,
  setIsChecked,
  previewVariant,
  setPreviewVariant,
  variants,
  hasMultipleVariants,
  imageUrl,
  showHeading,
  showDescription,
  updateDynamicFieldsText,
  price,
  compareAtPrice,
  variantTitle,
  showQuantitySelector,
  quantity,
  setQuantity,
  checkboxStyling,
}: PreviewLayoutProps) {
  const {
    heading,
    description,
    showPrice,
    showComparedPrice,
    showFeaturedImage,
    showVariantSelector,
    showQuantitySelector: showQtySelector,
  } = checkboxContent

  // Get styling values - use provided styling or fall back to defaults
  const {
    tickIcon,
    defaultBackground,
    activeBackground,
    defaultBorder,
    activeBorder,
    checkboxType,
    checkboxItem,
    imageSize,
  } = checkboxStyling || defaultCheckboxStyling

  // Calculate padding based on checkboxItem styling - same logic as OneTick
  const hasContainerStyling
    = checkboxItem.defaultBackground !== '#FFFFFF00' || checkboxItem.defaultBorder !== '#FFFFFF00'
  const containerPadding = hasContainerStyling ? '16px' : '0px'

  const stopPropagation = useCallback((event: SyntheticEvent) => {
    event.preventDefault()
    event.stopPropagation()
  }, [])

  const handleToggle = useCallback(() => {
    setIsChecked(prev => !prev)
  }, [setIsChecked])

  return (
    <onetick-checkbox
      style={
        {
          '--o-cdbg': checkboxItem.defaultBackground,
          '--o-cdb': checkboxItem.defaultBorder,
          '--o-padding': containerPadding,
        } as React.CSSProperties
      }
      class="onetick-checkbox-container"
    >
      <div className="onetick-d-flex onetick-g-10" style={{ cursor: 'default' }}>
        <div className="onetick-d-flex onetick-g-10 onetick-img-checkbox">
          {/* Custom checkbox */}
          <label
            className="onetick-checkbox"
            style={
              {
                '--o-ti': tickIcon,
                '--o-dbg': defaultBackground,
                '--o-abg': activeBackground,
                '--o-db': defaultBorder,
                '--o-ab': activeBorder,
                '--o-ct': checkboxType,
              } as React.CSSProperties
            }
          >
            <input
              type="checkbox"
              checked={isChecked}
              onInput={e => {
                e.stopPropagation()
                handleToggle()
              }}
              readOnly
            />
            <span className="onetick-checkmark"></span>
          </label>

          {/* Featured image */}
          {showFeaturedImage && (
            <img
              className="onetick-image-checkbox"
              src={imageUrl}
              onError={e => ((e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE)}
              loading="lazy"
              style={{ width: `${imageSize}px`, height: `${imageSize}px` }}
              alt="Checkbox upsell"
            />
          )}
        </div>

        <div className="onetick-d-flex onetick-flex-1 onetick-g-10">
          <div className="onetick-checkbox-content onetick-flex-1">
            <div className="onetick-d-flex onetick-wrap onetick-g-8 onetick-r-g-10 onetick-flex-col">
              <div className="onetick-d-flex onetick-g-4 onetick-flex-col">
                {/* Heading */}
                {showHeading && heading && (
                  <h2
                    className="onetick-label"
                    style={{ fontWeight: 650, cursor: 'pointer' }}
                    onClick={handleToggle}
                    dangerouslySetInnerHTML={{ __html: updateDynamicFieldsText(heading) }}
                  />
                )}
                {/* Description */}
                {showDescription && description && (
                  <span
                    className="onetick-description"
                    style={{ pointerEvents: 'none' }}
                    dangerouslySetInnerHTML={{ __html: updateDynamicFieldsText(description) }}
                  />
                )}
              </div>

              {/* Price */}
              {(showPrice || showComparedPrice) && (
                <div className="onetick-g-8 onetick-d-flex onetick-wrap">
                  {showPrice && (
                    <h2 className="onetick-price" style={{ fontWeight: 550, pointerEvents: 'none' }}>
                      {price}
                    </h2>
                  )}
                  {showComparedPrice && compareAtPrice && (
                    <h2 className="onetick-compared-price" style={{ fontWeight: 450, pointerEvents: 'none' }}>
                      {compareAtPrice}
                    </h2>
                  )}
                </div>
              )}
            </div>

            {/* Variant selector */}
            <VariantSelectorPreview
              showVariantSelector={showVariantSelector}
              hasMultipleVariants={hasMultipleVariants}
              variants={variants}
              previewVariant={previewVariant}
              setPreviewVariant={setPreviewVariant}
              variantTitle={variantTitle}
            />
            {/* Personalize button */}
            {checkboxContent.showPersonalizeButton && (
              <button type="button" className="onetick-personalize-btn" onClick={stopPropagation}>
                {checkboxStyling?.personalizeButton?.buttonText || 'Personalize'}
              </button>
            )}
            {showQtySelector && (
              <Box paddingBlockStart="200" maxWidth="220px">
                <div onClick={stopPropagation} onMouseDown={stopPropagation}>
                  <InlineStack gap="100" blockAlign="center" wrap={false}>
                    <Button
                      size="slim"
                      onClick={() => {
                        setQuantity(prev => Math.max(1, prev - 1))
                      }}
                      disabled={quantity <= 1}
                    >
                      -
                    </Button>
                    <TextField
                      type="number"
                      label="Quantity"
                      labelHidden
                      value={String(quantity)}
                      min={1}
                      autoComplete="off"
                      onChange={value => {
                        const parsed = Number(value)
                        if (!Number.isNaN(parsed)) {
                          setQuantity(Math.max(1, parsed))
                        }
                      }}
                    />
                    <Button
                      size="slim"
                      onClick={() => {
                        setQuantity(prev => prev + 1)
                      }}
                    >
                      +
                    </Button>
                  </InlineStack>
                </div>
              </Box>
            )}
          </div>

          {/* Popup */}
          <PopUpPreview showPopup={popup.showPopup} />
        </div>
      </div>
    </onetick-checkbox>
  )
}

// Popup Preview Component
const PopUpPreview = memo(function PopUpPreview({ showPopup }: { showPopup: boolean }) {
  if (!showPopup) return null

  return (
    <onetick-popup
      onClick={(e: Event) => {
        e.preventDefault()
        e.stopPropagation()
      }}
    >
      <button className="onetick-popup-btn">
        <svg width="21" height="20" viewBox="0 0 21 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M10.6665 14C10.2523 14 9.91649 13.6642 9.9165 13.25L9.91656 9.74999C9.91657 9.33577 10.2524 8.99999 10.6666 9C11.0808 9.00001 11.4166 9.3358 11.4166 9.75001L11.4165 13.25C11.4165 13.6642 11.0807 14 10.6665 14Z"
            fill="#4A4A4A"
          />
          <path
            d="M9.6665 7C9.6665 6.44772 10.1142 6 10.6665 6C11.2188 6 11.6665 6.44772 11.6665 7C11.6665 7.55228 11.2188 8 10.6665 8C10.1142 8 9.6665 7.55228 9.6665 7Z"
            fill="#4A4A4A"
          />
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M17.6665 10C17.6665 13.866 14.5325 17 10.6665 17C6.80051 17 3.6665 13.866 3.6665 10C3.6665 6.13401 6.80051 3 10.6665 3C14.5325 3 17.6665 6.13401 17.6665 10ZM16.1665 10C16.1665 13.0376 13.7041 15.5 10.6665 15.5C7.62894 15.5 5.1665 13.0376 5.1665 10C5.1665 6.96243 7.62894 4.5 10.6665 4.5C13.7041 4.5 16.1665 6.96243 16.1665 10Z"
            fill="#4A4A4A"
          />
        </svg>
      </button>
    </onetick-popup>
  )
})

// Variant Selector Preview Component
const VariantSelectorPreview = memo(function VariantSelectorPreview({
  showVariantSelector,
  hasMultipleVariants,
  variants,
  previewVariant,
  setPreviewVariant,
  variantTitle,
}: {
  showVariantSelector: boolean
  hasMultipleVariants: boolean
  variants: VariantOption[]
  previewVariant: VariantOption | null
  setPreviewVariant: React.Dispatch<React.SetStateAction<VariantOption | null>>
  variantTitle: string
}) {
  if (!showVariantSelector || !hasMultipleVariants) return null

  return (
    <onetick-variant-selector-container>
      <onetick-variant-selector>
        <label>Variant:</label>
        <select
          onChange={e => {
            const selectedId = e.target.value
            const variant = variants.find(v => v.id === selectedId)
            if (variant) {
              setPreviewVariant(variant)
            }
          }}
          onClick={e => {
            e.preventDefault()
            e.stopPropagation()
          }}
          value={previewVariant?.id || ''}
        >
          {variants.map(v => (
            <option key={v.id} value={v.id}>
              {v.title}
            </option>
          ))}
        </select>
        <span id="onetick-addon-variant" data-addon-variant-id={previewVariant?.id}>
          {variantTitle}
        </span>

        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M6.24009 8.20009C6.31232 8.13311 6.39703 8.08101 6.48939 8.04677C6.58175 8.01253 6.67995 7.99682 6.77838 8.00053C6.87681 8.00425 6.97355 8.02732 7.06307 8.06842C7.15258 8.10952 7.23313 8.16786 7.30009 8.24009L10.0001 11.1481L12.7001 8.24009C12.8354 8.09422 13.023 8.00806 13.2218 8.00056C13.4206 7.99306 13.6142 8.06483 13.7601 8.20009C13.906 8.33535 13.9921 8.52302 13.9996 8.72181C14.0071 8.9206 13.9354 9.11422 13.8001 9.26009L10.5501 12.7601C10.4799 12.8358 10.3948 12.8962 10.3002 12.9376C10.2055 12.9789 10.1034 13.0002 10.0001 13.0002C9.89683 13.0002 9.79467 12.9789 9.70003 12.9376C9.60539 12.8962 9.5203 12.8358 9.45009 12.7601L6.20009 9.26009C6.13311 9.18787 6.08101 9.10316 6.04677 9.0108C6.01253 8.91844 5.99682 8.82024 6.00053 8.72181C6.00425 8.62338 6.02732 8.52664 6.06842 8.43712C6.10952 8.34761 6.16786 8.26706 6.24009 8.20009Z"
            fill="#4A4A4A"
          />
        </svg>
      </onetick-variant-selector>
    </onetick-variant-selector-container>
  )
})
