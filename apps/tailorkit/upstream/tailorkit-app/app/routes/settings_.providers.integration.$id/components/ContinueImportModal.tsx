import { BlockStack, Box, Button, ButtonGroup, InlineStack, Text } from '@shopify/polaris'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IMPORT_TO_SHOPIFY_WARNING_MODAL } from '../constants'
import { Modal, TitleBar } from '@shopify/app-bridge-react'
import { navigateToShopifyAdmin } from '~/utils/shopify'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { useNavigateAppBridge } from '~/bootstrap/hooks/useNavigateAppBridge'
import { getUserJourneyOfTourGuide } from '~/bootstrap/hoc/withTourGuide'
import { USER_JOURNEY_TYPE } from '~/routes/api.user-journey/constants'
import { formatErrorMessage } from '~/utils/formatErrorMessage'
import { NavMenuItems } from '~/bootstrap/app-config'

interface IContinueImportModalProps {
  active: boolean
  onClose: () => void
  onContinueImport: () => void
}

export const ContinueImportModal = (props: IContinueImportModalProps) => {
  const { active, onContinueImport, onClose } = props
  const { t } = useTranslation()
  const { trackEvent } = useEventsTracking()

  const [isLoading, setIsLoading] = useState(false)
  const [startedTheIntegrationEditorQuickTour, setStartedTheIntegrationEditorQuickTour] = useState(false)

  const navigate = useNavigateAppBridge()

  const handleViewOnShopify = useCallback(() => {
    // Send event view on shopify
    trackEvent(EVENTS_TRACKING.VIEW_ON_SHOPIFY)

    navigateToShopifyAdmin('/products?selectedView=all&order=created_at desc')
    onClose()
  }, [onClose, trackEvent])

  const handleStartIntegrationEditorQuickTour = useCallback(async () => {
    // Send event go to integration
    trackEvent(EVENTS_TRACKING.GO_TO_INTEGRATION)
    const urlParameters = {
      openProductSelector: 'true',
      defaultSource: 'existing',
    }

    const params = new URLSearchParams(urlParameters)
    const targetPath = `${NavMenuItems.PERSONALIZED_PRODUCTS}?${params.toString()}`
    navigate(targetPath)
  }, [navigate, trackEvent])

  const renderSecondaryButton = useMemo(() => {
    return (
      <Button
        loading={isLoading}
        onClick={!startedTheIntegrationEditorQuickTour ? handleStartIntegrationEditorQuickTour : handleViewOnShopify}
      >
        {!startedTheIntegrationEditorQuickTour ? t('let-s-integrate') : t('view-on-shopify')}
      </Button>
    )
  }, [handleStartIntegrationEditorQuickTour, handleViewOnShopify, isLoading, startedTheIntegrationEditorQuickTour, t])

  useEffect(() => {
    ;(async () => {
      try {
        const tourId = USER_JOURNEY_TYPE.INTEGRATION_EDITOR_QUICK_TOUR
        // Get current tour journey
        const userJourney = await getUserJourneyOfTourGuide(tourId)

        setStartedTheIntegrationEditorQuickTour(!!userJourney)
      } catch (e) {
        console.log(formatErrorMessage(e))
      } finally {
        setIsLoading(false)
      }
    })()
  }, [])

  return (
    <Modal id={IMPORT_TO_SHOPIFY_WARNING_MODAL} open={active} onHide={onClose}>
      <TitleBar title={t('import-to-shopify')}></TitleBar>
      <BlockStack>
        <Box padding={'400'}>
          <Text as={'p'} variant={'bodyMd'}>
            {t('all-products-have-been-imported-to-shopify-do-you-want-to-import-new-products')}
          </Text>
        </Box>
        <Box padding={'400'} borderColor="border" borderBlockStartWidth="025" background="bg-surface-tertiary">
          <InlineStack align="end">
            <ButtonGroup>
              {renderSecondaryButton}
              <Button variant={'primary'} onClick={onContinueImport}>
                {t('import-products')}
              </Button>
            </ButtonGroup>
          </InlineStack>
        </Box>
      </BlockStack>
    </Modal>
  )
}
