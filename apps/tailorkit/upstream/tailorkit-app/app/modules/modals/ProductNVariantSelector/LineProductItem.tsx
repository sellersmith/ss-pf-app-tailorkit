import {
  Box,
  Text,
  Checkbox,
  InlineStack,
  Thumbnail,
  RadioButton,
  Tooltip,
  Icon,
  Button,
  Collapsible,
} from '@shopify/polaris'
import { ChevronRightIcon, ChevronDownIcon, ImageIcon, InfoIcon } from '@shopify/polaris-icons'
import type { IProductWithVariants, IVariant } from '~/types/shopify-product'
import uniqBy from 'lodash/uniqBy'
import flatten from 'lodash/flatten'
import { useMemo, useCallback, useEffect, useRef } from 'react'
import type { VariantIntegration } from '~/types/integration'
import { buildUrlWithParams } from '~/utils/buildUrlWithParams'
import { getShopifyThumbnail } from '~/utils/loadImage'
import { useTranslation } from 'react-i18next'
import { useProductVariantsLoad } from '~/modules/modals/ProductNVariantSelector/hooks/useProductVariantsLoad'
import styles from './styles.module.css'
import { markLargestDimensionVariants } from './utilities/markLargestDimensionVariants'

interface ILineProductItem {
  product: IProductWithVariants
  selectedVariants: IVariant[] | VariantIntegration[]
  setSelectedVariants: (variants: IVariant[]) => void
  showVariants?: boolean
  currentVariants?: IVariant[]
  currentProductId?: string
  groupAllProductVariants?: any
  allowMultiple?: boolean
  isFirstProduct?: boolean
  showLargestDimension?: boolean
  /** Shopify product IDs to disable (greyed out, non-selectable) */
  excludeProductIds?: string[]
}

