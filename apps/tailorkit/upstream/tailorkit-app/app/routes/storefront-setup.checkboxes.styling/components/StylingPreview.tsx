/* eslint-disable react/no-danger */
import { Card, BlockStack, Text, Box, Scrollable } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { useRootLoaderData } from '~/root'
import { formatShopifyPrice } from '~/shopify/fns'
import type { CheckboxGlobalStyling } from '~/types/global-styling'
import { defaultCheckboxStyling, defaultPersonalizeButtonStyling } from '~/types/global-styling'

// Default fallback currency format
// eslint-disable-next-line no-template-curly-in-string
const DEFAULT_MONEY_FORMAT = '${{amount}}'

// Demo product image
const DEMO_PRODUCT_IMAGE = 'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png'

// Declare custom element for TypeScript
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'onetick-checkbox': {
        children: React.ReactNode
        class: string
        style?: React.CSSProperties
      }
    }
  }
}

interface StylingPreviewProps {
  styling: CheckboxGlobalStyling
}

export default function StylingPreview({ styling }: StylingPreviewProps) {
  const { t } = useTranslation()
  const rootLoaderData = useRootLoaderData()
  const [isChecked, setIsChecked] = useState(true)
  const [isPersonalized, setIsPersonalized] = useState(false)

  // Get money format from shop config
  const moneyFormat = rootLoaderData?.shopData?.shopConfig?.money_format || DEFAULT_MONEY_FORMAT

  // Format demo prices
  const price = formatShopifyPrice(moneyFormat, 100)
  const compareAtPrice = formatShopifyPrice(moneyFormat, 125)

  // Use provided styling with defaults as fallback
  const {
    tickIcon = defaultCheckboxStyling.tickIcon,
    defaultBackground = defaultCheckboxStyling.defaultBackground,
    activeBackground = defaultCheckboxStyling.activeBackground,
    defaultBorder = defaultCheckboxStyling.defaultBorder,
    activeBorder = defaultCheckboxStyling.activeBorder,
    checkboxType = defaultCheckboxStyling.checkboxType,
    checkboxItem = defaultCheckboxStyling.checkboxItem,
    imageSize = defaultCheckboxStyling.imageSize,
  } = styling

  // Determine container padding based on checkboxItem styling
  const hasContainerStyling
    = checkboxItem.defaultBackground !== '#FFFFFF00' || checkboxItem.defaultBorder !== '#FFFFFF00'
  const containerPadding = hasContainerStyling ? '16px' : '0px'

  return (
    <div className="ot-sticky-preview-card">
      <BlockStack gap="200">
        <Card padding="0" roundedAbove="sm">
          <Box padding="400" borderBlockEndWidth="025" borderColor="border">
            <Text variant="headingMd" as="span">
              {t('preview-addon')}
            </Text>
          </Box>

          <Scrollable style={{ maxHeight: 'calc(100vh - 300px)' }}>
            <Box padding="400">
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
                <div className="onetick-d-flex onetick-g-10" style={{ cursor: 'pointer' }}>
                  <div className="onetick-d-flex onetick-g-10 onetick-img-checkbox">
                    {/* Custom checkbox */}
                    <label
                      className="onetick-checkbox"
                      onClick={() => setIsChecked(!isChecked)}
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
                          setIsChecked(!isChecked)
                        }}
                        readOnly
                      />
                      <span className="onetick-checkmark"></span>
                    </label>

                    {/* Featured image */}
                    <img
                      className="onetick-image-checkbox"
                      src={DEMO_PRODUCT_IMAGE}
                      loading="lazy"
                      style={{ width: `${imageSize}px`, height: `${imageSize}px` }}
                      alt="Checkbox preview"
                    />
                  </div>

                  <div className="onetick-checkbox-content">
                    <div className="onetick-d-flex onetick-wrap onetick-g-8 onetick-r-g-10">
                      <h2 className="onetick-label" style={{ fontWeight: 650 }}>
                        Demo heading
                      </h2>

                      <div className="onetick-g-8 onetick-d-flex onetick-wrap">
                        <h2 className="onetick-price" style={{ fontWeight: 550 }}>
                          {price}
                        </h2>
                        <h2 className="onetick-compared-price" style={{ fontWeight: 450 }}>
                          {compareAtPrice}
                        </h2>
                      </div>
                    </div>

                    <span className="onetick-description">This is a demo description</span>

                    {/* Personalize button — click to toggle like the checkbox */}
                    <button
                      type="button"
                      className={`onetick-personalize-btn${isPersonalized ? ' onetick-personalize-btn--done' : ''}`}
                      style={
                        isPersonalized
                          ? {
                              background: styling.personalizeButton?.doneBackgroundColor || undefined,
                              color: styling.personalizeButton?.doneTextColor || undefined,
                              borderColor: styling.personalizeButton?.doneBorderColor || undefined,
                              borderRadius: `${styling.personalizeButton?.doneBorderRadius ?? 4}px`,
                              padding: `${styling.personalizeButton?.donePaddingBlock ?? 4}px ${styling.personalizeButton?.donePaddingInline ?? 8}px`,
                            }
                          : {
                              background: styling.personalizeButton?.backgroundColor || undefined,
                              color: styling.personalizeButton?.textColor || undefined,
                              borderColor: styling.personalizeButton?.borderColor || undefined,
                              borderRadius: `${styling.personalizeButton?.borderRadius ?? 4}px`,
                              padding: `${styling.personalizeButton?.paddingBlock ?? 4}px ${styling.personalizeButton?.paddingInline ?? 8}px`,
                            }
                      }
                      onClick={() => setIsPersonalized(prev => !prev)}
                    >
                      {isPersonalized
                        ? styling.personalizeButton?.doneText || defaultPersonalizeButtonStyling.doneText
                        : styling.personalizeButton?.buttonText || defaultPersonalizeButtonStyling.buttonText}
                    </button>
                  </div>
                </div>
              </onetick-checkbox>
            </Box>
          </Scrollable>
        </Card>

        <Box padding={'300'}>
          <Text as="span" variant="bodySm" tone="subdued">
            {t('all-addon-products-will-adopt-this-style')}
          </Text>
        </Box>
      </BlockStack>
    </div>
  )
}
