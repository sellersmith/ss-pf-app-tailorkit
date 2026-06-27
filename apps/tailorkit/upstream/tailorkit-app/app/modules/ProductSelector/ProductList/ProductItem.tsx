import type { ProductItemProps } from '../type'
import { Fragment, useCallback, useMemo, useState } from 'react'
import { ChevronDownIcon, ChevronRightIcon, ImageIcon, InfoIcon } from '@shopify/polaris-icons'
import { getProductId, getProductImage, getProductName } from '../fns'
import { getShopifyImageInSpecificWidth } from 'extensions/tailorkit-src/src/assets/fns/shopify-image-url'
import {
  Box,
  Checkbox,
  RadioButton,
  Text,
  InlineStack,
  ResourceItem,
  ResourceList,
  Button,
  Thumbnail,
  Divider,
  BlockStack,
  Badge,
  InlineGrid,
  Icon,
  Tooltip,
} from '@shopify/polaris'
import { useTranslation } from 'react-i18next'

export default function ProductItem({
  source,
  product,
  selectedProducts,
  selectedVariants,
  getProductStatus,
  handleProductSelection,
  handleVariantSelection,
  actions = [],
  multiple = false,
  selectable = true,
  showProductStatus = false,
  autoSelectAllVariants = false,
  hideVariants = false,
  singleVariantSelection = false,
  allowIntegratedProducts = false,
}: ProductItemProps) {
  const { t } = useTranslation()

  const productId = getProductId(product)
  const productName = getProductName(product)
  const productImage = getProductImage(product)
  const hasOnlyDefaultVariant = product?.hasOnlyDefaultVariant

  const CheckerComponent = useMemo(() => (multiple ? Checkbox : RadioButton), [multiple])

  // Toggle state
  const [open, setOpen] = useState(autoSelectAllVariants)
  const handleToggle = useCallback(() => setOpen(!open), [open])

  // Handlers
  const toggleVariantSelection = useCallback(
    (variantId: string) => handleVariantSelection?.(variantId, !selectedVariants?.includes(variantId)),
    [handleVariantSelection, selectedVariants]
  )

  const toggleProductSelection = useCallback(() => {
    const selected = !selectedProducts?.includes(productId)

    handleProductSelection?.(productId, selected)

    if (selected && !open) {
      setOpen(true)
    }
  }, [handleProductSelection, open, productId, selectedProducts])

  // Count selected variants
  const numVariantsSelected = useMemo(
    () => product.variants.filter((v: any) => selectedVariants?.includes(v.id)).length,
    [product.variants, selectedVariants]
  )

  // Selected state
  const isSelected = useMemo(() => {
    // When hideVariants is true, check selectedProducts directly
    if (hideVariants) {
      return selectedProducts?.includes(productId) ?? false
    }
    // Otherwise, check based on variant selection
    return multiple ? numVariantsSelected === product.variants.length : numVariantsSelected > 0
  }, [hideVariants, multiple, numVariantsSelected, product.variants.length, productId, selectedProducts])

  // Count integrated variants
  const numVariantsIntegrated = useMemo(
    () => product.variants.filter((v: any) => v.integrated).length,
    [product.variants]
  )

  // Integration status — block selection only when EVERY variant is integrated. Partial integrations
  // are still selectable so callers can pick the remaining clean variants (per
  // use-product-selection.ts which auto-deselects integrated ones). Note: ProductCard (grid view)
  // uses `some()` instead — for the simplified wizard's Step 1 we surface a "Personalized" Badge in
  // both views, but only the grid view fully disables selection on partial integrations. Server-side
  // `productHasActiveIntegration` guard in `api.onboarding.publish-product` returns 409 for
  // partial-integration products in `integrate-direct` mode as the final safety net.
  const isIntegrated = useMemo(
    () => !allowIntegratedProducts && product.source !== 'dummy' && numVariantsIntegrated === product.variants.length,
    [allowIntegratedProducts, numVariantsIntegrated, product.variants.length, product.source]
  )

  const WrapperComponent = useMemo(() => (selectable ? ResourceItem : Fragment), [selectable])

  const isPublished = useMemo(
    () => (getProductStatus ? getProductStatus(product) : product?.status === 'ACTIVE'),
    [getProductStatus, product]
  )

  const handleProductSelectionChange = useCallback(
    (checked: boolean) => {
      if (!isIntegrated) {
        handleProductSelection?.(productId, checked)
        // Auto-expand to show selected variant
        if (checked && !open) {
          setOpen(true)
        }
      }
    },
    [handleProductSelection, open, productId, isIntegrated]
  )

  return (
    <>
      <WrapperComponent key={productId} id={productId.toString()} onClick={() => {}}>
        <div style={{ cursor: selectable ? 'pointer' : 'initial' }}>
          <InlineGrid alignItems="center" columns={!selectable && actions.length > 0 ? '449px 138px' : 1}>
            <InlineStack gap="300" align="start" blockAlign="center" wrap={false}>
              {selectable ? (
                <>
                  <Box width="20px">
                    {!hasOnlyDefaultVariant && !hideVariants && (
                      <Button
                        variant="monochromePlain"
                        icon={open ? ChevronDownIcon : ChevronRightIcon}
                        onClick={handleToggle}
                      />
                    )}
                  </Box>
                  {source === 'existing' && (
                    <Box width="20px">
                      <CheckerComponent
                        labelHidden
                        label={productName}
                        checked={isSelected}
                        disabled={isIntegrated}
                        id={`${productId.toString()}-checkbox`}
                        onChange={handleProductSelectionChange}
                      />
                    </Box>
                  )}
                </>
              ) : null}

              <Thumbnail
                size="small"
                alt={productName}
                source={productImage ? getShopifyImageInSpecificWidth(productImage, 80) : ImageIcon}
              />

              <div
                onClick={isIntegrated ? undefined : toggleProductSelection}
                style={{ width: !selectable && actions.length > 0 ? 'calc(100% - 52px)' : 'calc(100% - 173px)' }}
              >
                <BlockStack gap="100">
                  <InlineStack gap="200" blockAlign="center" wrap={false}>
                    <Text as="h3" variant="bodyMd" fontWeight="medium" truncate>
                      {productName}
                    </Text>
                    {product.source === 'dummy' && (
                      <InlineStack gap="200">
                        <Tooltip
                          content={t('try-this-demo-to-see-tailorkit-in-action-no-real-inventory-unpublish-anytime')}
                        >
                          <Icon source={InfoIcon} tone="subdued" />
                        </Tooltip>
                        <Badge tone="info">{t('free-and-no-risk')}</Badge>
                      </InlineStack>
                    )}
                    {isIntegrated && (
                      <Tooltip
                        content={t(
                          'this-product-already-has-personalization-open-it-from-the-personalized-products-page-to-edit'
                        )}
                      >
                        <Badge tone="info">{t('personalized')}</Badge>
                      </Tooltip>
                    )}
                  </InlineStack>

                  {showProductStatus ? (
                    <>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        <Badge tone={isPublished ? 'success' : 'warning'}>
                          {isPublished ? t('published') : t('unpublished')}
                        </Badge>
                      </Text>

                      <Text as="p" variant="bodyMd" tone="subdued">
                        {selectable
                          ? t('numintegratedvariants-productvariantslength-variants-selected', {
                              numIntegratedVariants: numVariantsIntegrated,
                              productVariantsLength: product.variants.length,
                            })
                          : t('numvariants-variants', {
                              numVariants: product.variants.length,
                            })}
                      </Text>
                    </>
                  ) : null}
                </BlockStack>
              </div>
            </InlineStack>

            {!selectable && actions.length > 0 ? (
              <InlineStack gap="200" align="end" blockAlign="center" wrap={false}>
                {actions.map(action => (
                  <Button key={action.label} variant="plain" icon={action.icon} onClick={action.onAction}>
                    {action.label}
                  </Button>
                ))}
              </InlineStack>
            ) : null}
          </InlineGrid>
        </div>
      </WrapperComponent>

      {selectable && open && !hasOnlyDefaultVariant && !hideVariants && (
        <>
          <Divider />
          <ResourceList
            items={product.variants}
            renderItem={item => {
              const VariantSelectorComponent = singleVariantSelection ? RadioButton : Checkbox
              return (
                <div
                  id={item.id}
                  key={item.id}
                  style={{ padding: '8px 12px' }}
                  onClick={() => {
                    // For singleVariantSelection, any variant can be selected
                    const canSelectVariant = multiple || singleVariantSelection || selectedProducts?.includes(productId)
                    if ((allowIntegratedProducts || !item.integrated) && canSelectVariant) {
                      toggleVariantSelection(item.id)
                    }
                  }}
                >
                  <InlineStack gap="300" blockAlign="center" wrap={false}>
                    <Box width="20px">&nbsp;</Box>
                    {source === 'existing' && (
                      <Box width="20px">
                        <InlineStack blockAlign="center">
                          <VariantSelectorComponent
                            labelHidden
                            label={item.title}
                            id={`${item.id}-checkbox`}
                            disabled={
                              (!allowIntegratedProducts && item.integrated)
                              || (!multiple && !singleVariantSelection && !selectedProducts?.includes(productId))
                            }
                            checked={selectedVariants?.includes(item.id)}
                            onChange={checked => {
                              // For singleVariantSelection, any variant can be selected
                              const canSelectVariant
                                = multiple || singleVariantSelection || selectedProducts?.includes(productId)
                              if ((allowIntegratedProducts || !item.integrated) && canSelectVariant) {
                                handleVariantSelection?.(item.id, checked)
                              }
                            }}
                          />
                        </InlineStack>
                      </Box>
                    )}
                    <Box>
                      <Text as="h4" variant="bodyMd" fontWeight="medium" truncate>
                        {item.title}
                      </Text>
                    </Box>
                  </InlineStack>
                </div>
              )
            }}
          />
          <Divider />
        </>
      )}
    </>
  )
}
