import { useMemo, useState } from 'react'
import {
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  Checkbox,
  Divider,
  EmptyState,
  InlineError,
  InlineStack,
  Layout,
  Page,
  RangeSlider,
  ResourceItem,
  ResourceList,
  SkeletonBodyText,
  SkeletonDisplayText,
  Text,
  TextField,
  Thumbnail,
} from '@shopify/polaris'

type Product = {
  id: string
  title: string
  price: number
  imageUrl: string
}

type BundleDiscountConfig = {
  selectedProductIds: string[]
  discountPercentage: number
}

const STORAGE_KEY = 'bundle-discount-prototype-config'
const REQUIRED_SELECTION = 3

const MOCK_PRODUCTS: Product[] = [
  { id: 'p1', title: 'Personalized T-Shirt', price: 24.99, imageUrl: 'https://placehold.co/40x40/e8e8e8/666?text=TS' },
  { id: 'p2', title: 'Monogram Tote Bag', price: 19.99, imageUrl: 'https://placehold.co/40x40/e8e8e8/666?text=TB' },
  { id: 'p3', title: 'Custom Mug', price: 14.99, imageUrl: 'https://placehold.co/40x40/e8e8e8/666?text=MG' },
  { id: 'p4', title: 'Engraved Necklace', price: 39.99, imageUrl: 'https://placehold.co/40x40/e8e8e8/666?text=NK' },
  { id: 'p5', title: 'Photo Keychain', price: 12.99, imageUrl: 'https://placehold.co/40x40/e8e8e8/666?text=KC' },
]

function loadPersistedConfig(): BundleDiscountConfig | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<BundleDiscountConfig>

    if (!Array.isArray(parsed.selectedProductIds) || typeof parsed.discountPercentage !== 'number') {
      return null
    }

    return {
      selectedProductIds: parsed.selectedProductIds,
      discountPercentage: parsed.discountPercentage,
    }
  } catch {
    return null
  }
}

function persistConfig(config: BundleDiscountConfig) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

