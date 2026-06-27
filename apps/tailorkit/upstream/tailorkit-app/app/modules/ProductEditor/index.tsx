import { useLoaderData, useLocation, useParams } from '@remix-run/react'
import { useBreakpoints } from '@shopify/polaris'
import { Fragment, useMemo, useCallback, useLayoutEffect, useRef } from 'react'
import ResizableDivider from '~/components/common/ResizableDivider'
import { PreviewCanvasLayout } from '~/components/layouts/Canvas/Preview'
import BlockLoading from '~/components/loading/BlockLoading'
import { TEMPLATE_EDITOR_CANVAS_CONTAINER } from '~/constants/canvas'
import { InspectorWithPreviewMode } from '~/modules/TemplateEditor/components/Inspector'
import type { clientLoader } from '~/routes/personalized-products.$id/route'
import DesignTabContent from './components/Canvas/DesignTabContent.client'
import { IntegrationCanvasComponent } from './components/Canvas/index.client'
import ViewsBarOverlay from './components/Canvas/ViewsBarOverlay.client'
import MockupPreviewPanel from './components/MockupPreviewPanel/index.client'
import UnifiedHeader from './components/UnifiedHeader'
import IntegrationMobileBottomSheet from './components/IntegrationMobileBottomSheet'
import PreviewTabWrapper from './components/PreviewTabWrapper.client'
import { TemplateLayerStoresProviderWrapper } from './components/Preview/index.client'
import ProductBaseSetting from './components/ProductBaseSetting'
import ProductEditorSkeleton from './components/ProductEditorSkeleton'
import UnifiedDiscardModal from './components/UnifiedDiscardModal'
import FontUploaderModal from '~/modules/TemplateEditor/modals/FontUploaderModal'
import ViewDetailedResultFontModal from '~/modules/TemplateEditor/modals/ViewDetailedResultFontModal'
import { useCharmModeBootstrap } from '~/modules/TemplateEditor/hooks/useCharmModeBootstrap'
import { ApplyAIMockupsConfirmationModal } from './components/ProductBaseSetting/AIMockup/modals/ApplyAIMockupsConfirmationModal'
import { EDITOR_TABS } from './constants'
import { OnboardingProgressBar } from '~/modules/TemplateEditor/components/OnboardingProgress'
import { useTemplateProgress } from '~/modules/TemplateEditor/hooks/useTemplateProgress'
import { isOnboardingRoute } from '~/utils/shopify'
import { useIntegrationEditorContext } from './contexts'
import UnifiedEditorProvider from './contexts/UnifiedEditorProvider'
import { useUnifiedEditor, useEditorParams, useInitIntegration } from './hooks'
import withTemplateLayerUploader from './withTemplateLayerUploader'
import { DEFAULT_INTEGRATION_STORE, IntegrationStore } from '~/stores/modules/integration/integration'
import { LayerVisibilityStore, TemplateEditorStoreActions } from '~/stores/modules/template'
import { LayerStoreActions } from '~/stores/modules/layer'
import { LayerStoreSelection } from '~/stores/modules/layer-store-selection'
import { OptionSetActions } from '~/stores/modules/option-set'
import { ProgressStoreActions } from '~/stores/canvas/progress'
import { PSDsStoreActions } from '~/stores/modules/psd'
import { clearTemplateEnvAdapter } from '~/stores/modules/template/env-adapter'
import { FontCombinationSuggestionsStore, resetFetchKey } from '~/stores/modules/font-combination-suggestions'
import useWindowSize from '~/utils/hooks/useWindowSize'
import { useChatBot } from '~/providers/ChatBotContext'
import {
  isDesktopMockupLayoutActive,
  shouldShowMockupPreviewPanel,
  calculateMockupPanelWidth,
  calculateMockupGridColumns,
  MOCKUP_GRID_TRANSITION,
} from './utils/mockup-layout-calculations'

const LAST_EDITOR_SESSION_KEY_STORAGE = 'TK_LAST_EDITOR_SESSION_KEY'

