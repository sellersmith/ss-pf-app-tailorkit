import { useLocation, useNavigate, useSearchParams } from '@remix-run/react'
import {
  Badge,
  BlockStack,
  Box,
  Button,
  Card,
  Image,
  InlineStack,
  List,
  Modal,
  SkeletonBodyText,
  SkeletonDisplayText,
  Text,
} from '@shopify/polaris'
import isEqual from 'lodash/isEqual'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EVENTS_TRACKING, EVENTS_PARAMETERS_NAME } from '~/bootstrap/constants/eventsTracking'
import { capitalizeFirstLetter } from '~/bootstrap/fns/misc'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EPROVIDER } from '~/constants/fulfillment-providers'
import { useProductIntegrationStatus } from '~/hooks/useProductIntegrationStatus'
import { getProductId } from '~/modules/ProductSelector/fns'
import ProductEditor from '~/modules/ProductSelector/ProductEditor'
import type { ProductData } from '~/modules/ProductSelector/type'
import { useProductProvider } from '~/routes/settings_.providers.product.$id/hooks/useProductProvider'
import {
  handleSelectProductAndOpenIntegration as handleSelectProductIntegration,
  savePublishProductAiMessage,
} from '~/utils/integration/productIntegrationBuilder'
import { showGenericErrorToast } from '~/utils/toastEvents'
import ClipartRenderer from './ClipartRenderer.client'
import type { ProductRecommendationBlock } from './fns'
import { duplicateTemplateAndOpenIntegration } from './productCtaHelpers'
import type { ProductImportConfig } from '~/utils/product/productImportUtils'
import { useChatBot } from '~/providers/ChatBotContext'
import { isMaxModalRoute } from '~/utils/shopify'
import { CheckCircleIcon } from '@shopify/polaris-icons'
import { markAiOnboardingCompleted } from '~/modules/Onboarding/utilities/saveUserJourneyProgress'
import { localStorage } from 'extensions/tailorkit-src/src/assets/utils/localStorage'
import { FlexCenter } from '../common/Flex'
import useSaveAndPublishIntegration from '~/modules/ProductEditor/hooks/useSaveIntegration'
import { deleteTemporaryIntegration, getTemporaryIntegration } from '~/utils/integration/temporaryIntegration'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import { useRootLoaderData } from '~/root'
import { authenticatedFetch } from '~/shopify/fns.client'
import { PRODUCT_MUTATION_ACTIONS } from '~/routes/api.products/constants'

interface ProductRecommendationCardProps {
  block: ProductRecommendationBlock
  onUpdate?: (block: ProductRecommendationBlock) => void
}

// Helper function to check if the block has real data
function hasRealData(block: ProductRecommendationBlock): boolean {
  const result = !!(
    (block.data.title && block.data.title.trim())
    || (block.data.price && block.data.price.trim())
    || (block.data.variants && block.data.variants.length > 0)
    || (block.data.personalizationStyle && block.data.personalizationStyle.trim())
    || (block.data.mockupImage && block.data.mockupImage.url)
    || (block.data.ctaButton && block.data.ctaButton.text)
  )

  return result
}