export default function BundleDiscountForm() {
  const [isLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)

  const initialConfig = loadPersistedConfig()

  const [selectedIds, setSelectedIds] = useState<string[]>(initialConfig?.selectedProductIds ?? ['p1', 'p2'])
  const [discount, setDiscount] = useState<number>(initialConfig?.discountPercentage ?? 15)

  const selectedProducts = useMemo(
    () => MOCK_PRODUCTS.filter(product => selectedIds.includes(product.id)),
    [selectedIds]
  )

  const originalTotal = useMemo(
    () => selectedProducts.reduce((sum, product) => sum + product.price, 0),
    [selectedProducts]
  )

  const discountAmount = useMemo(() => originalTotal * (discount / 100), [originalTotal, discount])
  const finalBundleTotal = useMemo(() => originalTotal - discountAmount, [originalTotal, discountAmount])

  const isSelectionValid = selectedIds.length === REQUIRED_SELECTION
  const isDiscountValid = discount >= 1 && discount <= 100
  const canSave = isSelectionValid && isDiscountValid && !isSaving && !isLoading

  const toggleProduct = (id: string) => {
    setShowSuccess(false)
    setSaveError(null)

    setSelectedIds(prev => {
      const hasId = prev.includes(id)
      if (hasId) return prev.filter(item => item !== id)
      if (prev.length >= REQUIRED_SELECTION) return prev
      return [...prev, id]
    })
  }

  const handleDiscountChange = (value: number) => {
    setShowSuccess(false)
    setSaveError(null)
    setDiscount(value)
  }

  const handleDiscountInputChange = (value: string) => {
    const normalized = Number(value)
    if (Number.isNaN(normalized)) return
    handleDiscountChange(normalized)
  }

  const handleDiscard = () => {
    setShowSuccess(false)
    setSaveError(null)

    setSelectedIds(initialConfig?.selectedProductIds ?? ['p1', 'p2'])
    setDiscount(initialConfig?.discountPercentage ?? 15)
  }

  const handleSave = async () => {
    if (!canSave) return

    setSaveError(null)
    setShowSuccess(false)
    setIsSaving(true)

    try {
      persistConfig({
        selectedProductIds: selectedIds,
        discountPercentage: discount,
      })

      setShowSuccess(true)
    } catch {
      setSaveError('Could not save bundle discount. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Page title="Bundle discount" subtitle="Configure bundle discounts for personalized products">
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="200">
                {isLoading ? (
                  <>
                    <SkeletonDisplayText size="small" />
                    <SkeletonBodyText lines={2} />
                  </>
                ) : (
                  <>
                    <Text as="h2" variant="headingMd">
                      Rule setup
                    </Text>
                    <Text as="p" tone="subdued">
                      Select exactly {REQUIRED_SELECTION} products and set a percentage discount.
                    </Text>
                    <Banner tone="info">Changes are stored as a prototype configuration in local storage.</Banner>
                  </>
                )}
              </BlockStack>
            </Card>

            {showSuccess && (
              <Banner tone="success">
                Bundle discount saved successfully. The rule is ready for backend persistence integration.
              </Banner>
            )}

            {saveError && <Banner tone="critical">{saveError}</Banner>}

            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    Product selection
                  </Text>
                  <Text as="span" tone={isSelectionValid ? 'success' : 'subdued'}>
                    {selectedIds.length} / {REQUIRED_SELECTION} selected
                  </Text>
                </InlineStack>

                {isLoading ? (
                  <BlockStack gap="300">
                    <SkeletonBodyText lines={2} />
                    <SkeletonBodyText lines={2} />
                    <SkeletonBodyText lines={2} />
                  </BlockStack>
                ) : MOCK_PRODUCTS.length === 0 ? (
                  <EmptyState
                    heading="No eligible personalized products"
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    action={{ content: 'Go to personalized products' }}
                  >
                    <p>Create personalized products first, then return here to build discount bundles.</p>
                  </EmptyState>
                ) : (
                  <ResourceList
                    items={MOCK_PRODUCTS}
                    renderItem={product => {
                      const checked = selectedIds.includes(product.id)
                      const disabled = !checked && selectedIds.length >= REQUIRED_SELECTION

                      return (
                        <ResourceItem
                          id={product.id}
                          onClick={() => {
                            if (!disabled) toggleProduct(product.id)
                          }}
                          media={<Thumbnail source={product.imageUrl} alt={product.title} />}
                        >
                          <InlineStack align="space-between" blockAlign="center">
                            <BlockStack gap="100">
                              <Text as="span" variant="bodyMd" fontWeight="semibold">
                                {product.title}
                              </Text>
                              <Text as="span" variant="bodySm" tone="subdued">
                                ${product.price.toFixed(2)}
                              </Text>
                            </BlockStack>
                            <Checkbox
                              label=""
                              labelHidden
                              checked={checked}
                              disabled={disabled}
                              onChange={() => toggleProduct(product.id)}
                            />
                          </InlineStack>
                        </ResourceItem>
                      )
                    }}
                  />
                )}
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Discount configuration
                </Text>

                {isLoading ? (
                  <SkeletonBodyText lines={2} />
                ) : (
                  <>
                    <RangeSlider
                      label={`${discount}% off`}
                      value={discount}
                      min={1}
                      max={100}
                      output
                      onChange={value => handleDiscountChange(value as number)}
                    />

                    <TextField
                      label="Exact discount percentage"
                      type="number"
                      autoComplete="off"
                      value={String(discount)}
                      min={1}
                      max={100}
                      suffix="%"
                      onChange={handleDiscountInputChange}
                    />
                  </>
                )}

                {!isDiscountValid && !isLoading && (
                  <InlineError message="Discount must be between 1% and 100%." fieldID="bundle-discount" />
                )}
              </BlockStack>
            </Card>

            {isSelectionValid && !isLoading && (
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Bundle summary
                  </Text>

                  {selectedProducts.map(product => (
                    <InlineStack key={product.id} align="space-between">
                      <Text as="span">{product.title}</Text>
                      <Text as="span">${product.price.toFixed(2)}</Text>
                    </InlineStack>
                  ))}

                  <Divider />

                  <InlineStack align="space-between">
                    <Text as="span" tone="subdued">
                      Original total
                    </Text>
                    <Text as="span" tone="subdued">
                      ${originalTotal.toFixed(2)}
                    </Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" tone="subdued">
                      Discount ({discount}%)
                    </Text>
                    <Text as="span" tone="subdued">
                      -${discountAmount.toFixed(2)}
                    </Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" variant="headingSm">
                      Final bundle total
                    </Text>
                    <Text as="span" variant="headingSm" tone="success">
                      ${finalBundleTotal.toFixed(2)}
                    </Text>
                  </InlineStack>
                </BlockStack>
              </Card>
            )}

            <Card>
              <InlineStack align="end" gap="200">
                <Button disabled={isSaving || isLoading} onClick={handleDiscard}>
                  Discard changes
                </Button>
                <Button variant="primary" loading={isSaving} disabled={!canSave} onClick={handleSave}>
                  Save bundle discount
                </Button>
              </InlineStack>

              {!isSelectionValid && !isLoading && (
                <Box paddingBlockStart="300">
                  <Banner tone="warning">You must select exactly {REQUIRED_SELECTION} products before saving.</Banner>
                </Box>
              )}
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  )
}
