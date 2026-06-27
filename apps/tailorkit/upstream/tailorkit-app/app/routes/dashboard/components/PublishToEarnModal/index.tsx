import {
  Bleed,
  BlockStack,
  Box,
  Button,
  Divider,
  Icon,
  InlineStack,
  Modal,
  ProgressBar,
  Spinner,
  Text,
  Tooltip,
} from '@shopify/polaris'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from '@remix-run/react'
import { useModal } from '~/utils/hooks/useModal'
import { MODAL_ID } from '~/constants/modal'
import { BadgeCard } from './components/BadgeCard'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { ELink } from '~/constants/enum'
import { useTranslation } from 'react-i18next'
import { ExternalIcon, InfoIcon } from '@shopify/polaris-icons'
import type { PTEBadge } from '~/api/services/achievements'
import { usePTEStatus } from '../../hooks/usePTEStatus'
import { MODALS } from '~/components/AppBridge/ui-modal/constants'
import { ProductSuggestedCard } from '../ProductSuggestedCard'
import type { ITopSellingProductsResult } from '~/routes/api.products/constants'
import { formatShopifyObjectIdToNumberId } from '~/utils/shopify'
import { PREFIX_PRODUCT_ID } from '~/constants/shopify'
import { useNavigateAppBridge } from '~/bootstrap/hooks/useNavigateAppBridge'
import { CollapsibleSection } from '~/modules/CollapsibleSection'
import { useProductSuggestion } from '../ProductSuggestedCard/hooks/useProductSuggestion'
import { getTotalProductsTarget } from '../../utilities/pteBadgeUtils'
import useDevices from '~/utils/hooks/useDevice'
import { useIsUnifiedEditor } from '~/hooks/useIsUnifiedEditor'

/**
 * PublishToEarnModal component displays the Publish to Earn achievement system
 */