export const LineProductItem = ({
  product,
  showVariants = true,
  selectedVariants,
  setSelectedVariants,
  currentVariants = [],
  currentProductId,
  groupAllProductVariants,
  allowMultiple = true,
  isFirstProduct = false,
  showLargestDimension = false,
  excludeProductIds = [],
}: ILineProductItem) => {
  const { id, title, featuredImage, hasOnlyDefaultVariant } = product
  const { t } = useTranslation()
  const { isExpandedProduct, toggleExpandedProduct } = useProductVariantsLoad()
  const manuallyToggled = useRef(false)

  const ComponentCheck = allowMultiple ? Checkbox : RadioButton

  // Get product variants using the hook
  const productVariants = useMemo(() => {
    const _product = showLargestDimension ? markLargestDimensionVariants([product]) : [product]
    return _product[0]?.variants || []
  }, [product, showLargestDimension])

  // Memoize to avoid unnecessary re-renders
  const isDisabledAll = useMemo(() => currentProductId && currentProductId !== id, [currentProductId, id])

  // Flatten all product variants for easier manipulation
  const allSavedVariants = useMemo(
    () => flatten(Object.values(groupAllProductVariants || {})),
    [groupAllProductVariants]
  )

  // Filter out variants that are already selected
  const getFilteredVariants = useCallback((rootVariants: any[], filteredVariants: any[]) => {
    const filteredSet = new Set(filteredVariants.map(v => v.id))
    return rootVariants.filter(v => !filteredSet.has(v.id))
  }, [])

  // Exclude current variants from all saved variants
  const excludedVariants = useMemo(
    () => getFilteredVariants(allSavedVariants, currentVariants),
    [allSavedVariants, currentVariants, getFilteredVariants]
  )

  // Exclude already selected variants from product variants
  const _productVariants = useMemo(
    () => getFilteredVariants(productVariants, excludedVariants),
    [productVariants, excludedVariants, getFilteredVariants]
  )

  // Check if all variants are selected
  const checkLengthOfVariants = useCallback(
    (variants: IVariant[] | VariantIntegration[]) =>
      variants.filter(v => v?.product?.id === id).length === _productVariants.length,
    [id, _productVariants]
  )

  // Product-level: any variant selected = product selected (for showVariants=false)
  // Variant-level: all variants must be selected (original behavior)
  const isSelectedAll = useMemo(() => {
    if (!showVariants) {
      return selectedVariants.some(v => v?.product?.id === id)
    }
    return checkLengthOfVariants(selectedVariants)
  }, [checkLengthOfVariants, selectedVariants, showVariants, id])

  // Check if this product is in the excludeProductIds list
  const isProductExcluded = useMemo(
    () => excludeProductIds.length > 0 && excludeProductIds.includes(id),
    [excludeProductIds, id]
  )

  // Handle toggling of variant selection
  const handleVariantToggle = useCallback(
    (newCheck: boolean, variants: any[]) => {
      const newVariants = newCheck
        ? uniqBy([...selectedVariants, ...variants], 'id')
        : selectedVariants.filter(v => !variants.find(variant => variant.id === v.id))
      setSelectedVariants(allowMultiple ? newVariants : [variants[0]])
    },
    [allowMultiple, selectedVariants, setSelectedVariants]
  )

  // Handle selection of all variants
  const handleSelectAllVariants = useCallback(
    (newCheck: boolean) => handleVariantToggle(newCheck, _productVariants),
    [_productVariants, handleVariantToggle]
  )

  // Handle change in selected variants
  const handleChangeSelectedVariants = useCallback(
    (newCheck: boolean, variantId: string) => {
      const newVariant = productVariants.find(v => v.id === variantId)
      if (newVariant) {
        handleVariantToggle(newCheck, [newVariant])
      }
    },
    [productVariants, handleVariantToggle]
  )

  // Check if all product variants are excluded
  const isExcluded
    = productVariants.length === excludedVariants.filter(ev => productVariants.find(pv => ev.id === pv.id)).length

  // Get the source thumbnail
  // Set the width to 40px for reducing the size of the image and loading time
  const sourceThumbnail = featuredImage?.url ? buildUrlWithParams(featuredImage.url, { width: 80 }) : ImageIcon

  const toggleOpen = useCallback(
    (productId: string) => {
      // Mark as manually toggled
      manuallyToggled.current = true
      toggleExpandedProduct(productId)
    },
    [toggleExpandedProduct]
  )

  // Auto-expand the first product only if it hasn't been manually toggled
  useEffect(() => {
    if (
      isFirstProduct
      && !manuallyToggled.current
      && !isExpandedProduct(id)
      && !hasOnlyDefaultVariant
      && productVariants.length > 0
    ) {
      toggleExpandedProduct(id)
    }
  }, [hasOnlyDefaultVariant, id, isExpandedProduct, isFirstProduct, productVariants.length, toggleExpandedProduct])

  return (
    <>
      {(allowMultiple || !showVariants || (!hasOnlyDefaultVariant && productVariants.length > 0)) && (
        <div
          className={`${styles.productLineItem}${!showVariants || !allowMultiple ? ` ${styles.cursorPointer}` : ''}`}
          onClick={(e?: any) => {
            e?.stopPropagation()
            if (!showVariants) {
              // Product-level selection: click row = select/deselect product
              if (!isProductExcluded && !isDisabledAll && !isExcluded) {
                handleSelectAllVariants(!isSelectedAll)
              }
            } else if (!allowMultiple) {
              toggleOpen(id)
            }
          }}
        >
          <Box
            borderBlockEndWidth="025"
            borderColor="border"
            paddingBlock="200"
            paddingInline="300"
            width="100%"
            maxWidth="100%"
          >
            <InlineStack gap="200" align="start" blockAlign="center" wrap={false}>
              {showVariants && (
                <Button
                  icon={isExpandedProduct(id) ? ChevronDownIcon : ChevronRightIcon}
                  variant="monochromePlain"
                  onClick={(e?: any) => {
                    e?.stopPropagation()
                    toggleOpen(id)
                  }}
                />
              )}

              {(allowMultiple || !showVariants) && (
                <ComponentCheck
                  value={id}
                  label={title}
                  labelHidden
                  id={id}
                  name={allowMultiple ? `product-${id}` : 'single-select-product'}
                  checked={isSelectedAll && !isExcluded}
                  disabled={isDisabledAll || isExcluded || isProductExcluded}
                  onChange={() => {
                    handleSelectAllVariants(!isSelectedAll)
                  }}
                />
              )}

              <Box width="40px" minWidth="40px" padding="0">
                <Thumbnail
                  size="small"
                  source={getShopifyThumbnail(sourceThumbnail)}
                  alt={featuredImage?.altText || 'Product item'}
                />
              </Box>
              <Text as="dd" variant="bodyMd" breakWord>
                {title}
              </Text>
            </InlineStack>
          </Box>
        </div>
      )}

      <Collapsible
        open={isExpandedProduct(id) && showVariants && !hasOnlyDefaultVariant}
        id={`collapsible-${id}`}
        transition={{ duration: '100ms', timingFunction: 'ease-in-out' }}
      >
        {productVariants.map(({ id: vId, title: vTitle, hasLargestDimension }: any) => {
          const isSelected = !!(excludedVariants.find(v => v.id === vId) || selectedVariants.find(v => v.id === vId))
          const isExcluded = !!excludedVariants.find(v => v.id === vId)
          const isDisabled = isDisabledAll || isExcluded

          return (
            <div
              key={vId}
              style={{ width: '100%', cursor: 'pointer' }}
              onClick={e => {
                e.stopPropagation()
                if (!isDisabled) {
                  handleChangeSelectedVariants(!isSelected, vId)
                }
              }}
            >
              <Box borderBlockEndWidth="025" borderColor="border" paddingBlock="200" paddingInline="1000">
                <InlineStack gap="400" align="start" blockAlign="center" wrap={false}>
                  <ComponentCheck
                    value={vId}
                    id={vId}
                    label={vTitle}
                    labelHidden
                    onChange={() => handleChangeSelectedVariants(!isSelected, vId)}
                    name={id}
                    disabled={isDisabled}
                    checked={isSelected && !isExcluded}
                  />
                  <InlineStack gap="100" wrap={false}>
                    <Text as="dd" variant="bodyMd" breakWord fontWeight={hasLargestDimension ? 'bold' : undefined}>
                      {vTitle}
                    </Text>
                    {hasLargestDimension && (
                      <Tooltip content={t('this-variant-is-ideal-for-template-creation')} zIndexOverride={1000}>
                        <Icon source={InfoIcon} tone="info" />
                      </Tooltip>
                    )}
                  </InlineStack>
                </InlineStack>
              </Box>
            </div>
          )
        })}
      </Collapsible>
    </>
  )
}
