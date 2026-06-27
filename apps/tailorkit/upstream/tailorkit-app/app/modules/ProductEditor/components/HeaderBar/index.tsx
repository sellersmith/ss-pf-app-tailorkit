/* eslint-disable max-lines */
import {
  Box,
  Button,
  InlineStack,
  Banner,
  useBreakpoints,
  Card,
  Tooltip,
  Icon,
  Popover,
  ActionList,
} from '@shopify/polaris'
import {
  ButtonPressIcon,
  CursorIcon,
  MeasurementSizeIcon,
  LiveIcon,
  MenuHorizontalIcon,
  AppsIcon,
  UploadIcon,
} from '@shopify/polaris-icons'
import isEmpty from 'lodash/isEmpty'
import { useCallback, useContext, useEffect, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import ConfettiEffect from '~/components/confetti'
import { BFS_COMPLIANCE } from '~/constants/bfs-compliance'
import { EActionType } from '~/constants/fetcher-keys'
import { useStore } from '~/libs/external-store'
import { FEEDBACK_TYPE } from '~/modules/Feedback/constants'
import { useGatherUserFeedbackForm } from '~/modules/Feedback/hooks/useGatherUserFeedbackForm'
import { PRODUCT_STATUS_TYPE_FORMATTED } from '~/modules/modals/ProductNVariantSelector/constants'
import { CONFETTI_INTEGRATION_QUICK_TOUR_KEY } from '~/modules/TourGuides/IntegrationEditorQuickTour/constants'
import ModalNavigateToDiscovery from '~/modules/TourGuides/IntegrationEditorQuickTour/ModalNavigateToDiscovery'
import {
  NAVIGATE_TO_DISCOVERY_MODAL_KEY,
  NAVIGATE_TO_PUBLISH_PRODUCT_MODAL_KEY,
} from '~/modules/TourGuides/TemplateEditorQuickTour/constants'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import { useModal } from '~/utils/hooks/useModal'
import { sendMessageToMainApp } from '~/utils/modalEvents'
import { showToast } from '~/utils/toastEvents'
import { TOAST } from '~/constants/toasts'
import { getSaveBarStatus } from '~/utils/shopify'
import { hasTemplateUpdatesSince } from '~/utils/hasTemplateUpdates'
import { IntegrationEditorContext } from '../../contexts'
import useSaveIntegration from '../../hooks/useSaveIntegration'
import useUnifiedSave from '../../hooks/useUnifiedSave'
import type { WithVariantsProps } from '../../withMockup'
import withMockup from '../../withMockup'
import ModalConfirmUnpublish from './ModalConfirmUnpublishing'
import DesignMockupPreviewTabs from '../Canvas/DesignMockupPreviewTabs'
import { authenticatedFetch } from '~/shopify/fns.client'
import { EMPTY_OBJECT, ONE_MINUTE_IN_MILLISECONDS } from '~/constants'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import ProductTitle from './ProductTitle'
import type { EventObject } from 'extensions/tailorkit-src/src/assets/libraries/event-handler'
import useDevices from '~/utils/hooks/useDevice'
import { useTools } from '~/modules/TemplateEditor/hooks/useTools'
import useCanvasDimension from '~/utils/hooks/useCanvasDimension'
import { useNavigateAppBridge } from '~/bootstrap/hooks/useNavigateAppBridge'
import GridTool from '~/modules/TemplateEditor/components/Header/GridTool'
import { FlexCenter } from '~/components/common/Flex'
import MockupDownloadButton from '../Canvas/MockupDownloadButton'

interface IIntegrationEditorHeaderProps extends WithVariantsProps {}

/**
 * @deprecated Use UnifiedHeader instead
 * @param props
 * @returns
 */
function IntegrationEditorHeader(props: IIntegrationEditorHeaderProps) {
  const { variants } = props
  const product: any = variants[0].product || EMPTY_OBJECT
  const mockup: any = variants[0].mockup || EMPTY_OBJECT

  const [isClient, setIsClient] = useState(false)

  const { t } = useTranslation()
  const { validationErrors } = useContext(IntegrationEditorContext)
  const i = useSaveIntegration()
  const { publishIntegration, saving: _savingIntegration, publishing, unpublishing, clearProcessing } = i
  const { saveAll, saving } = useUnifiedSave()
  const navigate = useNavigateAppBridge()

  const { handleAfterPublishIntegration, handleAfterViewLive } = useGatherUserFeedbackForm({
    feedbackType: FEEDBACK_TYPE.INTEGRATION_FUNCTIONALITY,
  })
  const { state } = useModal()
  const { mdUp } = useBreakpoints()

  const isConfettiQuickTourActive = state[CONFETTI_INTEGRATION_QUICK_TOUR_KEY]?.active

  const publishedAt = useStore(IntegrationStore, state => state.publishedAt)
  const hasUnpublishedChanges = useStore(IntegrationStore, state => Boolean(state.hasUnpublishedChanges))
  const lastSavedAt = useStore(IntegrationStore, state => state.lastSavedAt ?? null)

  const hasSavedIntegration = useMemo(() => Boolean(publishedAt || lastSavedAt), [publishedAt, lastSavedAt])

  const [modalConfirmUnpublishActive, setModalConfirmUnpublishActive] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)

  const { mode, quickTools, toolBarSettings, onModeChangeHandler, onQuickToolsChangeHandler, onGridSizeChangeHandler }
    = useTools()

  const { measurementUnit } = useCanvasDimension()

  const isShowingGridTool = quickTools.includes('grid-tool')
  const isShowingRulerTool = quickTools.includes('ruler-tool')

  const [gridPopoverActive, setGridPopoverActive] = useState(false)
  const toggleGridPopover = useCallback(() => setGridPopoverActive(prev => !prev), [])

  const defaultGridSize = (toolBarSettings.grid?.gridSize || 20).toString()
  const [gridSize, setGridSize] = useState(defaultGridSize)
  const [gridInputFocused, setGridInputFocused] = useState(false)

  // Keep grid input synced with settings when not focused
  useEffect(() => {
    if (!gridInputFocused) {
      setGridSize(defaultGridSize)
    }
  }, [defaultGridSize, gridInputFocused])

  // Toggle between move-tool and hand-tool
  const togglePointerMode = useCallback(() => {
    const newMode = mode === 'move-tool' ? 'hand-tool' : 'move-tool'
    onModeChangeHandler(newMode)
  }, [mode, onModeChangeHandler])

  // Set isClient to true on mount for SSR safety
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Determine if templates have changed and republish is needed by comparing timestamps
  const publishedAtIntegration = useStore(IntegrationStore, state => state.publishedAt) as Date | null

  const needRepublish = useMemo(
    () => hasTemplateUpdatesSince({ variants, publishedAt: publishedAtIntegration }),
    [variants, publishedAtIntegration]
  )

  const republishPending = hasUnpublishedChanges || needRepublish

  const [showRepublishBanner, setShowRepublishBanner] = useState<boolean>(republishPending)

  // Keep banner visibility in sync with computation
  useEffect(() => {
    setShowRepublishBanner(republishPending)
  }, [republishPending])

  const onPublish = useCallback(async () => {
    try {
      showToast(t(TOAST.PRODUCT_EDITOR.INTEGRATION_PUBLISHING))
      const { showConfetti } = await publishIntegration()
      setShowConfetti(showConfetti)
      showToast(t(TOAST.PRODUCT_EDITOR.INTEGRATION_PUBLISHED))

      IntegrationStore.dispatch({
        type: 'UPDATE_PUBLISHED_AT',
        payload: {
          publishedAt: new Date(),
        },
        skipTrace: true,
      })

      handleAfterPublishIntegration({
        shouldShowConfetti: showConfetti,
        shouldShowFeedbackForm: true,
      })
    } catch (e) {
      throw e
    }
  }, [t, publishIntegration, handleAfterPublishIntegration])

  const onSaveAndPublish = useCallback(async () => {
    try {
      showToast(t(TOAST.PRODUCT_EDITOR.INTEGRATION_PUBLISHING))
      await saveAll()

      const { showConfetti } = await publishIntegration()

      showToast(t(TOAST.PRODUCT_EDITOR.INTEGRATION_PUBLISHED))
      await handleAfterPublishIntegration({
        shouldShowConfetti: showConfetti,
        shouldShowFeedbackForm: true,
      })
    } catch (e) {
      throw e
    }
  }, [t, publishIntegration, handleAfterPublishIntegration, saveAll])

  const onPublishIntegration = useCallback(async () => {
    try {
      await onPublish()
    } catch (e) {
      showToast(t(TOAST.COMMON.ERROR_GENERIC), { isError: true })
    }
  }, [onPublish, t])

  const onSaveAndPublishIntegration = useCallback(async () => {
    try {
      await onSaveAndPublish()
    } catch (e) {
      showToast(t(TOAST.COMMON.ERROR_GENERIC), { isError: true })
    }
  }, [onSaveAndPublish, t])

  const { trackEvent } = useEventsTracking()

  const onTriggerPublish = useCallback(async () => {
    if (_savingIntegration || saving || publishing) {
      return
    }

    // Save and publish integration
    publishedAt ? await onSaveAndPublishIntegration() : await onPublishIntegration()

    // Send message to max modal
    sendMessageToMainApp(EActionType.PUBLISH_PRODUCT)

    // Also broadcast to current window (for AI chat in same iframe)
    window.postMessage(EActionType.PUBLISH_PRODUCT, '*')

    // Track event when the editor is published
    /* Do not post this event again as it is already posted by the useUnifiedPublish hook.
    trackEvent(EVENTS_TRACKING.PUBLISH_PRODUCT, {
      [EVENTS_PARAMETERS_NAME.TYPE]: 'unified_editor',
    })*/

    // Send time users need to complete the onboarding
    const startTime = localStorage.getItem('TLK_ONBOARDING_START_AT')

    if (startTime) {
      // Update app config to state that the user has completed the onboarding
      authenticatedFetch('/api/preferences', {
        method: 'POST',
        body: JSON.stringify({
          action: 'UPDATE_OCCURRED_EVENT',
          eventName: 'completed_onboarding',
          value: true,
        }),
      }).catch(console.error)

      const completionMinutes = (Date.now() - Number(startTime)) / ONE_MINUTE_IN_MILLISECONDS
      // Send event to track the time users need to complete the onboarding
      trackEvent(EVENTS_TRACKING.COMPLETE_ONBOARDING, {
        [EVENTS_PARAMETERS_NAME.COMPLETION_MINUTES]: completionMinutes.toFixed(2),
      })

      localStorage.removeItem('TLK_ONBOARDING_START_AT')
    }
  }, [
    onPublishIntegration,
    onSaveAndPublishIntegration,
    publishedAt,
    _savingIntegration,
    saving,
    publishing,
    trackEvent,
  ])

  const onPublishAction = useCallback(async () => {
    // Check if save bar is showing - if yes, trigger navigation to show native save bar animation
    if (getSaveBarStatus()) {
      await navigate('/')
      return
    }

    if (!isEmpty(validationErrors)) {
      const firstErrorMessage = Object.values(validationErrors)[0]
      if (firstErrorMessage) {
        showToast(t(TOAST.COMMON.ERROR_GENERIC), { isError: true })
      }
      clearProcessing()
      sendMessageToMainApp(EActionType.PUBLISHED_PRODUCT)
      sendMessageToMainApp(EActionType.SAVED_PRODUCT)
      return
    }

    await onTriggerPublish()
  }, [validationErrors, onTriggerPublish, navigate, clearProcessing, t])

  useEffect(() => {
    async function handleMessageFromMainApp(ev: MessageEvent | EventObject) {
      if (ev.data === EActionType.SAVE_PRODUCT) {
        if (!isEmpty(validationErrors)) {
          const firstErrorMessage = Object.values(validationErrors)[0]
          if (firstErrorMessage) {
            showToast(t(TOAST.COMMON.ERROR_GENERIC), { isError: true })
          }
          clearProcessing()
          sendMessageToMainApp(EActionType.PUBLISHED_PRODUCT)
          sendMessageToMainApp(EActionType.SAVED_PRODUCT)
          return
        }

        const saveButton = document.getElementById('btn-save-integration')
        const saveButtonIsDisabled = saveButton?.getAttribute('aria-disabled') === 'true'

        if (saving || saveButtonIsDisabled) {
          return
        }

        if (saveButton) {
          showToast(t(TOAST.PRODUCT_EDITOR.INTEGRATION_SAVING))
          saveButton?.click()
        }

        return
      }

      if (ev.data === EActionType.PUBLISH_PRODUCT) {
        await onPublishAction()
        return
      }

      if (ev.data === EActionType.UNPUBLISH_PRODUCT) {
        setModalConfirmUnpublishActive(true)
        return
      }
    }

    window.addEventListener('message', handleMessageFromMainApp)

    return () => window.removeEventListener('message', handleMessageFromMainApp)
  }, [t, validationErrors, clearProcessing, saving, onPublishAction])

  const handleViewLive = useCallback(async () => {
    const shopDomain = shopify.config.shop
    const url = `https://${shopDomain}/products/${product?.handle}`

    window.open(url)
    await handleAfterViewLive({
      modalKeyShow: showConfetti ? NAVIGATE_TO_PUBLISH_PRODUCT_MODAL_KEY : NAVIGATE_TO_DISCOVERY_MODAL_KEY,
    })
  }, [product?.handle, showConfetti, handleAfterViewLive])

  const { isMobileView } = useDevices()

  const [menuPopoverActive, setMenuPopoverActive] = useState(false)

  const toggleMenuPopover = useCallback(() => setMenuPopoverActive(prev => !prev), [])

  // Cursor/Hand toggle tool
  const cursorHandToggleTool = useMemo(() => {
    return (
      <Tooltip content={t('select-move-hand-tool')}>
        <FlexCenter>
          <Button
            variant="monochromePlain"
            icon={<Icon source={mode === 'move-tool' ? CursorIcon : ButtonPressIcon} tone="emphasis" />}
            pressed={true}
            onClick={togglePointerMode}
          />
        </FlexCenter>
      </Tooltip>
    )
  }, [t, mode, togglePointerMode])

  const rulerTool = useMemo(() => {
    return (
      <Tooltip content={`${t('display-ruler')} (Shift + R)`}>
        <FlexCenter>
          <Button
            variant="monochromePlain"
            icon={<Icon source={MeasurementSizeIcon} tone="base" />}
            pressed={isShowingRulerTool}
            onClick={() => onQuickToolsChangeHandler('ruler-tool')}
          />
        </FlexCenter>
      </Tooltip>
    )
  }, [t, isShowingRulerTool, onQuickToolsChangeHandler])

  const gridTool = useMemo(() => {
    return (
      <GridTool
        t={t}
        isShowingGridTool={isShowingGridTool}
        gridPopoverActive={gridPopoverActive}
        toggleGridPopover={toggleGridPopover}
        measurementUnit={measurementUnit}
        gridSize={gridSize}
        setGridSize={setGridSize}
        setGridInputFocused={setGridInputFocused}
        onGridSizeChangeHandler={onGridSizeChangeHandler}
        onQuickToolsChangeHandler={onQuickToolsChangeHandler}
      />
    )
  }, [
    t,
    isShowingGridTool,
    gridPopoverActive,
    toggleGridPopover,
    measurementUnit,
    gridSize,
    onGridSizeChangeHandler,
    onQuickToolsChangeHandler,
  ])

  const mockupDownloadButton = useMemo(() => {
    return <MockupDownloadButton />
  }, [])

  const renderEditingToolsOnDesktop = useMemo(() => {
    return (
      <InlineStack gap={'300'} blockAlign="center">
        {mockupDownloadButton}
        <Box borderColor="border" borderInlineStartWidth="050" minHeight="20px" />
        {cursorHandToggleTool}
        {rulerTool}
        {gridTool}
        <Box borderColor="border" borderInlineStartWidth="050" minHeight="20px" />
      </InlineStack>
    )
  }, [cursorHandToggleTool, gridTool, mockupDownloadButton, rulerTool])

  const renderMobileMenu = useCallback(
    () => (
      <ActionList
        sections={[
          {
            items: [
              {
                content: t('display-ruler'),
                icon: MeasurementSizeIcon,
                onAction: () => {
                  onQuickToolsChangeHandler('ruler-tool')
                  setMenuPopoverActive(false)
                },
                active: isShowingRulerTool,
              },
              {
                content: t('grid-tool'),
                icon: AppsIcon,
                onAction: () => {
                  setMenuPopoverActive(false)
                  onQuickToolsChangeHandler('grid-tool')
                },
              },
            ],
          },
          // {
          //   items: [
          //     {
          //       content: t('live-chat', { defaultValue: 'Live Chat' }),
          //       icon: ChatIcon,
          //       onAction: openLiveChat,
          //     },
          //   ],
          // },
        ]}
      />
    ),
    [t, isShowingRulerTool, onQuickToolsChangeHandler]
  )

  const renderEditingToolsOnMobile = useMemo(
    () => (
      <InlineStack gap={'200'} blockAlign="center">
        {mockupDownloadButton}
        <Box borderColor="border" borderInlineStartWidth="050" minHeight="20px" />
        <Popover
          active={menuPopoverActive}
          activator={
            <Button
              variant="secondary"
              icon={<Icon source={MenuHorizontalIcon} tone="base" />}
              onClick={toggleMenuPopover}
            />
          }
          onClose={toggleMenuPopover}
        >
          <Box padding={'0'}>{renderMobileMenu()}</Box>
        </Popover>
        <Box borderColor="border" borderInlineStartWidth="050" minHeight="20px" />
        <Button
          icon={LiveIcon}
          onClick={handleViewLive}
          disabled={
            !(publishedAt && product?.status === PRODUCT_STATUS_TYPE_FORMATTED.ACTIVE && !mockup.disintegratedAt)
          }
          id={'integration-view-live-btn'}
        />
      </InlineStack>
    ),
    [
      mockupDownloadButton,
      menuPopoverActive,
      toggleMenuPopover,
      renderMobileMenu,
      handleViewLive,
      publishedAt,
      product,
      mockup,
    ]
  )

  const renderPublishControls = useMemo(() => {
    const shouldShowPublish = hasSavedIntegration && (!publishedAt || republishPending)
    const shouldShowUnpublish = Boolean(publishedAt) && !republishPending

    if (!shouldShowPublish && !shouldShowUnpublish) {
      return null
    }

    const publishLabel = republishPending && publishedAt ? t('republish') : t('publish')

    return (
      <InlineStack gap={'200'} blockAlign="center">
        {shouldShowPublish && (
          <Button
            id="integration-publish-btn"
            icon={UploadIcon}
            variant="primary"
            loading={_savingIntegration || saving || publishing}
            onClick={onPublishAction}
          >
            {publishLabel}
          </Button>
        )}

        {shouldShowUnpublish && (
          <Button
            id="integration-unpublish-btn"
            variant="secondary"
            loading={unpublishing}
            tone="critical"
            onClick={async () => {
              // Check if save bar is showing - if yes, trigger navigation to show native save bar animation
              if (getSaveBarStatus()) {
                await navigate('/')
                return
              }
              setModalConfirmUnpublishActive(true)
            }}
          >
            {t('unpublish')}
          </Button>
        )}
      </InlineStack>
    )
  }, [
    hasSavedIntegration,
    publishedAt,
    republishPending,
    t,
    _savingIntegration,
    saving,
    publishing,
    onPublishAction,
    unpublishing,
    navigate,
  ])

  // Check if the product is published and not disintegrated
  const canViewLive = publishedAt && product?.status === PRODUCT_STATUS_TYPE_FORMATTED.ACTIVE && !mockup.disintegratedAt

  return (
    <Box
      id="integration-header"
      paddingBlock="200"
      paddingInline={'400'}
      borderBlockEndWidth="025"
      borderColor="border"
      position="relative"
    >
      <InlineStack align="space-between" blockAlign="center" gap="400">
        <ProductTitle />
        <div style={{ flex: 1, maxWidth: '400px' }}>
          <DesignMockupPreviewTabs />
        </div>
        <Box>
          <InlineStack gap={'200'} blockAlign="center">
            {isMobileView ? renderEditingToolsOnMobile : renderEditingToolsOnDesktop}
            {renderPublishControls}

            {canViewLive ? (
              <Button variant="secondary" onClick={handleViewLive} id={'integration-view-live-btn'}>
                {t('view-live')}
              </Button>
            ) : null}

            {/* {publishedAt && <PopoverWithActionListExample items={productItems} />} */}
          </InlineStack>
          {isClient
            && typeof document !== 'undefined'
            && createPortal(
              <div style={{ visibility: 'hidden', position: 'absolute', right: '20px', top: '-30px', zIndex: 1002 }}>
                <Button id="btn-save-integration" disabled={saving} onClick={saveAll}>
                  {t('save')}
                </Button>
              </div>,
              document.body
            )}
        </Box>
      </InlineStack>

      <ModalConfirmUnpublish active={modalConfirmUnpublishActive} setActive={setModalConfirmUnpublishActive} />

      {showRepublishBanner && (
        <Box paddingBlockStart={'200'}>
          <Card padding="0">
            <Banner tone="warning" onDismiss={() => setShowRepublishBanner(false)}>
              <p>{t('template-updated-republish-to-show-on-storefront')}</p>
            </Banner>
          </Card>
        </Box>
      )}

      {!BFS_COMPLIANCE.HIDE_PUBLISH_POPOVER_AND_CONFETTI && isConfettiQuickTourActive && (
        <ConfettiEffect particleCount={300} duration={mdUp ? 4000 : 3000} spread={25} />
      )}
      <ModalNavigateToDiscovery handleViewLive={handleViewLive} />
    </Box>
  )
}

export default withMockup(IntegrationEditorHeader, {
  id: 'integration-header',
  style: { width: '100%', height: '44px' },
})
