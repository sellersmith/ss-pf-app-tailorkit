/* eslint-disable max-len */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@remix-run/react'
import { Bleed, Box, Icon, InlineStack, Page } from '@shopify/polaris'
import { Trans, useTranslation } from 'react-i18next'
import { NavMenuItems } from '~/bootstrap/app-config'
import { markAiOnboardingCompleted } from '../../utilities/saveUserJourneyProgress'
import ClipartShowcase from '~/routes/dashboard/components/ClipartShowcase'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { useModal } from '~/utils/hooks/useModal'
import { MODALS } from '~/components/AppBridge/ui-modal/constants'
import type { TEMPLATE_TYPE } from '~/routes/api.templates/constants'
import useDevices from '~/utils/hooks/useDevice'
import { LightbulbIcon } from '@shopify/polaris-icons'

type TSelectedItem = { _id: string; type: TEMPLATE_TYPE; alt: string }

export function OnboardingHighLight() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { trackEvent } = useEventsTracking()
  const { openModal } = useModal()
  const { isMobileView } = useDevices()

  const limit = useMemo(() => {
    return isMobileView ? 4 : 10
  }, [isMobileView])

  const [selectedItems, setSelectedItems] = useState<TSelectedItem[]>([])

  // Track onboarding start on mount
  useEffect(() => {
    // Save the time users start onboarding
    if (typeof window !== 'undefined' && !localStorage.getItem('TLK_ONBOARDING_START_AT')) {
      localStorage.setItem('TLK_ONBOARDING_START_AT', Date.now().toString())
    }

    // Send event start onboarding only once per session
    // This prevents duplicate events caused by trackEvent reference changes or component re-mounts
    const STARTED_ONBOARDING_KEY = 'TLK_STARTED_ONBOARDING'
    if (typeof window !== 'undefined' && !localStorage.getItem(STARTED_ONBOARDING_KEY)) {
      localStorage.setItem(STARTED_ONBOARDING_KEY, 'true')
      trackEvent(EVENTS_TRACKING.START_ONBOARDING)
    }
  }, [trackEvent])

  const onSelectItem = useCallback(
    (newCheck: boolean, item: TSelectedItem) => {
      if (newCheck) {
        // Single selection - replace with new item
        const newCliparts = [{ ...item, _id: item._id, type: item.type }]
        setSelectedItems(newCliparts)
      } else {
        // Deselect - remove the item
        setSelectedItems(selectedItems?.filter(selectedItem => selectedItem._id !== item._id))
      }
    },
    [selectedItems]
  )

  const handleGoToDashboard = useCallback(async () => {
    // Send event tracking close modal select assets from onboarding
    trackEvent(EVENTS_TRACKING.CLOSE_MODAL_SELECT_ASSETS_FROM_ONBOARDING)

    // Mark AI onboarding completed
    await markAiOnboardingCompleted()

    // Navigate to dashboard
    navigate(NavMenuItems.DASHBOARD)
  }, [trackEvent, navigate])

  const handleContinue = useCallback(async () => {
    // Send event continue onboarding
    if (selectedItems.length > 0) {
      trackEvent(EVENTS_TRACKING.SELECT_ASSETS_FROM_ONBOARDING, {
        [EVENTS_PARAMETERS_NAME.TYPE]: 'clipart',
        [EVENTS_PARAMETERS_NAME.VALUE]: selectedItems[0]?.alt,
        [EVENTS_PARAMETERS_NAME.ID]: selectedItems[0]?._id,
      })
    } else {
      // Send event tracking skip onboarding
      trackEvent(EVENTS_TRACKING.SKIP_MODAL_SELECT_ASSETS_FROM_ONBOARDING)
    }

    // Mark AI onboarding completed
    await markAiOnboardingCompleted()

    // Open product selector modal with selected clipart
    openModal(MODALS.DASHBOARD.PRODUCT_SELECTOR_MODAL_ID, {
      clipartSelection: selectedItems,
    })
  }, [trackEvent, selectedItems, openModal])

  return (
    <Page
      title={t('your-success-starts-here')}
      fullWidth
      secondaryActions={[
        {
          content: t('go-to-dashboard'),
          onAction: handleGoToDashboard,
        },
      ]}
      primaryAction={{
        content: t('continue'),
        disabled: selectedItems.length === 0,
        onAction: handleContinue,
      }}
    >
      <ClipartShowcase
        isInModal={false}
        showCheckbox={true}
        selectedItems={selectedItems}
        showFilter={true}
        informationText={t('select-a-free-pre-made-clipart-to-instantly-create-your-personalized-product')}
        onSelectItem={onSelectItem}
        wrapper="card"
        limit={limit}
        footerContent={
          <Bleed marginInline={'400'} marginBlockEnd={'400'}>
            <Box background="bg-fill-success-secondary" paddingInline="300" paddingBlock="200">
              <InlineStack gap="200">
                <Box>
                  <Icon source={LightbulbIcon} tone="success" />
                </Box>
                <Box>
                  <Trans
                    t={t}
                    components={{
                      b: <strong />,
                    }}
                  >
                    {t(
                      'publish-multiple-personalized-products-to-boost-your-revenue-and-unlock-tailorkit-incentives-like-b-sales-tips-app-discounts-and-media-template-kits-b'
                    )}
                  </Trans>
                </Box>
              </InlineStack>
            </Box>
          </Bleed>
        }
      />
    </Page>
  )
}
