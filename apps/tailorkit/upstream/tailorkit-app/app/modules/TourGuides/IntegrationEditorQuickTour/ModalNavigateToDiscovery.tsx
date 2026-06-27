/* eslint-disable max-len */
import { BlockStack, List, Modal, Text } from '@shopify/polaris'
import { useCallback } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { useModal } from '~/utils/hooks/useModal'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import {
  NAVIGATE_TO_DISCOVERY_MODAL_KEY,
  NAVIGATE_TO_PUBLISH_PRODUCT_MODAL_KEY,
} from '../TemplateEditorQuickTour/constants'
import { ProductSuggestedCard } from '~/routes/dashboard/components/ProductSuggestedCard'
import type { ITopSellingProductsResult } from '~/routes/api.products/constants'
import { PREFIX_PRODUCT_ID } from '~/constants/shopify'
import { formatShopifyObjectIdToNumberId } from '~/utils/shopify'
import { useNavigateAppBridge } from '~/bootstrap/hooks/useNavigateAppBridge'

/**
 * Modal component shown after publishing first product to encourage publishing more products
 * and guide users toward higher revenue potential
 */
function ModalNavigateToDiscovery({ handleViewLive }: { handleViewLive: () => void }) {
  const { t } = useTranslation()
  const { state, closeModal } = useModal()
  const navigate = useNavigateAppBridge()
  const { trackEvent } = useEventsTracking()

  const navigateToDiscoveryActive = state[NAVIGATE_TO_DISCOVERY_MODAL_KEY]?.active
  const navigateToPublishProductActive = state[NAVIGATE_TO_PUBLISH_PRODUCT_MODAL_KEY]?.active
  const modalActive = navigateToDiscoveryActive || navigateToPublishProductActive

  const onCloseModal = useCallback(() => {
    closeModal(NAVIGATE_TO_DISCOVERY_MODAL_KEY)
    closeModal(NAVIGATE_TO_PUBLISH_PRODUCT_MODAL_KEY)
  }, [closeModal])

  const onSecondaryAction = useCallback(() => {
    onCloseModal()
  }, [onCloseModal])

  const onClickOnStartPersonalizing = useCallback(
    (product: ITopSellingProductsResult) => {
      onCloseModal()
      trackEvent(EVENTS_TRACKING.START_PERSONALIZING_PRODUCT, {
        [EVENTS_PARAMETERS_NAME.START_PERSONALIZING_PRODUCT_FROM]: 'congrats_published_product_modal',
      })

      // Define all URL parameters in a single object for better maintainability
      const urlParameters = {
        openProductSelector: 'true',
        autoSelectAllVariants: 'true',
        defaultSource: product.productSource === 'upsell' ? 'existing' : '',
        ...(product.productDetails
          ? { nonExistingProductData: encodeURIComponent(JSON.stringify(product.productDetails)) }
          : {}),
        productId: formatShopifyObjectIdToNumberId(product.productId, PREFIX_PRODUCT_ID),
      }

      // Convert parameters to URLSearchParams in one operation
      const params = new URLSearchParams(urlParameters)

      // Navigate to personalized products with the parameters
      navigate(`/personalized-products?${params.toString()}`)
    },
    [onCloseModal, trackEvent, navigate]
  )

  return (
    <Modal
      open={modalActive}
      onClose={onCloseModal}
      title={t('congratulations-on-your-first-published-product')}
      size="large"
      secondaryActions={[{ content: t('close'), onAction: onSecondaryAction }]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          {/* Header message */}
          <Text as="p" variant="bodyMd">
            {t('great-start')}
          </Text>

          <List>
            <List.Item>
              <Trans
                t={t}
                components={{
                  a: <a href="#view-live" title={t('view-live-product')} onClick={handleViewLive} />,
                }}
              >
                {t('a-view-live-product-a-you-just-published')}
              </Trans>
            </List.Item>
            <List.Item>{t('boost-sales-by-adding-more-items-use-the-suggestions-below-or-choose-your-own')}</List.Item>
          </List>

          <Text as="h3" variant="bodyMd" fontWeight="bold">
            {t('suggestions')}
          </Text>

          <ProductSuggestedCard
            showInCard={false}
            showIntroText={false}
            onClickOnStartPersonalizing={onClickOnStartPersonalizing}
          />
        </BlockStack>
      </Modal.Section>
    </Modal>
  )
}

export default ModalNavigateToDiscovery