export default function ProductRecommendationCard({ block, onUpdate }: ProductRecommendationCardProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const isMaxModalScreen = isMaxModalRoute(location.pathname)

  const [searchParams] = useSearchParams()
  const isOnboardingRoute = useMemo(() => searchParams.get('onboarding') === 'true', [searchParams])

  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)

  const [open, setOpen] = useState(false)
  const [edited, setEdited] = useState<ProductData>()
  const { trackEvent } = useEventsTracking()
  const { handleSaveProductToDataBase } = useProductProvider()
  const { toggleChatBot, saveAiMessage, currentConversation } = useChatBot()

  // Check if this product is already integrated
  const { isIntegrated, isLoading: integrationLoading } = useProductIntegrationStatus(
    block.data.productId,
    block.data.variantIds
  )

  const editing = useMemo(() => block.data.rawProduct?.printifyProduct, [block.data.rawProduct])

  const handleOpenModalEditProduct = useCallback(() => {
    setOpen(true)
  }, [])

  const handleCloseModalEditProduct = useCallback(() => {
    // Track event
    trackEvent(EVENTS_TRACKING.CLOSE_MODAL_IMPORT_AND_CREATE_PERSONALIZED_PRODUCT, {
      source: block.data.provider?.name,
      productTitle: block.data.title,
      productId: getProductId(block.data.rawProduct as ProductData),
    })

    setOpen(false)
  }, [block.data.provider?.name, block.data.title, block.data.rawProduct, trackEvent])

  // Prepare variables for in-chat publishing
  const [action, setAction] = useState<string | undefined>()

  const {
    shopData: { shopDomain },
  } = useRootLoaderData()

  const { saveIntegration, publishIntegration } = useSaveAndPublishIntegration()

  const handleCtaClick = useCallback(
    async (action?: string) => {
      if (loading) return

      setAction(action)

      if (action === 'publish_as_new_product') {
        if (block.data.productUrl) {
          return window.open(block.data.productUrl, '_blank')
        }
      }

      try {
        setLoading(true)

        if (block.data.provider?.name === EPROVIDER.PRINTIFY || block.case === 2) {
          // Track event
          trackEvent(EVENTS_TRACKING.IMPORT_AND_CREATE_PERSONALIZED_PRODUCT, {
            source: block.data.provider?.name,
            productTitle: block.data.title,
            productId: getProductId(block.data.rawProduct as ProductData),
          })

          handleOpenModalEditProduct()
        } else {
          // Create personalised product flow
          const templateId = block.data.clipart?.templateId
          if (!templateId) {
            console.error('Missing templateId in clipart data')
            return
          }

          // Track event
          trackEvent(EVENTS_TRACKING.CREATE_PERSONALIZED_PRODUCT, {
            source: block.data.provider?.name,
            productTitle: block.data.title,
            productId: getProductId(block.data.rawProduct as ProductData),
          })

          trackEvent(EVENTS_TRACKING.SELECT_PRODUCT_SOURCE, { source: 'existing' })

          trackEvent(EVENTS_TRACKING.BUILD_WITH_AI, {
            feature: 'ai_gen_product',
          })

          // Track the time when user use AI feature
          localStorage.setItem('TLK_USE_AI_FEATURE_AT', Date.now().toString())

          // Mark AI onboarding completed
          markAiOnboardingCompleted()

          // Clone existing product to avoid affecting the merchant's sales on existing product
          if (!block.data.productUrl) {
            // Generate new product title
            const newTitle = t('personalized-title', { title: block.data?.title }).trim()

            const newProduct = await authenticatedFetch('/api/products', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                newTitle,
                productId: block.data.productId,
                action: PRODUCT_MUTATION_ACTIONS.DUPLICATE_EXISTING_PRODUCT,
                options: {
                  status: 'ACTIVE',
                  includeImages: true,
                },
              }),
            }).catch(console.error)

            if (newProduct) {
              block.data.productId = newProduct.productId
              block.data.variantIds = newProduct.variantIds

              // Generate product URL
              block.data.productUrl = `https://${shopDomain}/products/${newProduct.handle}`
            }
          }

          if (!block.data.integrationUrl) {
            block.data.integrationUrl = await duplicateTemplateAndOpenIntegration(
              templateId,
              block.data.clipart,
              block.data
            )

            // Track clipart conversion from AI chat
            try {
              const convertEventProps = {
                [EVENTS_PARAMETERS_NAME.CLIPART_ID]: templateId,
                [EVENTS_PARAMETERS_NAME.CLIPART_NAME]: block.data.clipart?.alt || '',
                [EVENTS_PARAMETERS_NAME.SOURCE_COMPONENT]: 'ai_chat',
              }
              trackEvent(EVENTS_TRACKING.CLIPART_CONVERT, convertEventProps)
            } catch (e) {
              console.error('[TK Analytics] Failed to track CLIPART_CONVERT', e)
            }
          }

          if (['publish_as_new_product', 'edit_as_new_product'].includes(action as string)) {
            // Auto-save integration
            const mockupId = block.data.integrationUrl.match(/mockup=([^&]+)/)?.[1]
            const integrationData = mockupId && (await getTemporaryIntegration(mockupId))

            integrationData
              && IntegrationStore.dispatch({
                skipTrace: true,
                type: 'INIT_DATA',
                payload: { state: integrationData },
              })

            // Save new integration
            await saveIntegration(true)

            // Publish new integration
            if (action === 'publish_as_new_product') {
              try {
                block.data.published = !!(await publishIntegration())
              } catch (e: any) {
                showGenericErrorToast()
              }
            }

            // Delete temporary data
            mockupId && (await deleteTemporaryIntegration(mockupId))

            if (action === 'edit_as_new_product') {
              navigate(block.data.integrationUrl)
            }

            return
          }

          if (action === 'edit_as_new_product') {
            return navigate(block.data.integrationUrl)
          }

          // Save AI message for this integration using reusable utility
          await savePublishProductAiMessage({
            integrationUrl: block.data.integrationUrl,
            productTitle: block.data.title || 'Custom Product',
            templateTitle: 'AI Generated Design',
            messageContent: t('ai-chat-product-recommendation-card-success-message'),
            saveAiMessage,
          })

          // Close the chat bot
          toggleChatBot(false)

          // Navigate to integration without success message parameter since AI message is now persistent
          navigate(block.data.integrationUrl)
        }

        setAction(undefined)
      } catch (err) {
        console.error('CTA processing error', err)
      } finally {
        setLoading(false)
      }
    },
    [
      loading,
      block.data,
      block.case,
      trackEvent,
      handleOpenModalEditProduct,
      t,
      saveAiMessage,
      toggleChatBot,
      navigate,
      shopDomain,
      saveIntegration,
      publishIntegration,
    ]
  )

  const handleSelectProductAndOpenIntegration = useCallback(async () => {
    if (processing || !edited || !block.data.provider) return

    try {
      setProcessing(true)

      // Validate that we have all required data
      if (!edited.variants?.length || edited.variants.length > 100) {
        throw new Error('Invalid number of variants. Must be between 1 and 100.')
      }

      // Prepare product data for import
      const productData = edited as unknown as ProductImportConfig['productData']

      // Call the reusable integration builder
      const result = await handleSelectProductIntegration({
        productData,
        source: block.data.provider._id,
        onSaveToDatabase: handleSaveProductToDataBase,
        templateId: block.data.clipart?.templateId,
        clipartData: block.data.clipart,
        title: 'AI Generated Design',
        saveAiMessage,
        conversationId: currentConversation.id,
        t,
      })

      if (!result.success) {
        throw new Error(result.message || 'Failed to create integration')
      }

      const source = block.data.provider.name
      // Track success event
      trackEvent(EVENTS_TRACKING.IMPORT_PROVIDER_PRODUCTS_TO_SHOPIFY, {
        source,
        blueprintId: edited.blueprintId,
        brandName: edited.brandName,
        model: edited.model,
        title: edited.title,
        printProvider: edited.providers?.find(p => p.id.toString() === edited.provider)?.name,
      })

      // Track event
      trackEvent(EVENTS_TRACKING.SELECT_PRODUCT_SOURCE, { source })

      trackEvent(EVENTS_TRACKING.BUILD_WITH_AI, {
        feature: 'ai_gen_product',
      })

      // Track the time when user use AI feature
      localStorage.setItem('TLK_USE_AI_FEATURE_AT', Date.now().toString())

      // Mark AI onboarding completed
      markAiOnboardingCompleted()

      // Close the modal
      setOpen(false)

      // Close the chat bot
      toggleChatBot(false)

      // Navigate to the integration
      if (result.integrationUrl) {
        navigate(result.integrationUrl)
      }

      // Close modal
      setOpen(false)
    } catch (error: any) {
      console.error('Error in handleSelectProductAndOpenIntegration:', error)
      showGenericErrorToast()
    } finally {
      setProcessing(false)
    }
  }, [
    processing,
    edited,
    block.data.provider,
    block.data.clipart,
    handleSaveProductToDataBase,
    saveAiMessage,
    currentConversation.id,
    t,
    trackEvent,
    toggleChatBot,
    navigate,
  ])

  const handleEditProduct = useCallback(
    (product: ProductData) => {
      const _edited = { ...editing, ...edited, ...product }

      if (!isEqual(_edited, edited)) {
        setEdited(_edited)

        // Track event
        trackEvent(EVENTS_TRACKING.EDIT_PROVIDER_PRODUCT, {
          source: block.data.provider?.name,
          productTitle: _edited.title,
          productId: getProductId(_edited),
          productDescription: _edited.description,
          numVariants: _edited.variants?.length || 0,
        })
      }
    },
    [editing, edited, trackEvent, block.data.provider?.name]
  )

  // Check if we have real data
  const hasRealProductData = hasRealData(block)

  // For analyzing state, just show the analyzing skeleton
  if (block.state === 'analyzing') {
    return (
      <Card>
        <BlockStack gap="200">
          <SkeletonDisplayText size="small" />
          <SkeletonBodyText lines={2} />
          <SkeletonBodyText lines={1} />
        </BlockStack>
      </Card>
    )
  }

  // Only render if we have real data or the block is complete
  if (!hasRealProductData && block.state !== 'complete') {
    return (
      <Card>
        <BlockStack gap="200">
          <SkeletonDisplayText size="small" />
          <SkeletonBodyText lines={3} />
          <div style={{ height: '200px', backgroundColor: '#f6f6f7', borderRadius: '8px' }}>
            <SkeletonBodyText lines={6} />
          </div>
          <div style={{ height: '36px', backgroundColor: '#f6f6f7', borderRadius: '6px' }}>
            <SkeletonBodyText lines={1} />
          </div>
        </BlockStack>
      </Card>
    )
  }

  return (
    <FlexCenter>
      <div style={{ width: isOnboardingRoute ? '70%' : '100%' }}>
        <Card>
          <BlockStack>
            {/* Product Title with Badge */}
            <InlineStack gap="200" blockAlign="center" wrap={false}>
              {block.data.title ? (
                <BlockStack gap="200">
                  <Text variant="headingMd" as="h3">
                    {block.data.title}
                  </Text>
                  {block.data.badge && (
                    <Box>
                      <Badge tone="info">{`${t('imported-from')} ${capitalizeFirstLetter(block.data.badge?.text)}`}</Badge>
                    </Box>
                  )}
                </BlockStack>
              ) : (
                <SkeletonDisplayText size="small" />
              )}
            </InlineStack>

            <List type="bullet">
              {/* Provider (Case 2 only) */}
              {block.case === 2 && block.data.provider && (
                <List.Item>
                  {t('provider')}: {capitalizeFirstLetter(block.data.provider.name)}
                </List.Item>
              )}

              {/* Price */}
              {block.data.price ? (
                <List.Item>
                  {t('price')}: {block.data.price}
                </List.Item>
              ) : (
                <SkeletonBodyText lines={1} />
              )}
            </List>

            <BlockStack gap="200">
              {/* Product Image */}
              {block.data.mockupImage && block.data.mockupImage.url ? (
                <Box background="bg-surface-secondary" borderRadius="200" padding="400">
                  <div
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      maxHeight: '40vh',
                      overflow: 'hidden',
                    }}
                  >
                    {block.data.clipart ? (
                      // Render with Konva-based clipart overlay
                      <ClipartRenderer
                        productImage={block.data.mockupImage}
                        clipart={block.data.clipart}
                        maxHeightVh={40}
                      />
                    ) : (
                      // Render normal image without clipart
                      <Image
                        style={{
                          width: '100%',
                          height: 'auto',
                          maxHeight: '30vh',
                          objectFit: 'contain',
                          display: 'block',
                          borderRadius: '4px',
                        }}
                        source={block.data.mockupImage.url}
                        alt={block.data.mockupImage.alt}
                      />
                    )}
                  </div>
                </Box>
              ) : (
                <div style={{ height: '200px', backgroundColor: '#f6f6f7', borderRadius: '8px' }}>
                  <SkeletonBodyText lines={6} />
                </div>
              )}

              {/* CTA Button */}
              {block.data.callToActions ? (
                <BlockStack gap="200">
                  {block.data.callToActions.map((cta, idx) => (
                    <Button
                      key={cta.id}
                      fullWidth
                      size="large"
                      onClick={() => handleCtaClick(cta.action)}
                      variant={idx === 0 ? 'primary' : 'secondary'}
                      disabled={!cta.enabled || loading || isMaxModalScreen}
                    >
                      {loading && action === cta.action
                        ? t('processing')
                        : cta.action === 'publish_as_new_product' && block.data.productUrl
                          ? block.data.published
                            ? t('view-product')
                            : t('publish-product')
                          : cta.action === 'edit_as_new_product' && block.data.productUrl
                            ? t('edit-product')
                            : t(cta.text)}
                    </Button>
                  ))}
                </BlockStack>
              ) : block.data.ctaButton && block.data.ctaButton.text ? (
                isIntegrated ? (
                  <Button icon={CheckCircleIcon} variant="primary" size="large" fullWidth disabled={true}>
                    {t('personalized-product-created')}
                  </Button>
                ) : integrationLoading ? (
                  <div style={{ height: '36px', backgroundColor: '#f6f6f7', borderRadius: '6px' }}>
                    <SkeletonBodyText lines={1} />
                  </div>
                ) : (
                  <Button
                    fullWidth
                    size="large"
                    variant="primary"
                    onClick={handleCtaClick}
                    disabled={!block.data.ctaButton.enabled || loading || isMaxModalScreen}
                  >
                    {loading ? t('processing') : t(block.data.ctaButton.text)}
                  </Button>
                )
              ) : (
                <div style={{ height: '36px', backgroundColor: '#f6f6f7', borderRadius: '6px' }}>
                  <SkeletonBodyText lines={1} />
                </div>
              )}
            </BlockStack>
          </BlockStack>

          {block.data.rawProduct?.printifyProduct && (
            <Modal
              open={open}
              size="large"
              onClose={handleCloseModalEditProduct}
              title={t('select-products')}
              primaryAction={{
                content: t('select'),
                onAction: handleSelectProductAndOpenIntegration,
                loading: processing,
                disabled: !edited?.variants?.length || processing,
              }}
            >
              <ProductEditor
                source={block.data.provider?._id}
                product={editing}
                disabled={processing}
                sourceName={block.data.provider!.name}
                onEditProduct={handleEditProduct}
              />
            </Modal>
          )}
        </Card>
      </div>
    </FlexCenter>
  )
}
