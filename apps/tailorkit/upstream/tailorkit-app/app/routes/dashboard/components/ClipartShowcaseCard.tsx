import { StarFilledIcon } from '@shopify/polaris-icons'
import CardWithDismiss from './CardWithDismiss'
import ClipartShowcase from './ClipartShowcase'
import { Badge, BlockStack, InlineStack, Text } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from '@remix-run/react'
import { NavMenuItems } from '~/bootstrap/app-config'
import { useDummyProductsData } from '~/modules/ProductSelector/hooks/useDummyProductsData'
import { uuid } from '~/utils/uuid'
import { showGenericErrorToast, showToast } from '~/utils/toastEvents'
import { OCCURRED_EVENTS } from '~/routes/api.preferences/constants'
import useDevices from '~/utils/hooks/useDevice'
import { TOAST } from '~/constants/toasts'
import { MODALS } from '~/components/AppBridge/ui-modal/constants'
import { useModal } from '~/utils/hooks/useModal'
import type { ClipartItem } from '~/types/clipart'

export default function ClipartShowcaseCard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { getDummyProductsSuggestionFromClipartData } = useDummyProductsData()
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectingItemId, setSelectingItemId] = useState<string | null>(null)
  const { openModal, setModalData } = useModal()

  /**
   * Handle clipart selection: fast handoff to loading shell
   */
  const onSelectItem = useCallback(
    async (checked: boolean, item: ClipartItem) => {
      if (isProcessing) return

      setIsProcessing(true)
      setSelectingItemId(item._id)

      try {
        // Step 1: Get dummy product suggestion from clipart
        const dummyProductsSuggestion = getDummyProductsSuggestionFromClipartData([item])

        if (!dummyProductsSuggestion || dummyProductsSuggestion.length === 0) {
          // No dummy product found, open ProductSelector modal instead
          setIsProcessing(false)
          setSelectingItemId(null)
          setModalData(MODALS.DASHBOARD.PRODUCT_SELECTOR_MODAL_ID, {
            clipartSelection: [item],
          })
          openModal(MODALS.DASHBOARD.PRODUCT_SELECTOR_MODAL_ID)
          return
        }

        // Use the first suggested dummy product for fast handoff
        const selectedDummyProduct = dummyProductsSuggestion[0]

        // Note: CLIPART_SELECT tracking is handled by ClipartShowcase.onClickItem
        // with more detailed info (session ID, position, time to select)

        // Note: Click count tracking is already handled in ClipartShowcase.onClickItem
        // to avoid duplicate tracking

        // Fast feedback
        showToast(t(TOAST.PROVIDER.IMPORTING_TO_SHOPIFY), { duration: 2000 })

        // Create integration id and hand off to loading shell
        const integrationId = uuid()
        const loadingUrl = `${NavMenuItems.PERSONALIZED_PRODUCTS}/loading?integrationId=${integrationId}&clipartId=${
          item._id
        }&clipartType=${encodeURIComponent(item.type || 'clipart')}`

        navigate(loadingUrl, {
          replace: false,
          state: {
            clipartItem: item,
            selectedDummyProduct,
            integrationId,
            source: 'dashboard_showcase',
          },
        })
      } catch (error: unknown) {
        console.error('[ClipartShowcaseCard] Failed to import product and open editor:', error)
        showGenericErrorToast()
      } finally {
        setIsProcessing(false)
        setSelectingItemId(null)
      }
    },
    [isProcessing, getDummyProductsSuggestionFromClipartData, t, navigate, setModalData, openModal]
  )

  const { isMobileView } = useDevices()

  const limit = useMemo(() => {
    return isMobileView ? 2 : 5
  }, [isMobileView])

  return (
    <CardWithDismiss
      title={
        <InlineStack gap="200" blockAlign="center">
          <Text as="h3" variant="headingMd">
            {t('try-tailorkit-playground')}
          </Text>
          <Badge tone="success" icon={StarFilledIcon}>
            {t('must-try')}
          </Badge>
        </InlineStack>
      }
      cardName={OCCURRED_EVENTS.CLIPART_SHOWCASE_CARD_DASHBOARD_DISMISSED}
    >
      <BlockStack gap="300">
        <Text as="p" variant="bodyMd">
          {t('click-one-to-see-tailorkit-in-action-no-real-inventory-unpublish-anytime')}
        </Text>

        <ClipartShowcase
          isInModal={false}
          onSelectItem={onSelectItem}
          limit={limit}
          selectingItemId={selectingItemId}
          isProcessing={isProcessing}
        />
      </BlockStack>
    </CardWithDismiss>
  )
}
