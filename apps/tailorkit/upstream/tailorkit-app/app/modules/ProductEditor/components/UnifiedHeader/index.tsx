/* eslint-disable max-lines */
import { Box, ButtonGroup, InlineStack, useBreakpoints } from '@shopify/polaris'
import type { EventObject } from 'extensions/tailorkit-src/src/assets/libraries/event-handler'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import isEmpty from 'lodash/isEmpty'
import { memo, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useLocation, useRouteLoaderData } from '@remix-run/react'
import { useTranslation } from 'react-i18next'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { isMacOS } from '~/bootstrap/fns/os'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import ConfettiEffect from '~/components/confetti'
import { EMPTY_OBJECT, ONE_MINUTE_IN_MILLISECONDS } from '~/constants'
import { EActionType } from '~/constants/fetcher-keys'
import { useStore } from '~/libs/external-store'
import { FEEDBACK_TYPE } from '~/modules/Feedback/constants'
import { useGatherUserFeedbackForm } from '~/modules/Feedback/hooks/useGatherUserFeedbackForm'
import { usePreventPageScroll } from '~/modules/modals/hooks/usePreventPageScroll'
import { PRODUCT_STATUS_TYPE_FORMATTED } from '~/modules/modals/ProductNVariantSelector/constants'
import { useUndoRedo } from '~/modules/TemplateEditor/components/Header/UndoRedo/hooks/useUndoRedo'
import type { ToolBarQuickTool } from '~/modules/TemplateEditor/contexts/ToolBarContext'
import { useTools } from '~/modules/TemplateEditor/hooks/useTools'
import { useNavigateAppBridge } from '~/bootstrap/hooks/useNavigateAppBridge'
import { CONFETTI_INTEGRATION_QUICK_TOUR_KEY } from '~/modules/TourGuides/IntegrationEditorQuickTour/constants'
import ModalNavigateToDiscovery from '~/modules/TourGuides/IntegrationEditorQuickTour/ModalNavigateToDiscovery'
import {
  NAVIGATE_TO_DISCOVERY_MODAL_KEY,
  NAVIGATE_TO_PUBLISH_PRODUCT_MODAL_KEY,
} from '~/modules/TourGuides/TemplateEditorQuickTour/constants'
import { authenticatedFetch } from '~/shopify/fns.client'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import useDevices from '~/utils/hooks/useDevice'
import { useModal } from '~/utils/hooks/useModal'
import { createCanvasKeyboardShortcuts } from '~/utils/keyboardShortcuts'
import { sendMessageToMainApp } from '~/utils/modalEvents'
import { showToast } from '~/utils/toastEvents'
import { TOAST } from '~/constants/toasts'
import { getSaveBarStatus, isOnboardingRoute } from '~/utils/shopify'
import { isApprovedCharge } from '~/models/PricingPlan.fns'
import type { RootLoaderData } from '~/types/loaders'
import type { ShopDocument } from '~/models/Shop'
import { EDITOR_TABS } from '../../constants'
import { IntegrationEditorContext } from '../../contexts'
import { useEditorParams } from '../../hooks/useEditorParams'
import useSaveIntegration from '../../hooks/useSaveIntegration'
import useUnifiedSave from '../../hooks/useUnifiedSave'
import { useSharedTemplates } from '../../hooks/useSharedTemplates'
import { useUnifiedPublish } from '../../hooks/useUnifiedPublish'
import type { WithVariantsProps } from '../../withMockup'
import withMockup from '../../withMockup'
import { hasTemplateUpdatesSince } from '~/utils/hasTemplateUpdates'
import DesignMockupPreviewTabs from '../Canvas/DesignMockupPreviewTabs'
import PrintAreasBar from '../Canvas/PrintAreasBar'
import ModalConfirmUnpublish from '../HeaderBar/ModalConfirmUnpublishing'
import ProductTitle from '../HeaderBar/ProductTitle'
import { HiddenSaveButtonPortal, PublishButtonGroup, ViewLiveButton } from './ActionButtons'
import { EditingToolsDesktop } from './EditingToolsDesktop'
import { EditingToolsMobile } from './EditingToolsMobile'
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal'
import { MobileMenuList } from './MobileMenuList'
import { useLiveChat } from '~/utils/hooks/useLiveChat'
import { ImageUploaderModalProgress } from '../shared/ImageUploaderModalProgress'
import { localStorage } from 'extensions/tailorkit-src/src/assets/utils/localStorage'
import { MODAL_ID } from '~/constants/modal'
import { usePTEStatus } from '~/routes/dashboard/hooks/usePTEStatus'
import { GLOBAL_EVENTS_TRANSMITTER } from '~/constants/events-transmitter'
import { OnboardingPublishButton } from '~/modules/TemplateEditor/components/OnboardingProgress'
import PostPublishChecklist from '../PostPublishChecklist'
import { usePostPublishChecklist } from '../PostPublishChecklist/use-post-publish-checklist'
import { ProductImageDimensionBanner } from './ProductImageDimensionBanner'
import { useChatBot } from '~/providers/ChatBotContext'