export default function PublishToEarnModal() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigateAppBridge()
  const { state, closeModal, openModal } = useModal()
  const { trackEvent } = useEventsTracking()
  const { data: pteStatus, loading, error, refetch } = usePTEStatus()
  const { products } = useProductSuggestion(undefined, 4)
  const { isSmallMobileView, isMobileView } = useDevices()
  const isUnifiedEditor = useIsUnifiedEditor()

  const [openCollapsible, setOpenCollapsible] = useState(false)
  const modalState = state?.[MODAL_ID.PUBLISH_TO_EARN_MODAL]
  const isOpen = modalState?.active || false

  // Track previous open state to detect when modal transitions from closed to open
  const prevIsOpenRef = useRef(false)

  // Ref for the end of collapsible section to scroll to when opened
  const collapsibleSectionEndRef = useRef<HTMLDivElement>(null)

  // Calculate total products target dynamically from badges (same as Card component)
  const totalProducts = useMemo(() => getTotalProductsTarget(pteStatus?.badges), [pteStatus?.badges])

  // Use publishedCount directly without capping (same as Card component)
  // Note: publishedCount from API is maxPublishedCount for campaigns (persistent badges)
  const publishedCount = pteStatus?.publishedCount || 0

  // Calculate progress percentage (same as Card component)
  const progress = useMemo(() => {
    if (totalProducts === 0) return 0
    return Math.min((publishedCount / totalProducts) * 100, 100)
  }, [publishedCount, totalProducts])

  /**
   * Track modal opened event and refetch data to ensure sync with Card
   * Only refetch when modal transitions from closed to open (not on every render)
   */
  useEffect(() => {
    // Only refetch when modal transitions from closed to open
    if (isOpen && !prevIsOpenRef.current) {
      trackEvent(EVENTS_TRACKING.PTE_MODAL_OPENED)
      // Refetch data when modal opens to ensure it's in sync with Card component
      refetch().catch(err => {
        console.error('Failed to refetch PTE status:', err)
      })
    }
    // Update ref for next render
    prevIsOpenRef.current = isOpen
  }, [isOpen, trackEvent, refetch])

  /**
   * Auto-scroll to the very bottom of modal content when collapsible section opens
   * Finds the Modal's scrollable container and scrolls to the absolute bottom
   */
  useEffect(() => {
    if (openCollapsible) {
      // Use setTimeout to ensure the content is fully rendered before scrolling
      const timeoutId = setTimeout(() => {
        // Find the scrollable container by looking for Modal's content wrapper
        // Polaris Modal wraps content in a div with specific classes
        const modalContent = document.querySelector('[role="dialog"]')
        if (!modalContent) return

        // Find the scrollable container within the modal
        let scrollableContainer: HTMLElement | null = null

        // Try to find scrollable div (Polaris Modal structure)
        const possibleContainers = modalContent.querySelectorAll('div')
        for (const div of Array.from(possibleContainers)) {
          const style = window.getComputedStyle(div)
          if (
            div.scrollHeight > div.clientHeight
            && (style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflow === 'auto')
          ) {
            scrollableContainer = div
            break
          }
        }

        if (scrollableContainer) {
          // Scroll to the absolute bottom
          scrollableContainer.scrollTo({
            top: scrollableContainer.scrollHeight,
            behavior: 'smooth',
          })
        } else {
          // Fallback: try to scroll the target element into view at the end
          if (collapsibleSectionEndRef.current) {
            collapsibleSectionEndRef.current.scrollIntoView({
              behavior: 'smooth',
              block: 'end',
            })
          }
        }
      }, 300)

      return () => clearTimeout(timeoutId)
    }
  }, [openCollapsible])

  /**
   * Handle modal close
   */
  const handleClose = useCallback(() => {
    closeModal(MODAL_ID.PUBLISH_TO_EARN_MODAL)
  }, [closeModal])

  /**
   * Handle "Publish product" button click
   */
  const handlePublishProduct = useCallback(() => {
    handleClose()
    if (isUnifiedEditor) {
      // If not on personalized-products page, navigate with URL parameters
      const urlParameters = {
        openProductSelector: 'true',
        defaultSource: 'existing',
      }

      const params = new URLSearchParams(urlParameters)
      const targetPath = `/personalized-products?${params.toString()}`
      navigate(targetPath)
      return
    }
    openModal(MODALS.DASHBOARD.PRODUCT_SELECTOR_MODAL_ID)
  }, [handleClose, openModal, isUnifiedEditor, navigate])

  const onClickOnStartPersonalizing = useCallback(
    (product: ITopSellingProductsResult) => {
      handleClose()
      trackEvent(EVENTS_TRACKING.START_PERSONALIZING_PRODUCT, {
        [EVENTS_PARAMETERS_NAME.START_PERSONALIZING_PRODUCT_FROM]: 'congrats_published_product_modal',
      })

      // Prepare modal data
      const modalData = {
        productId: formatShopifyObjectIdToNumberId(product.productId, PREFIX_PRODUCT_ID),
        defaultSource: product.productSource === 'upsell' ? 'existing' : '',
        autoSelectAllVariants: true,
        nonExistingProductData: product.productDetails || undefined,
      }

      // If already on personalized-products page, open modal directly to avoid navigation flicker
      if (location.pathname === '/personalized-products') {
        openModal(MODALS.DASHBOARD.PRODUCT_SELECTOR_MODAL_ID, modalData)
        return
      }

      // If not on personalized-products page, navigate with URL parameters
      const urlParameters = {
        openProductSelector: 'true',
        autoSelectAllVariants: 'true',
        defaultSource: modalData.defaultSource,
        ...(modalData.nonExistingProductData
          ? { nonExistingProductData: encodeURIComponent(JSON.stringify(modalData.nonExistingProductData)) }
          : {}),
        productId: modalData.productId,
      }

      const params = new URLSearchParams(urlParameters)
      const targetPath = `/personalized-products?${params.toString()}`
      navigate(targetPath)
    },
    [handleClose, trackEvent, navigate, location.pathname, openModal]
  )

  const maxItems = 4
  // Responsive items per slide logic
  const getItemsPerSlide = useCallback(() => {
    if (isSmallMobileView || isMobileView) return 2
    return maxItems
  }, [isSmallMobileView, isMobileView, maxItems])

  const itemsPerSlide = useMemo(() => getItemsPerSlide(), [getItemsPerSlide])

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      title={t('publish-to-earn')}
      primaryAction={{
        content: t('publish-product'),
        onAction: handlePublishProduct,
      }}
      secondaryActions={[
        {
          content: t('close'),
          onAction: handleClose,
        },
      ]}
      footer={
        <Button
          variant="plain"
          icon={ExternalIcon}
          target="_blank"
          url={ELink.VIEW_MORE_PTE_BADGES}
          onClick={() =>
            trackEvent(EVENTS_TRACKING.CLICK_APP_PROMOTION, {
              [EVENTS_PARAMETERS_NAME.APP_PROMOTION]: 'pte-view-more',
            })
          }
        >
          {t('view-more')}
        </Button>
      }
    >
      {/* Hero Banner */}
      <div
        style={{
          width: '100%',
          height: isMobileView ? '100%' : '264px',
          maxHeight: isMobileView ? '100%' : '264px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <img
          src={
            isMobileView
              ? ELink.PUBLISH_TO_EARN_HERO_BANNER_IN_MODAL_MOBILE
              : ELink.PUBLISH_TO_EARN_HERO_BANNER_IN_MODAL_DESKTOP
          }
          alt={t('publish-to-earn')}
          style={{
            width: '100%',
            height: isMobileView ? '100%' : '264px',
            objectFit: 'cover',
            objectPosition: 'center',
          }}
        />
      </div>
      <Modal.Section>
        {/* Description and Progress */}
        <BlockStack gap="200">
          <InlineStack align="start" blockAlign="center" gap="100" wrap={false}>
            <Text as="p" variant="bodyMd">
              {t('publish-your-products-and-unlock-exclusive-badges-with-rewards')}
            </Text>
            <Box width="20px">
              <Tooltip
                content={t(
                  'incentives-apply-to-newly-published-products-after-this-program-goes-live-products-published-before-the-launch-are-not-included'
                )}
              >
                <Icon source={InfoIcon} tone="subdued" />
              </Tooltip>
            </Box>
          </InlineStack>
          <InlineStack align="start" blockAlign="center" gap="100" wrap={false}>
            <Text as="p" variant="bodySm">
              {Math.min(publishedCount, totalProducts)}/{totalProducts}
            </Text>
            <ProgressBar progress={progress} size="small" tone="success" />
          </InlineStack>
          <Bleed marginInline={'400'}>
            <Divider borderColor="border" borderWidth="025" />
          </Bleed>

          {/* Badges List */}
          {loading ? (
            <Box paddingBlock="200">
              <InlineStack align="center">
                <Spinner size="small" />
              </InlineStack>
            </Box>
          ) : error ? (
            <Box padding="200">
              <Text as="p" variant="bodyMd" tone="critical">
                {t('failed-to-load-badges-please-try-again')}
              </Text>
            </Box>
          ) : (
            pteStatus?.badges?.map((badge: PTEBadge) => <BadgeCard key={badge.id} badge={badge} />)
          )}

          <CollapsibleSection
            title={
              <Button variant="plain" onClick={() => setOpenCollapsible(!openCollapsible)} disclosure>
                {t('view-suggestions')}
              </Button>
            }
            open={openCollapsible}
            id={'view-suggestions'}
          >
            <Box paddingBlockStart="200">
              <ProductSuggestedCard
                carouselItemStyle={{
                  paddingRight: '8px',
                }}
                maxItems={maxItems}
                thumbnailHeight={138}
                itemsPerSlideProps={itemsPerSlide}
                showInCard={false}
                showIntroText={false}
                defaultProducts={products}
                onClickOnStartPersonalizing={onClickOnStartPersonalizing}
              />
            </Box>
            {/* Ref element at the end for scrolling to bottom */}
            <div ref={collapsibleSectionEndRef} />
          </CollapsibleSection>
        </BlockStack>
      </Modal.Section>
    </Modal>
  )
}
