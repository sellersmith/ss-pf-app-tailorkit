import { List, Modal, Text } from '@shopify/polaris'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { USER_JOURNEY_TYPE } from '~/routes/api.user-journey/constants'
import { getMyShopifySubdomainName } from '~/shopify/fns'
import { useModal } from '~/utils/hooks/useModal'
import { openInNewTab } from '~/utils/openInNewTab'
import { NAVIGATE_TO_INTEGRATION_MODAL_KEY } from './constants'
import { checkUserHasProduct } from '~/shopify/graphql/products/fns.client'
import { useShopDomain } from '~/utils/shopify/useShopParams'
import { NavMenuItems } from '~/bootstrap/app-config'
import { useNavigateAppBridge } from '~/bootstrap/hooks/useNavigateAppBridge'

function ModalNavigateToIntegration() {
  const { t } = useTranslation()

  const [userHasProduct, setUserHasProduct] = useState(false)

  const navigate = useNavigateAppBridge()
  const { state, closeModal } = useModal()
  const modalActive = state[NAVIGATE_TO_INTEGRATION_MODAL_KEY]?.active

  const shopDomain = useShopDomain()
  const subDomain = getMyShopifySubdomainName(shopDomain || '')

  const { trackEvent } = useEventsTracking()

  const onCloseModal = useCallback(() => {
    // Close modal
    closeModal(NAVIGATE_TO_INTEGRATION_MODAL_KEY)
  }, [closeModal])

  const onPrimaryAction = useCallback(async () => {
    // Send event to go to integration
    trackEvent(EVENTS_TRACKING.GO_TO_INTEGRATION)
    onCloseModal()

    const urlParameters = {
      openProductSelector: 'true',
      defaultSource: 'existing',
    }

    const params = new URLSearchParams(urlParameters)
    const targetPath = `${NavMenuItems.PERSONALIZED_PRODUCTS}?${params.toString()}`
    navigate(targetPath)
  }, [onCloseModal, navigate, trackEvent])

  const onSecondaryAction = useCallback(() => {
    // Send event to connect with Printify
    trackEvent(EVENTS_TRACKING.CONNECT_WITH_PRINTIFY)

    // Close modal
    onCloseModal()

    // Navigate to providers page
    setTimeout(() => navigate(`/settings/providers?tour=${USER_JOURNEY_TYPE.PROVIDER_TOUR}`), 100)
  }, [navigate, onCloseModal, trackEvent])

  const onImportManuallyAction = useCallback(() => {
    // Send event to import manually
    trackEvent(EVENTS_TRACKING.IMPORT_MANUALLY)

    // Open product page on Shopify
    openInNewTab(`https://admin.shopify.com/store/${subDomain}/products`)
  }, [subDomain, trackEvent])

  const primaryAction = useMemo(
    () =>
      userHasProduct
        ? {
            content: t('let-s-integrate'),
            onAction: onPrimaryAction,
          }
        : {
            content: t('connect-with-printify'),
            onAction: onSecondaryAction,
          },
    [t, onPrimaryAction, onSecondaryAction, userHasProduct]
  )

  const secondaryActions = useMemo(
    () =>
      userHasProduct
        ? [
            {
              content: t('connect-with-printify'),
              onAction: onSecondaryAction,
            },
          ]
        : [
            {
              content: t('import-manually'),
              onAction: onImportManuallyAction,
            },
          ],
    [userHasProduct, t, onImportManuallyAction, onSecondaryAction]
  )

  useEffect(() => {
    ;(async () => {
      const hasProduct = await checkUserHasProduct()
      setUserHasProduct(hasProduct)
    })()
  }, [])

  return (
    <Modal
      open={modalActive}
      onClose={onCloseModal}
      title={t('complete-template-editor-quick-tour')}
      primaryAction={primaryAction}
      secondaryActions={secondaryActions}
    >
      <Modal.Section>
        {userHasProduct ? (
          <List>
            <List.Item>
              <Text variant="bodyMd" as="p">
                {t('complete-template-editor-quick-tour-description-1')}
              </Text>
            </List.Item>
            <List.Item>
              <div style={{ fontStyle: 'italic' }}>
                <Text variant="bodyMd" as="p">
                  {t('complete-template-editor-quick-tour-description-2')}
                </Text>
              </div>
            </List.Item>
          </List>
        ) : (
          <Text variant="bodyMd" as="p">
            {t('complete-template-editor-quick-tour-description-3')}
          </Text>
        )}
      </Modal.Section>
    </Modal>
  )
}

export default ModalNavigateToIntegration