// Module-level variable to persist card state across tab changes (not across reloads)
let pteCardShouldShowInSession = false

interface IUnifiedHeaderProps extends WithVariantsProps {}

type MinimalProduct = {
  handle?: string
  status?: string
  vendor?: string
}

type MinimalMockup = {
  disintegratedAt?: Date | string
  layers?: Array<{
    data?: {
      template?: { updatedAt?: string | Date }
      templateId?: { updatedAt?: string | Date }
    }
  }>
}

/**
 * UnifiedHeader - Single header for the unified Product Editor
 *
 * Design according to Figma:
 * - Design tab: Product title, "Add preview image", Zoom 50%, Undo, Redo, Grid tool (in 3-dot menu), Publish
 * - Mockup tab: Product title, Zoom 50%, Undo, Redo, Grid tool (in 3-dot menu), Publish
 * - Preview tab: Product title, Zoom 50%, Undo, Redo, Grid tool (in 3-dot menu), Publish
 */
function BaseUnifiedHeader(props: IUnifiedHeaderProps) {
  const { variants } = props
  const product = (variants[0]?.product ?? EMPTY_OBJECT) as MinimalProduct
  const mockup = (variants[0]?.mockup ?? EMPTY_OBJECT) as MinimalMockup
  const activeVariant = variants[0]
  const mockupId = activeVariant?.mockup?._id

  const [isClient, setIsClient] = useState(false)

  const { t } = useTranslation()
  const { tab } = useEditorParams()
  const { validationErrors } = useContext(IntegrationEditorContext)
  const i = useSaveIntegration()
  const { publishIntegration, saving: _savingIntegration, publishing, clearProcessing } = i
  const { saveAll, saving } = useUnifiedSave()
  const navigate = useNavigateAppBridge()
  // const { discardAll } = useUnifiedDiscard()

  // Get integration ID from store
  const integrationId = useStore(IntegrationStore, state => state._id)

  // Check for shared templates
  const {
    hasSharedTemplates,
    sharedIntegrationIds,
    loading: loadingSharedTemplates,
  } = useSharedTemplates(integrationId)

  // Unified publish hook
  const { publishing: publishingAll, publishCurrentOnly, publishAll } = useUnifiedPublish()

  // Post-publish checklist hook
  const postPublishChecklist = usePostPublishChecklist({
    integrationId: integrationId || '',
    productHandle: product?.handle || '',
  })

  const { handleAfterPublishIntegration, handleAfterViewLive } = useGatherUserFeedbackForm({
    feedbackType: FEEDBACK_TYPE.INTEGRATION_FUNCTIONALITY,
  })
  const { state, openModal, closeModal } = useModal()
  const { mdUp } = useBreakpoints()
  const location = useLocation()
  const { refetch: refetchPTEStatus } = usePTEStatus()
  // Initialize from module-level variable to persist across tab changes (not across reloads)
  const [shouldShowPTECard, setShouldShowPTECard] = useState(() => pteCardShouldShowInSession)

  const rootLoaderData = useRouteLoaderData<RootLoaderData>('root')
  const shopData = rootLoaderData?.shopData as ShopDocument | null

  // Check if shop needs subscription: has ≥1 published integration and no approved charge.
  // Skip when arriving from simplified onboarding — the product was just published by the wizard.
  const isFromOnboarding = isOnboardingRoute(location.search)
  const needsSubscriptionForPublish = isFromOnboarding
    ? false
    : shopData
      ? !isApprovedCharge(shopData) && (shopData.usages?.totalPublishedIntegrations || 0) >= 1
      : false

  // Skip confetti tour when coming from simplified onboarding — the product was already set up
  const isConfettiQuickTourActive = isFromOnboarding ? false : state[CONFETTI_INTEGRATION_QUICK_TOUR_KEY]?.active
  const modalConfirmUnpublishActive = state[MODAL_ID.CONFIRM_UNPUBLISH_MODAL]?.active

  const dimensionAlert = useStore(IntegrationStore, state => state.dimensionAlert)
  const [dimensionAlertDismissed, setDimensionAlertDismissed] = useState(false)

  const publishedAt = useStore(IntegrationStore, state => state.publishedAt)
  const hasUnpublishedChanges = useStore(IntegrationStore, state => Boolean(state.hasUnpublishedChanges))
  const lastSavedAt = useStore(IntegrationStore, state => state.lastSavedAt ?? null)

  // Show onboarding UI only if URL has ?onboarding=true AND product is not yet published.
  // Once published, always switch to normal editor (Republish disabled) regardless of URL.
  const isOnboardingEditor = isOnboardingRoute(location.search) && !publishedAt

  const hasSavedIntegration = useMemo(() => Boolean(publishedAt || lastSavedAt), [publishedAt, lastSavedAt])

  const [modalDiscardConfirmationActive, setModalDiscardConfirmationActive] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)

  // Tools for Design tab only
  const { quickTools, onQuickToolsChangeHandler } = useTools()
  const { canUndo, canRedo, onUndo, onRedo } = useUndoRedo()
  const isMac = isMacOS()

  const isShowingRulerTool = quickTools.includes('ruler-tool')
  const isShowingGridTool = quickTools.includes('grid-tool')
  const isDesignTab = tab === EDITOR_TABS.DESIGN

  // Set isClient to true on mount for SSR safety
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Listen to Transmitter event when first publish happens in current session
  useEffect(() => {
    const handleShowPTECard = async () => {
      // Event is only triggered after successful first publish in current session
      // Refetch PTE data to get latest publishedCount, then show card
      await refetchPTEStatus()
      pteCardShouldShowInSession = true
      setShouldShowPTECard(true)
    }

    Transmitter.listen(GLOBAL_EVENTS_TRANSMITTER.SHOW_PTE_CARD_IN_EDITOR, handleShowPTECard)

    return () => {
      Transmitter.remove(GLOBAL_EVENTS_TRANSMITTER.SHOW_PTE_CARD_IN_EDITOR, handleShowPTECard)
    }
  }, [refetchPTEStatus])

  // Reset card state when navigating away from personalized-products/:id route
  useEffect(() => {
    const currentPath = location.pathname
    const isInPersonalizedProducts = /^\/personalized-products\/[^/]+/.test(currentPath)

    return () => {
      // Reset state when navigating away from personalized-products/:id route
      if (!isInPersonalizedProducts) {
        pteCardShouldShowInSession = false
        setShouldShowPTECard(false)
      }
    }
  }, [location.pathname])

  // Determine if templates have changed and republish is needed by comparing timestamps
  const needRepublish = useMemo(() => hasTemplateUpdatesSince({ variants, publishedAt }), [variants, publishedAt])

  const republishPending = hasUnpublishedChanges || needRepublish
  const shouldShowPublish = hasSavedIntegration && (!publishedAt || republishPending)
  const shouldShowUnpublish = Boolean(publishedAt) && !republishPending
  const shouldShowRepublish = republishPending && publishedAt
  const canViewLive = Boolean(
    publishedAt && product?.status === PRODUCT_STATUS_TYPE_FORMATTED.ACTIVE && !mockup.disintegratedAt
  )

  const { trackEvent } = useEventsTracking()

  // App-embed / app-block readiness gating removed: PageFly hosts the personalization surface, so the
  // pre-publish "set up your storefront" modal (theme extension install check) no longer applies. Publish
  // is unconditional here.

  const onPublish = useCallback(async () => {
    try {
      const isFirstPublish = !publishedAt
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

      // Show post-publish checklist (use isFirstPublish for consistency across all publish paths)
      postPublishChecklist.show(isFirstPublish)
    } catch (e) {
      throw e
    }
  }, [t, publishIntegration, handleAfterPublishIntegration, postPublishChecklist, publishedAt])

  const onSaveAndPublish = useCallback(async () => {
    try {
      const isFirstPublish = !publishedAt
      showToast(t(TOAST.PRODUCT_EDITOR.INTEGRATION_PUBLISHING))
      await saveAll()

      const { showConfetti } = await publishIntegration()

      showToast(t(TOAST.PRODUCT_EDITOR.INTEGRATION_PUBLISHED))
      await handleAfterPublishIntegration({
        shouldShowConfetti: showConfetti,
        shouldShowFeedbackForm: true,
      })

      // Show post-publish checklist (use isFirstPublish for consistency across all publish paths)
      postPublishChecklist.show(isFirstPublish)
    } catch (e) {
      throw e
    }
  }, [t, publishIntegration, handleAfterPublishIntegration, saveAll, postPublishChecklist, publishedAt])

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

  const onTriggerPublish = useCallback(async () => {
    if (_savingIntegration || saving || publishing) {
      return
    }

    // Show pricing modal when publishing 2nd+ product without subscription
    if (needsSubscriptionForPublish) {
      openModal(MODAL_ID.ONBOARDING_PRICING_MODAL)
      return
    }

    publishedAt ? await onSaveAndPublishIntegration() : await onPublishIntegration()

    sendMessageToMainApp(EActionType.PUBLISHED_PRODUCT)
    window.postMessage(EActionType.PUBLISHED_PRODUCT, '*')

    const startTime = localStorage.getItem('TLK_ONBOARDING_START_AT')

    if (startTime) {
      authenticatedFetch('/api/preferences', {
        method: 'POST',
        body: JSON.stringify({
          action: 'UPDATE_OCCURRED_EVENT',
          eventName: 'completed_onboarding',
          value: true,
        }),
      }).catch(console.error)

      const completionMinutes = (Date.now() - Number(startTime)) / ONE_MINUTE_IN_MILLISECONDS
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
    needsSubscriptionForPublish,
    openModal,
  ])

  const onPublishAction = useCallback(async () => {
    // Trigger PUBLISHING_PRODUCT event immediately when user clicks publish
    Transmitter.trigger(GLOBAL_EVENTS_TRANSMITTER.PUBLISHING_PRODUCT)

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
  }, [validationErrors, onTriggerPublish, clearProcessing, t])

  // Handler for publish current only (using button group)
  const handlePublishCurrentOnly = useCallback(async () => {
    // Trigger PUBLISHING_PRODUCT event immediately when user clicks publish
    Transmitter.trigger(GLOBAL_EVENTS_TRANSMITTER.PUBLISHING_PRODUCT)

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

    // Onboarding: save+publish in one action, then exit onboarding mode
    // so the UI switches to normal editor state (Republish disabled, Outdated on changes)
    if (isOnboardingEditor) {
      await onTriggerPublish()
      const params = new URLSearchParams(location.search)
      params.delete('onboarding')
      const newSearch = params.toString()
      navigate(`${location.pathname}${newSearch ? `?${newSearch}` : ''}`, { replace: true })
      return
    }

    // Show pricing modal when publishing 2nd+ product without subscription
    if (needsSubscriptionForPublish) {
      openModal(MODAL_ID.ONBOARDING_PRICING_MODAL)
      return
    }

    const isFirstPublish = !publishedAt
    await publishCurrentOnly()
    sendMessageToMainApp(EActionType.PUBLISHED_PRODUCT)

    // Show post-publish checklist
    postPublishChecklist.show(isFirstPublish)
  }, [
    validationErrors,
    publishCurrentOnly,
    navigate,
    clearProcessing,
    t,
    isOnboardingEditor,
    onTriggerPublish,
    needsSubscriptionForPublish,
    openModal,
    publishedAt,
    postPublishChecklist,
    location,
  ])

  // Handler for publish all products (current + shared)
  const handlePublishAll = useCallback(async () => {
    // Trigger PUBLISHING_PRODUCT event immediately when user clicks publish
    Transmitter.trigger(GLOBAL_EVENTS_TRANSMITTER.PUBLISHING_PRODUCT)

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

    const isFirstPublish = !publishedAt
    await publishAll(sharedIntegrationIds)
    sendMessageToMainApp(EActionType.PUBLISHED_PRODUCT)

    // Show post-publish checklist
    postPublishChecklist.show(isFirstPublish)
  }, [
    validationErrors,
    publishAll,
    sharedIntegrationIds,
    navigate,
    clearProcessing,
    t,
    publishedAt,
    postPublishChecklist,
  ])

  // const handleDiscardIntegration = useCallback(async () => {
  //   await discardAll()
  //   shopify.modal.hide(MODAL_ID.INTEGRATION_EDITOR_MODAL)
  // }, [discardAll])

  const onHandleChangeActiveModalConfirmation = useCallback(() => {
    setModalDiscardConfirmationActive(!modalDiscardConfirmationActive)
  }, [modalDiscardConfirmationActive])

  // const onDiscardHandler = useCallback(() => {
  //   handleDiscardIntegration()
  //   onHandleChangeActiveModalConfirmation()
  // }, [handleDiscardIntegration, onHandleChangeActiveModalConfirmation])

  useEffect(() => {
    async function handleMessageFromMainApp(ev: MessageEvent | EventObject) {
      // DISCARD_INTEGRATION is handled by UnifiedDiscardModal (removed duplicate listener)

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
        openModal(MODAL_ID.CONFIRM_UNPUBLISH_MODAL)
        return
      }
    }

    window.addEventListener('message', handleMessageFromMainApp)

    return () => window.removeEventListener('message', handleMessageFromMainApp)
  }, [t, validationErrors, clearProcessing, saving, onPublishAction, onHandleChangeActiveModalConfirmation, openModal])

  const handleViewLive = useCallback(async () => {
    const shopDomain = shopify.config.shop
    const url = `https://${shopDomain}/products/${product?.handle}`

    window.open(url)
    // Skip discovery/publish-more modal when from simplified onboarding
    if (!isFromOnboarding) {
      await handleAfterViewLive({
        modalKeyShow: showConfetti ? NAVIGATE_TO_PUBLISH_PRODUCT_MODAL_KEY : NAVIGATE_TO_DISCOVERY_MODAL_KEY,
      })
    }
  }, [product?.handle, showConfetti, handleAfterViewLive, isFromOnboarding])

  const { isSmallDesktopView, isMobileView } = useDevices()

  // Keyboard shortcuts modal state
  const [keyboardModalActive, setKeyboardModalActive] = useState(false)
  const toggleKeyboardModal = useCallback(() => setKeyboardModalActive(prev => !prev), [])
  const shortcutsData = createCanvasKeyboardShortcuts(t)
  usePreventPageScroll(keyboardModalActive)

  // Menu popover state
  const [menuPopoverActive, setMenuPopoverActive] = useState(false)
  const toggleMenuPopover = useCallback(() => setMenuPopoverActive(prev => !prev), [])
  // Prevent page scroll when keyboard shortcuts modal is open

  const { isOpen: isChatOpen, toggleChatBot } = useChatBot()

  const { openChatBox } = useLiveChat()
  // Open live chat
  const openLiveChat = useCallback(() => {
    try {
      openChatBox()
      // Close the menu popover after triggering
      setMenuPopoverActive(false)
    } catch (_e) {
      // no-op if Crisp is unavailable
    }
  }, [openChatBox])

  // Desktop editing tools
  const renderEditingToolsOnDesktop = useMemo(
    () => (
      <EditingToolsDesktop
        isDesignTab={isDesignTab}
        t={t}
        isMac={isMac}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={onUndo}
        onRedo={onRedo}
        menuPopoverActive={menuPopoverActive}
        toggleMenuPopover={toggleMenuPopover}
        isShowingRulerTool={isShowingRulerTool}
        isShowingGridTool={isShowingGridTool}
        onQuickToolsChangeHandler={(tool: ToolBarQuickTool) => {
          onQuickToolsChangeHandler(tool)
          setMenuPopoverActive(false)
        }}
        toggleKeyboardModal={() => {
          toggleKeyboardModal()
          setMenuPopoverActive(false)
        }}
        openLiveChat={openLiveChat}
        isChatOpen={isChatOpen}
        onToggleChat={toggleChatBot}
      />
    ),
    [
      isDesignTab,
      t,
      isMac,
      canUndo,
      canRedo,
      onUndo,
      onRedo,
      menuPopoverActive,
      toggleMenuPopover,
      isShowingRulerTool,
      isShowingGridTool,
      onQuickToolsChangeHandler,
      toggleKeyboardModal,
      openLiveChat,
      isChatOpen,
      toggleChatBot,
    ]
  )

  const renderMobileMenu = useCallback(
    () => (
      <MobileMenuList
        t={t}
        isDesignTab={isDesignTab}
        isShowingRulerTool={isShowingRulerTool}
        isShowingGridTool={isShowingGridTool}
        onQuickToolsChangeHandler={(tool: ToolBarQuickTool) => {
          onQuickToolsChangeHandler(tool)
          setMenuPopoverActive(false)
        }}
        toggleKeyboardModal={() => {
          toggleKeyboardModal()
          setMenuPopoverActive(false)
        }}
        canViewLive={canViewLive}
        shouldShowUnpublish={shouldShowUnpublish}
        handleViewLive={handleViewLive}
        handleUnpublish={() => openModal(MODAL_ID.CONFIRM_UNPUBLISH_MODAL)}
        onUndo={onUndo}
        onRedo={onRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        openLiveChat={openLiveChat}
      />
    ),
    [
      t,
      isDesignTab,
      isShowingRulerTool,
      isShowingGridTool,
      canViewLive,
      shouldShowUnpublish,
      handleViewLive,
      onUndo,
      onRedo,
      canUndo,
      canRedo,
      openLiveChat,
      openModal,
      onQuickToolsChangeHandler,
      toggleKeyboardModal,
    ]
  )

  const renderEditingToolsOnMobile = useMemo(
    () => (
      <EditingToolsMobile
        menuPopoverActive={menuPopoverActive}
        toggleMenuPopover={toggleMenuPopover}
        renderMenu={renderMobileMenu}
      />
    ),
    [menuPopoverActive, toggleMenuPopover, renderMobileMenu]
  )

  const renderPublishControls = useMemo(
    () =>
      isOnboardingEditor ? (
        <OnboardingPublishButton
          onPublish={handlePublishCurrentOnly}
          loading={Boolean(_savingIntegration || saving || publishing)}
        />
      ) : (
        <PublishButtonGroup
          disabled={!shouldShowPublish}
          isRepublish={Boolean(publishedAt)}
          loading={Boolean(_savingIntegration || saving || publishing || publishingAll)}
          hasSharedTemplates={hasSharedTemplates}
          loadingSharedTemplates={loadingSharedTemplates}
          onPublish={handlePublishCurrentOnly}
          onPublishAll={handlePublishAll}
          t={t}
        />
      ),
    [
      isOnboardingEditor,
      shouldShowPublish,
      publishedAt,
      _savingIntegration,
      saving,
      publishing,
      publishingAll,
      hasSharedTemplates,
      loadingSharedTemplates,
      handlePublishCurrentOnly,
      handlePublishAll,
      t,
    ]
  )

  const renderViewLiveButton = useMemo(() => {
    return (
      <ViewLiveButton
        visible={canViewLive}
        primary={!shouldShowRepublish}
        onClick={handleViewLive}
        t={t}
        iconOnly={isMobileView}
      />
    )
  }, [canViewLive, shouldShowRepublish, handleViewLive, t, isMobileView])

  return (
    <>
      <Box
        id="unified-header"
        paddingBlock="200"
        paddingInline={'400'}
        borderBlockEndWidth="025"
        borderColor="border"
        position="relative"
      >
        {isSmallDesktopView ? (
          // Mobile: Two-row layout
          <Box>
            {/* Row 1: Product title + Action buttons */}
            <InlineStack align="space-between" blockAlign="center" gap="400" wrap={false}>
              <ProductTitle republishPending={republishPending} />
              <div role="group" className="unified-header-action-buttons">
                <InlineStack align="end">
                  <ButtonGroup variant="segmented">
                    {renderPublishControls}

                    {/* {shouldShowUnpublish || canViewLive ? (
                      <Popover
                        active={popoverActionsActive}
                        preferredAlignment="right"
                        activator={
                          <Button
                            variant="primary"
                            onClick={togglePopoverActionsActive}
                            icon={DotIcon}
                            accessibilityLabel="Other save actions"
                          />
                        }
                        autofocusTarget="first-node"
                        onClose={togglePopoverActionsActive}
                      >
                        <ActionList
                          actionRole="menuitem"
                          items={
                            [
                              canViewLive
                                ? {
                                    content: t('view-live'),
                                    onAction: () => {
                                      handleViewLive()
                                    },
                                  }
                                : null,
                              shouldShowUnpublish
                                ? {
                                    content: t('unpublish'),
                                    destructive: true,
                                    onAction: () => {
                                      openModal(MODAL_ID.CONFIRM_UNPUBLISH_MODAL)
                                    },
                                  }
                                : null,
                            ].filter(Boolean) as ActionListItemDescriptor[]
                          }
                        />
                      </Popover>
                    ) : null} */}
                  </ButtonGroup>
                </InlineStack>
              </div>
            </InlineStack>

            {/* Row 2: Tabs + Mobile menu */}
            <Box paddingBlockStart="200">
              <InlineStack gap={'200'} blockAlign="center" align="space-between" wrap={false}>
                <div style={{ flex: 1 }} id="unified-editor-tabs">
                  <DesignMockupPreviewTabs />
                </div>
                {renderEditingToolsOnMobile}
              </InlineStack>
            </Box>

            <HiddenSaveButtonPortal isClient={isClient} saving={Boolean(saving)} saveAll={saveAll} t={t} />
          </Box>
        ) : (
          // Desktop: Single-row layout
          <InlineStack align="space-between" blockAlign="center" gap="400">
            {/* Left: Product title */}
            <ProductTitle republishPending={republishPending} />

            {/* Center: Design/Mockup/Preview tabs */}
            <div style={{ flex: 1, maxWidth: '320px' }}>
              <InlineStack gap={'200'} blockAlign="center" wrap={false}>
                <div style={{ width: '100%' }} id="unified-editor-tabs">
                  <DesignMockupPreviewTabs />
                </div>
              </InlineStack>
            </div>

            {/* Right: Tools + Publish controls */}
            <Box>
              <InlineStack gap={'200'} blockAlign="center" align="end" wrap={false}>
                {renderEditingToolsOnDesktop}
                <div role="group" className="unified-header-action-buttons">
                  <InlineStack gap={'200'} blockAlign="center" wrap={false}>
                    {/* {renderUnpublishButton} */}
                    {renderViewLiveButton}
                    {renderPublishControls}
                  </InlineStack>
                </div>
              </InlineStack>
              <HiddenSaveButtonPortal isClient={isClient} saving={Boolean(saving)} saveAll={saveAll} t={t} />
            </Box>
          </InlineStack>
        )}
      </Box>

      {/* PrintAreasBar - Shows under header in unified editor */}
      {mockupId && isMobileView && (
        <PrintAreasBar
          mockupId={mockupId}
          productTitle={activeVariant?.product?.title}
          variantTitle={activeVariant?.title}
        />
      )}

      <ProductImageDimensionBanner
        dimensionAlert={dimensionAlertDismissed ? null : dimensionAlert}
        shopDomain={shopify?.config?.shop || ''}
        onDismiss={() => setDimensionAlertDismissed(true)}
        t={t}
      />

      <ModalConfirmUnpublish
        active={modalConfirmUnpublishActive}
        setActive={(active: boolean) => {
          if (active) {
            openModal(MODAL_ID.CONFIRM_UNPUBLISH_MODAL)
          } else {
            closeModal(MODAL_ID.CONFIRM_UNPUBLISH_MODAL)
          }
        }}
      />

      {isConfettiQuickTourActive && <ConfettiEffect particleCount={300} duration={mdUp ? 4000 : 3000} spread={25} />}
      <ModalNavigateToDiscovery handleViewLive={handleViewLive} />

      {/* <ModalDiscardConfirmation
        active={modalDiscardConfirmationActive}
        handleChange={onHandleChangeActiveModalConfirmation}
        onDiscard={onDiscardHandler}
      /> */}
      <KeyboardShortcutsModal
        open={keyboardModalActive}
        title={t('keyboard-shortcuts')}
        onClose={toggleKeyboardModal}
        t={t}
        data={shortcutsData}
      />
      <ImageUploaderModalProgress />


      {/* Post-publish checklist - shows after successful publish */}
      <PostPublishChecklist
        isOpen={postPublishChecklist.isOpen}
        shopDomain={shopify?.config?.shop || ''}
        productHandle={product?.handle || ''}
        productId={activeVariant?.product?.id || ''}
        productTitle={activeVariant?.product?.title || ''}
        onClose={postPublishChecklist.close}
        onItemClick={postPublishChecklist.trackItemClick}
        onSocialShare={postPublishChecklist.trackSocialShare}
      />
    </>
  )
}

export default withMockup(memo(BaseUnifiedHeader), {
  id: 'unified-header',
  style: { width: '100%', height: '44px' },
})
