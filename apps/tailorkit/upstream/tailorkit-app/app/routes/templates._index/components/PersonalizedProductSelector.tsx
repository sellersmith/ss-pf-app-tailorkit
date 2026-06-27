import {
  Modal,
  TextField,
  Button,
  BlockStack,
  InlineStack,
  Thumbnail,
  Text,
  RadioButton,
  Spinner,
  Bleed,
} from '@shopify/polaris'
import { useState, useCallback, useMemo, useEffect } from 'react'
import { useNavigate } from '@remix-run/react'
import { useTranslation } from 'react-i18next'
import { ImageIcon, PlusIcon } from '@shopify/polaris-icons'
import { getShopifyThumbnail } from '~/utils/loadImage'
import { authenticatedFetch } from '~/shopify/fns.client'
import { SHOPIFY_API_ACTIONS } from '~/routes/api.shopify/constants'
import { VARIANTS_INTEGRATIONS_ACTIONS } from '~/routes/api.variants-integrations/constants'
import { generateIntegrationEditorUrl } from '~/modules/ProductEditor/constants'

export interface PersonalizedProduct {
  [key: string]: string[]
}

// Minimal subset of Shopify product shape returned by `/api/shopify?action=getProducts`.
// Kept local because upstream `IProduct` mandates more fields than this modal needs.
interface ShopifyProductSummary {
  id: string
  title?: string
  featuredImage?: { url?: string }
}

// Product plus the first variant id chosen for this template, used to resolve integration.
type PersonalizedProductItem = ShopifyProductSummary & { firstVariant_id?: string }

interface VariantIntegrationPrintArea {
  _id: string
  template?: string
}

interface IntegrationLookupResult {
  integration?: { _id?: string }
  variantIntegration?: {
    mockup?: string
    printAreas?: VariantIntegrationPrintArea[]
  }
}

interface PersonalizedProductSelectorProps {
  open: boolean
  templateId: string
  products: PersonalizedProduct
  onClose: () => void
  onCreateNew: () => void
}

export default function PersonalizedProductSelector({
  open,
  templateId,
  products: initialProducts,
  onClose,
  onCreateNew,
}: PersonalizedProductSelectorProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<PersonalizedProductItem | null>(null)
  const [products, setProducts] = useState<PersonalizedProductItem[] | undefined>()
  const [initialLoading, setInitialLoading] = useState(true)
  const [openingIntegration, setOpeningIntegration] = useState(false)

  // Fetch product details from Shopify
  const _productIds = initialProducts && Object.keys(initialProducts).join(',')

  useEffect(() => {
    if (!products) {
      ;(async () => {
        const fetched: ShopifyProductSummary[] | undefined = await authenticatedFetch(
          `/api/shopify?action=${SHOPIFY_API_ACTIONS.GET_PRODUCTS}&ids=${_productIds || ''}`,
          {
            preferCache: true,
          }
        )

        const _products: PersonalizedProductItem[] | undefined = fetched?.map(product => ({
          ...product,
          firstVariant_id: initialProducts[product.id]?.[0],
        }))
        setProducts(_products)
        setInitialLoading(false)
      })()
    }
  }, [_productIds, initialProducts, products])

  // Filter products based on search query
  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products

    const query = searchQuery.toLowerCase()
    return products?.filter(product => product?.title?.toLowerCase().includes(query))
  }, [products, searchQuery])

  // Handle product selection
  const handleSelect = useCallback(async () => {
    if (!selectedProduct?.firstVariant_id) return
    setOpeningIntegration(true)

    const getIntegrationData = async (variant_id: string): Promise<IntegrationLookupResult | null> => {
      const res = await authenticatedFetch(`/api/variants-integrations`, {
        method: 'POST',
        body: JSON.stringify({ action: VARIANTS_INTEGRATIONS_ACTIONS.GET_INTEGRATION_BY_VARIANT_ID, variant_id }),
        headers: { 'Content-Type': 'application/json' },
      })

      if (res && res.success) {
        return {
          integration: res.integration,
          variantIntegration: res.variantIntegration,
        }
      }
      return null
    }

    const integrationData = await getIntegrationData(selectedProduct.firstVariant_id)

    try {
      const integrationId = integrationData?.integration?._id
      const mockupId = integrationData?.variantIntegration?.mockup
      const printAreas = integrationData?.variantIntegration?.printAreas || []
      const printArea = printAreas.find(pa => pa.template === templateId)
      const printAreaId = printArea?._id

      if (integrationId && mockupId) {
        navigate(
          generateIntegrationEditorUrl({
            integrationId,
            mockupId,
            tab: 'design',
            printAreaId,
            templateId: templateId || undefined,
          })
        )
      }
    } catch (error) {
      console.error('[PersonalizedProductSelector] Failed to open integration:', error)
    }
  }, [selectedProduct, navigate, templateId])

  // Opens the full Shopify ProductSelector modal. Same flow whether invoked from the
  // top "+ Create personalized product" button or the empty-state "Search all" CTA —
  // both let the merchant pick any Shopify product to bind this template to.
  const handleOpenProductSelector = useCallback(() => {
    // Don't call onClose here - let parent handle the transition
    // to avoid clearing template data before ProductSelector opens
    onCreateNew()
  }, [onCreateNew])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('select-personalized-products')}
      primaryAction={{
        content: t('select'),
        loading: openingIntegration,
        onAction: handleSelect,
        disabled: !selectedProduct?.id,
      }}
      secondaryActions={[
        {
          content: t('cancel'),
          onAction: onClose,
        },
      ]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          {/* Create new button */}
          <Bleed marginBlock={'300'}>
            <InlineStack align="end">
              <Button icon={PlusIcon} onClick={handleOpenProductSelector} size="slim">
                {t('create-personalized-product')}
              </Button>
            </InlineStack>
          </Bleed>

          {/* Search field */}
          <TextField
            label=""
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={t('search-personalized-products')}
            autoComplete="off"
            clearButton
            onClearButtonClick={() => setSearchQuery('')}
            disabled={openingIntegration}
          />

          {/* Product list */}
          {initialLoading ? (
            <InlineStack align="center">
              <Spinner size="small" />
            </InlineStack>
          ) : (
            <BlockStack gap="300">
              {filteredProducts?.length === 0 ? (
                <BlockStack gap="200">
                  <Text as="p" tone="subdued">
                    {searchQuery ? t('no-products-found') : t('no-personalized-products-found')}
                  </Text>
                  {searchQuery && (
                    <InlineStack>
                      <Button icon={PlusIcon} onClick={handleOpenProductSelector} size="slim">
                        {t('search-all-shopify-products')}
                      </Button>
                    </InlineStack>
                  )}
                </BlockStack>
              ) : (
                filteredProducts?.map(product => (
                  <div
                    key={product.id}
                    onClick={() => setSelectedProduct(product)}
                    className="personalized-product-row"
                  >
                    <InlineStack gap="200" blockAlign="center" wrap={false}>
                      <RadioButton
                        label=""
                        checked={selectedProduct?.id === product.id}
                        id={product.id}
                        name="personalized-product"
                        onChange={() => setSelectedProduct(product)}
                      />
                      <InlineStack gap="200" blockAlign="center" wrap={false}>
                        <Thumbnail
                          source={getShopifyThumbnail(product?.featuredImage?.url) || ImageIcon}
                          alt={product?.title || ''}
                          size="small"
                        />
                        <Text as="span" variant="bodyMd">
                          {product?.title}
                        </Text>
                      </InlineStack>
                    </InlineStack>
                  </div>
                ))
              )}
            </BlockStack>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  )
}