function ProductEditor() {
  const { integration } = useLoaderData<typeof clientLoader>()
  const params = useParams()
  const { initIntegration, loading } = useInitIntegration()
  // Onboarding flow router: pre-create CHARM_NODE on mount when arriving via
  // ?charmMode=true (set by the dashboard's openCreateFlow consumer).
  useCharmModeBootstrap()
  const { setValidationErrors } = useIntegrationEditorContext()
  const { tab, previewMode, templateId, mockupId } = useEditorParams()
  const location = useLocation()
  // Show onboarding progress bar only for traditional onboarding flow:
  // Simplified onboarding (from wizard) adds &simplified=true — skip progress bar
  const isSimplifiedOnboarding = new URLSearchParams(location.search).get('simplified') === 'true'
  const isOnboarding = isOnboardingRoute(location.search) && !isSimplifiedOnboarding
  const progress = useTemplateProgress(isOnboarding)

  if (tab === 'design' && !sessionStorage?.getItem(`START_TEMPLATE_${templateId}_EDIT_SESSION_AT`)) {
    sessionStorage?.setItem(`START_TEMPLATE_${templateId}_EDIT_SESSION_AT`, Date.now().toString())
  }

  // Responsive breakpoints
  const { smUp, mdUp } = useBreakpoints()
  const isSmallMobileView = !smUp
  const isTabletView = smUp && !mdUp
  const isTabletOrMobile = Boolean(isTabletView || isSmallMobileView)

  // Desktop layout flags for Mockup tab (extracted to mockup-layout-calculations.ts)
  const { width: viewportWidth } = useWindowSize()
  const { isOpen: isChatBotOpen } = useChatBot()
  const layoutFlags = { isTabletOrMobile, viewportWidth, isChatBotOpen, previewMode }
  const isDesktopMockupLayout = isDesktopMockupLayoutActive(layoutFlags)
  const showMockupPreviewPanel = shouldShowMockupPreviewPanel(layoutFlags)

  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const preparedFlag = searchParams?.get('prepared') === '1'

  /**
   * Clear global editor stores when entering a new editor session (integrationId/mockupId change).
   * IMPORTANT: Reset stores BEFORE first render to prevent template flash.
   */
  const lastHandledSessionKeyRef = useRef<string | null>(null)
  const shouldResetStores = useRef(false)

  // Check session change BEFORE any render
  if (typeof window !== 'undefined' && params.id) {
    const urlParams = new URLSearchParams(window.location.search)
    const mockupId = urlParams.get('mockup') || ''
    const currentSessionKey = `${params.id}:${mockupId}`

    if (lastHandledSessionKeyRef.current !== currentSessionKey) {
      const lastSessionKey = window.sessionStorage?.getItem(LAST_EDITOR_SESSION_KEY_STORAGE) || ''

      // Reset stores if session changed
      if (lastSessionKey && lastSessionKey !== currentSessionKey) {
        shouldResetStores.current = true

        IntegrationStore.dispatch({
          type: 'INIT_DATA',
          payload: { state: { ...DEFAULT_INTEGRATION_STORE } },
          skipTrace: true,
        } as any)

        TemplateEditorStoreActions.resetState(true)
        LayerVisibilityStore.dispatch({ type: 'RESET_LAYER_VISIBILITY' } as any)
        LayerStoreSelection.dispatch({ type: 'RESET_STATE' })
        ProgressStoreActions.clearProgress()
        PSDsStoreActions.resetPSDsStore()
        LayerStoreActions.removeAllLayerStore()
        OptionSetActions.removeAllOptionSetStore()
        clearTemplateEnvAdapter()
        resetFetchKey()
        FontCombinationSuggestionsStore.dispatch({ type: 'RESET' })
      }

      // Update refs
      lastHandledSessionKeyRef.current = currentSessionKey
      window.sessionStorage?.setItem(LAST_EDITOR_SESSION_KEY_STORAGE, currentSessionKey)
    }
  }

  // Reset flag after render
  useLayoutEffect(() => {
    if (shouldResetStores.current) {
      shouldResetStores.current = false
    }
  })

  const initIntegrationPrepared = useCallback(
    (integrationArg: any, options?: any) =>
      initIntegration(integrationArg, { ...(options || {}), prepared: preparedFlag, setValidationErrors }),
    [initIntegration, preparedFlag, setValidationErrors]
  )

  // Initialize editor, manage cleanup, and get inspector width
  const { inspectorWidth, onResizeInspector } = useUnifiedEditor({
    integration,
    initIntegration: initIntegrationPrepared,
    setValidationErrors,
  })

  const canvasContainerWidth = useMemo(() => {
    // Use full width of the grid column; outer container will add padding when chat bot is open
    return '100%'
  }, [])

  const mockupPanelWidth = useMemo(
    () => calculateMockupPanelWidth(isChatBotOpen, viewportWidth),
    [isChatBotOpen, viewportWidth]
  )

  const mockupGridTemplateColumns = useMemo(
    () =>
      calculateMockupGridColumns({
        isTabletOrMobile,
        showMockupPreviewPanel,
        isDesktopMockupLayout,
        mockupPanelWidth,
        inspectorWidth,
      }),
    [isTabletOrMobile, showMockupPreviewPanel, isDesktopMockupLayout, mockupPanelWidth, inspectorWidth]
  )

  // Block render while resetting stores to prevent template flash
  if (shouldResetStores.current) {
    return <ProductEditorSkeleton />
  }

  if (loading && !preparedFlag) {
    return <ProductEditorSkeleton />
  }

  if (tab === EDITOR_TABS.DESIGN) {
    return (
      <Fragment>
        <UnifiedEditorProvider>
          <DesignTabContent />
        </UnifiedEditorProvider>
        <UnifiedDiscardModal />
        <FontUploaderModal />
        <ViewDetailedResultFontModal />
        <ApplyAIMockupsConfirmationModal />
      </Fragment>
    )
  }

  const content = (
    <div
      id="integration-editor"
      style={{
        gridTemplateColumns: mockupGridTemplateColumns,
        gridTemplateRows: isTabletView
          ? 'auto 1fr minmax(300px, 40%)'
          : isSmallMobileView
            ? 'auto 1fr auto'
            : undefined,
        transition: MOCKUP_GRID_TRANSITION,
      }}
    >
      <div style={{ gridColumn: '1 / -1', backgroundColor: 'var(--p-color-bg-fill)' }}>
        <UnifiedHeader />
        {isOnboarding && <OnboardingProgressBar progress={progress} />}
      </div>

      {/* Desktop: Left settings sidebar (col 1) — stays visible even when AI panel hides preview */}
      {isDesktopMockupLayout && tab !== EDITOR_TABS.PREVIEW && (
        <div
          style={{
            overflow: 'auto',
            height: '100%',
            minHeight: 0,
            borderRight: '1px solid var(--p-color-border)',
          }}
        >
          <ProductBaseSetting />
        </div>
      )}

      {tab !== EDITOR_TABS.PREVIEW ? (
        <div
          style={{
            display: 'flex',
            height: '100%',
            overflow: 'hidden',
            gridColumn: isTabletOrMobile ? '1 / -1' : undefined,
            gridRow: isTabletOrMobile ? '2' : undefined,
            minHeight: 0,
            flexDirection: isTabletOrMobile ? 'column' : 'row',
          }}
        >
          <div
            className={TEMPLATE_EDITOR_CANVAS_CONTAINER}
            style={{
              flex: 1,
              width: canvasContainerWidth,
              height: '100%',
              overflow: 'auto',
              overflowX: isTabletOrMobile ? 'hidden' : undefined,
              transition: 'padding-right 0.15s ease',
            }}
          >
            <div
              style={{
                background: 'var(--p-color-bg-fill-disabled)',
                padding: 'var(--p-space-200)',
                height: '100%',
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  background: 'var(--p-color-bg-surface)',
                  borderRadius: 'var(--p-border-radius-200)',
                  position: 'relative',
                }}
              >
                {typeof IntegrationCanvasComponent === 'undefined' ? <BlockLoading /> : <IntegrationCanvasComponent />}

                {/* ViewsBarOverlay: shown only on mobile/tablet or narrow desktop (<1056px).
                    Hidden when desktop 3-column layout is active (ViewsBar lives in preview panel). */}
                {!isDesktopMockupLayout && <ViewsBarOverlay />}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            height: '100%',
            overflow: 'hidden',
            gridColumn: isTabletOrMobile ? '1 / -1' : undefined,
            gridRow: isTabletOrMobile ? '2' : undefined,
            minHeight: 0,
            flexDirection: isTabletOrMobile ? 'column' : 'row',
          }}
        >
          <div
            style={{
              flex: 1,
              width: canvasContainerWidth,
              height: '100%',
              overflow: 'auto',
              overflowX: isTabletOrMobile ? 'hidden' : undefined,
              transition: 'padding-right 0.15s ease',
            }}
          >
            <div
              style={{
                background: 'var(--p-color-bg-fill-disabled)',
                padding: 'var(--p-space-200)',
                height: '100%',
              }}
            >
              <PreviewCanvasLayout>
                {typeof IntegrationCanvasComponent === 'undefined' ? <BlockLoading /> : <IntegrationCanvasComponent />}
              </PreviewCanvasLayout>
            </div>
          </div>
        </div>
      )}

      {/* Desktop 3-column: Right preview panel (col 3) */}
      {showMockupPreviewPanel && tab !== EDITOR_TABS.PREVIEW && <MockupPreviewPanel width={mockupPanelWidth} />}

      <Fragment>
        {isTabletOrMobile ? (
          // Inspector area for tablet/mobile
          <div style={{ gridColumn: '1 / -1', gridRow: '3' }}>
            {isSmallMobileView ? (
              // For mobile preview mode, render inline inspector (no BottomSheet)
              previewMode ? (
                <InspectorWithPreviewMode
                  includeHeader={false}
                  renderContent={
                    <div style={{ height: '100%', minHeight: 0, overflowY: 'auto', paddingBottom: '8px' }}>
                      <ProductBaseSetting />
                    </div>
                  }
                />
              ) : (
                <IntegrationMobileBottomSheet />
              )
            ) : (
              <InspectorWithPreviewMode
                includeHeader={false}
                renderContent={
                  <div style={{ height: '100%', minHeight: 0, overflowY: 'auto' }}>
                    <ProductBaseSetting />
                  </div>
                }
              />
            )}
          </div>
        ) : !isDesktopMockupLayout ? (
          // Narrow desktop fallback: right-side settings inspector (viewport < 1056px)
          <div style={{ position: 'relative', overflow: 'auto' }}>
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: -3,
                bottom: 0,
                zIndex: 2,
                display: 'flex',
                alignItems: 'stretch',
              }}
            >
              <ResizableDivider onResize={onResizeInspector} thickness={6} ariaLabel="Resize inspector" />
            </div>
            <ProductBaseSetting />
          </div>
        ) : null}
      </Fragment>
    </div>
  )

  // Wrap content with TemplateLayerStoresProviderWrapper when the Mockup preview panel is visible.
  // This provides TemplateLayerStoresContext to BOTH the IntegrationCanvas (for live template rendering)
  // and the MockupPreviewPanel (for option set interactions). Both share the same layer stores,
  // so option set changes in the preview panel are reflected on the canvas in real-time.
  const wrappedContent
    = tab === EDITOR_TABS.PREVIEW ? (
      <PreviewTabWrapper>{content}</PreviewTabWrapper>
    ) : isDesktopMockupLayout ? (
      <TemplateLayerStoresProviderWrapper mockupId={mockupId} variants={[]}>
        {content}
      </TemplateLayerStoresProviderWrapper>
    ) : (
      content
    )

  return (
    <Fragment>
      <UnifiedEditorProvider>{wrappedContent}</UnifiedEditorProvider>
      <UnifiedDiscardModal />
      <FontUploaderModal />
      <ViewDetailedResultFontModal />
      <ApplyAIMockupsConfirmationModal />
    </Fragment>
  )
}

export default withTemplateLayerUploader(ProductEditor)
