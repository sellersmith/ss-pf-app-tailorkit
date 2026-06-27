/* eslint-disable max-len, max-lines */
import { Banner, BlockStack, Box, Button, Card, List, Modal, Text } from '@shopify/polaris'
import { ExternalIcon } from '@shopify/polaris-icons'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EVENTS_TRACKING, EVENTS_PARAMETERS_NAME } from '~/bootstrap/constants/eventsTracking'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { Accordion } from '~/components/Accordion'
import useScreenBreakpoints from '~/utils/hooks/use-screen-breakpoints'
import InteractiveCanvas from './components/InteractiveCanvas'
import MobileControls from './components/MobileControls'
import MockupWizardFooter from './components/MockupWizardFooter'
import ResultView from './components/ResultView'
import { useImageProcessing } from './hooks/useImageProcessing'
import styles from './styles.module.css'
import type { MockupWizardProps, ProcessingParameters, ShapeSelection } from './types'

export default function MockupWizard({
  imageUrl,
  onError,
  onApply,
  modalTitle,
  onModalClose,
  isModal = false,
  hideTitle = false,
  hideInstructions = false,
  hideFooter = false,
  hideMobileControls = false,
  skipResultView = false,
  hideResultSettings = false,
  resultSideContent,
  resultContainerHeight,
  forceFullTransparency = false,
  forceServerSideProcessing = false,
  canvasHeight,
  modalOpen = false,
  templateImages = [],
  processedImageUrlOverride,
  initialTemplatePositions,
  initialPositionsAreComputed,
  defaultTemplatePositioningMode = 'fill',
  showAdvancedSettings = true,
  apiEndpoint = '/api/mockup-wizard',
  onShapeCountChange,
  onTemplatePositionsChange,
  initialShapeSelections,
  onShapeSelectionsChange,
  storedTransparentAreas,
  autoTriggerDetection = false,
  noMask = false,
}: MockupWizardProps) {
  const { t } = useTranslation()
  const { isMobileView } = useScreenBreakpoints()
  const { trackEvent } = useEventsTracking()
  const wasAppliedRef = useRef(false)
  const generatedMaskUrlRef = useRef<string | null>(null)

  // Core state — seed with restored shapes from bulk-mode tab persistence
  const [shapeSelections, setShapeSelectionsRaw] = useState<ShapeSelection[]>(() => initialShapeSelections ?? [])
  // Wrap setter to notify parent of valid shape count changes and full shape array
  const setShapeSelections = useCallback(
    (update: ShapeSelection[] | ((prev: ShapeSelection[]) => ShapeSelection[])) => {
      setShapeSelectionsRaw(prev => {
        const next = typeof update === 'function' ? update(prev) : update
        const validCount = next.filter(s => s.width > 0 && s.height > 0).length
        onShapeCountChange?.(validCount)
        onShapeSelectionsChange?.(next)
        return next
      })
    },
    [onShapeCountChange, onShapeSelectionsChange]
  )

  // Fire initial shape count on mount when seeded with restored shapes
  useEffect(() => {
    if (initialShapeSelections && initialShapeSelections.length > 0) {
      const validCount = initialShapeSelections.filter(s => s.width > 0 && s.height > 0).length
      onShapeCountChange?.(validCount)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only on mount
  const [error, setError] = useState<string | null>(null)
  const [templatePositioningMode, setTemplatePositioningMode] = useState<'fit' | 'fill'>(defaultTemplatePositioningMode)

  // Zoom state for canvas view
  const [zoomState, setZoomState] = useState<{
    scale: number
    zoomIn: () => void
    zoomOut: () => void
    resetZoom: () => void
  } | null>(null)

  // Default processing parameters (memoized to prevent recreation)
  const defaultParameters: ProcessingParameters = useMemo(
    () => ({
      colorSimilarityThreshold: 70,
      maxAreaRatio: 0.3,
      interiorGapFilling: true,
      keepShadowHighlight: true,
      sampleRadius: 30,
      frameDetectionThreshold: 60,
      frameMatchThreshold: 30,
      brightnessThreshold: 50,
      minBrightnessFilter: 60,
      shadowDetectionThreshold: -20,
      shadowOpacity: 180,
      shadowColorDarkeningFactor: 0.3,
      highlightDetectionThreshold: 20,
      highlightOpacity: 150,
      highlightColorBaseFactor: 0.7,
      safeMarginRatio: 0.04,
      centerBackgroundThreshold: 50,
      backgroundMatchThreshold: 40,
      centerSimilarityThreshold: 70,
      minimumBrightness: 15,
      minimumColorChannels: 10,
      featherRadius: 2,
      keepOnlyLargestArea: false,
      minAreaSize: 100,
      fallbackToFullTransparency: forceFullTransparency,
    }),
    [forceFullTransparency]
  )

  const [processingParameters, setProcessingParameters] = useState<ProcessingParameters>(defaultParameters)

  // Auto-compute if all active selections are vector shapes
  const allSelectionsAreVector = useMemo(() => {
    const activeShapes = shapeSelections.filter(s => s.width > 0 && s.height > 0)
    return activeShapes.length > 0 && activeShapes.every(s => s.type === 'vector')
  }, [shapeSelections])

  // Auto-enable fallbackToFullTransparency when all selections are vector
  useEffect(() => {
    if (allSelectionsAreVector && !processingParameters.fallbackToFullTransparency) {
      setProcessingParameters(prev => ({ ...prev, fallbackToFullTransparency: true }))
    }
  }, [allSelectionsAreVector]) // eslint-disable-line react-hooks/exhaustive-deps

  // Prevent browser viewport pinch-zoom while MockupWizard is visible
  useEffect(() => {
    // Safari uses gesturestart/gesturechange for pinch-zoom
    const preventGesture = (e: Event) => e.preventDefault()
    // Other browsers use multi-touch touchmove
    const preventTouchZoom = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault()
    }

    document.addEventListener('gesturestart', preventGesture, { passive: false })
    document.addEventListener('gesturechange', preventGesture, { passive: false })
    document.addEventListener('touchmove', preventTouchZoom, { passive: false })

    return () => {
      document.removeEventListener('gesturestart', preventGesture)
      document.removeEventListener('gesturechange', preventGesture)
      document.removeEventListener('touchmove', preventTouchZoom)
    }
  }, [])

  // Track STARTED event
  useEffect(() => {
    if (!isModal || modalOpen) {
      trackEvent(EVENTS_TRACKING.MOCKUP_WIZARD_STARTED, {
        is_modal: isModal,
        [EVENTS_PARAMETERS_NAME.ORIGINAL_IMAGE_URL]: imageUrl,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Image processing hook
  const {
    isProcessing,
    isReprocessing,
    isApplying,
    processedImageUrl,
    transparentAreas,
    showResult,
    processImage,
    reprocessImage,
    applyMask,
    backToCanvas,
    updateTemplatePositions,
    fullReset,
    processedDimensions,
  } = useImageProcessing(imageUrl, apiEndpoint, onError, onApply, forceServerSideProcessing)

  // Wraps updateTemplatePositions to also notify the parent about position changes.
  // ResultView calls this when drawComposite computes initial positions or when
  // the user manipulates the template overlay.
  const handleTemplatePositionsUpdate = useCallback(
    (positions: TemplatePosition[]) => {
      updateTemplatePositions(positions)
      onTemplatePositionsChange?.(positions)
    },
    [updateTemplatePositions, onTemplatePositionsChange]
  )

  // Update processing parameter with debounced reprocessing
  const updateParameter = useCallback(
    (key: keyof ProcessingParameters, value: any) => {
      const newParameters = { ...processingParameters, [key]: value }
      setProcessingParameters(newParameters)

      // Only reprocess if we have a result to update
      if (showResult) {
        reprocessImage(shapeSelections, newParameters, t)
      }
    },
    [processingParameters, showResult, reprocessImage, shapeSelections, t]
  )

  // Handle image processing
  const handleProcessImage = useCallback(() => {
    processImage(shapeSelections, processingParameters, t)
    trackEvent(EVENTS_TRACKING.MOCKUP_WIZARD_PROCESSED, {
      is_modal: isModal,
      [EVENTS_PARAMETERS_NAME.ORIGINAL_IMAGE_URL]: imageUrl,
    })
  }, [processImage, shapeSelections, processingParameters, t, trackEvent, isModal, imageUrl])

  // Handle apply mask
  const handleApplyMask = useCallback(async () => {
    // Apply mask and get the CDN URL after upload
    const uploadedMaskUrl = await applyMask(shapeSelections, processingParameters, t)
    if (uploadedMaskUrl) {
      // Store the CDN URL for tracking on close
      generatedMaskUrlRef.current = uploadedMaskUrl
      wasAppliedRef.current = true
      trackEvent(EVENTS_TRACKING.MOCKUP_WIZARD_APPLIED, {
        is_modal: isModal,
        [EVENTS_PARAMETERS_NAME.ORIGINAL_IMAGE_URL]: imageUrl,
        [EVENTS_PARAMETERS_NAME.GENERATED_MASK_URL]: uploadedMaskUrl,
      })
    }
  }, [applyMask, shapeSelections, processingParameters, t, trackEvent, isModal, imageUrl])

  // Image state — must be declared before auto-apply effect which references it
  const [currentImage, setCurrentImage] = useState<HTMLImageElement | null>(null)

  // skipResultView: auto-apply mask when processing completes, bypassing ResultView entirely.
  // Derives template positions from shapeSelections and calls onApply directly.
  const hasAutoAppliedRef = useRef(false)
  // When switching TO skipResultView (back to canvas step), clear processed state
  // so the footer shows "Process" (not "Apply") and re-processing can auto-apply.
  const prevSkipResultViewRef = useRef(skipResultView)
  useEffect(() => {
    if (!prevSkipResultViewRef.current && skipResultView) {
      hasAutoAppliedRef.current = false
      fullReset()
    }
    prevSkipResultViewRef.current = skipResultView
  }, [skipResultView, fullReset])
  useEffect(() => {
    if (!skipResultView || !processedImageUrl || hasAutoAppliedRef.current) return
    hasAutoAppliedRef.current = true

    // Derive positions from transparentAreas (computed by processing) — these have accurate
    // bounding boxes for all shape types (vector paths, ellipses, rotated rectangles).
    // Fallback to shapeSelections if transparentAreas is empty (shouldn't happen in normal flow).
    // transparentAreas are already in processed-image coordinate space (no scaling needed).
    // Use inscribedRect when available (vector paths) for more accurate initial positions.
    // Falls back to boundingBox for shapes without inscribed rect data.
    // When multiple areas exist, use only the largest (primary) area — small artifact
    // areas (e.g., 1px strips from image downscale interpolation) should be ignored.
    let positions: { x: number; y: number; width: number; height: number; rotation: number }[]
    if (transparentAreas.length > 0) {
      const areasToUse
        = transparentAreas.length > 1
          ? [transparentAreas.reduce((best: any, curr: any) => (curr.area > best.area ? curr : best))]
          : transparentAreas
      positions = areasToUse.map((area: any) => {
        const ir = area.inscribedRect
        if (ir && ir.width > 0 && ir.height > 0) {
          return {
            x: Math.round(ir.x),
            y: Math.round(ir.y),
            width: Math.round(ir.width),
            height: Math.round(ir.height),
            rotation: ir.rotation || 0,
          }
        }
        return {
          x: Math.round(area.boundingBox.x),
          y: Math.round(area.boundingBox.y),
          width: Math.round(area.boundingBox.width),
          height: Math.round(area.boundingBox.height),
          rotation: area.rotation || 0,
        }
      })
    } else {
      // Fallback: derive from shape selections (axis-aligned bounding boxes)
      const scale = processedDimensions?.scale || 1
      positions = shapeSelections
        .filter(s => s.width > 0 && s.height > 0)
        .map(s => ({
          x: Math.round(s.x * scale),
          y: Math.round(s.y * scale),
          width: Math.round(s.width * scale),
          height: Math.round(s.height * scale),
          rotation: (s as any).rotation || 0,
        }))
    }

    // When no downscaling occurred, processedDimensions is null — use original image dimensions.
    // The mask was generated at the original size, so positions are in original space (scale=1).
    const dims = processedDimensions
      ? { width: processedDimensions.width, height: processedDimensions.height }
      : currentImage
        ? { width: currentImage.width, height: currentImage.height }
        : undefined

    // Call onApply directly with positions and processedImageUrl.
    // Always pass positions directly — never go through handleApplyMask which reads
    // stale templatePositions from hook state (React batching race condition).
    // Include transparentAreas so they persist in mockupResult for bulk mode tab-switch.
    onApply?.(processedImageUrl, positions, dims, transparentAreas)
  }, [skipResultView, processedImageUrl, transparentAreas, shapeSelections, processedDimensions, currentImage, onApply])

  // Clear all selections, restart auto-detection
  const reset = useCallback(() => {
    setShapeSelections([]) // Note: auto-detection does NOT re-fire on reset (autoDetectTriggeredRef is one-shot)
    setError(null)
  }, [setShapeSelections])

  // Navigate back to canvas view without clearing user data
  const handleBackToCanvas = useCallback(() => {
    backToCanvas()
    setError(null)
    // Do NOT clear shape selections - preserve user work
  }, [backToCanvas])

  // Handle error state
  const handleError = useCallback(
    (errorMessage: string) => {
      setError(errorMessage)
      onError?.(errorMessage)
    },
    [onError]
  )

  // Load the product image for result view
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => setCurrentImage(img)
    img.src = imageUrl

    // Cleanup: Free image memory when unmounting or imageUrl changes
    return () => {
      img.src = ''
      img.onload = null
    }
  }, [imageUrl])

  // Cleanup when modal closes (modal mode only)
  useEffect(() => {
    // Only apply cleanup logic when used as a modal
    if (!isModal) return

    // When modal closes, trigger cleanup to free memory
    if (!modalOpen) {
      // Track CLOSED event
      trackEvent(EVENTS_TRACKING.MOCKUP_WIZARD_CLOSED, {
        is_modal: true,
        was_applied: wasAppliedRef.current,
        [EVENTS_PARAMETERS_NAME.ORIGINAL_IMAGE_URL]: imageUrl,
        [EVENTS_PARAMETERS_NAME.GENERATED_MASK_URL]: generatedMaskUrlRef.current,
      })
      wasAppliedRef.current = false
      generatedMaskUrlRef.current = null

      // Clear main image
      if (currentImage) {
        currentImage.src = ''
        setCurrentImage(null)
      }

      // Full reset of processing state and image data
      fullReset()

      // Reset local state
      setShapeSelections([])
      setError(null)
      setTemplatePositioningMode(defaultTemplatePositioningMode)
      setProcessingParameters(defaultParameters)
    }
  }, [
    isModal,
    modalOpen,
    currentImage,
    fullReset,
    defaultParameters,
    trackEvent,
    imageUrl,
    defaultTemplatePositioningMode,
    setShapeSelections,
  ])

  // Instruction banner component (for both mobile and desktop)
  const InstructionBanner = useMemo(() => {
    return (
      <Accordion
        id={`mockup-wizard-instructions-${isMobileView ? 'mobile' : 'desktop'}`}
        label={t('instructions')}
        open={false}
        rememberState={true}
        content={
          <BlockStack gap="200">
            {isMobileView ? (
              <List>
                <List.Item>{t('drag-to-draw-shape-mode-for-rectangle-ellipse')}</List.Item>
                <List.Item>{t('use-vector-mode-to-draw-freeform-selections-with-lines-and-curves')}</List.Item>
                <List.Item>{t('tap-to-select-shape-tap-and-hold-to-remove')}</List.Item>
              </List>
            ) : (
              <List>
                <List.Item>{t('drag-to-draw-shape-press-shift-for-rectangle-ellipse')}</List.Item>
                <List.Item>
                  {t('press-v-for-vector-mode-click-to-add-points-drag-for-curves-click-first-point-to-close')}
                </List.Item>
                <List.Item>{t('click-to-select-shape-press-delete-backspace-to-remove')}</List.Item>
              </List>
            )}

            <div>
              <Button variant="plain" icon={ExternalIcon}>
                {t('learn-how-it-works')}
              </Button>
            </div>
          </BlockStack>
        }
      />
    )
  }, [isMobileView, t])

  // Main content component
  const MockupWizardContent = useMemo(
    () => (
      <div
        className={styles.MockupWizardContainer}
        style={canvasHeight ? ({ '--mockup-canvas-height': canvasHeight } as React.CSSProperties) : undefined}
      >
        {/* Header */}
        {!isModal && !hideTitle && (
          <div className={styles.header}>
            <Text variant="headingMd" as="h3">
              {t('mockup-wizard-beta')}
            </Text>
          </div>
        )}

        {/* Content Area */}
        <div className={styles.content}>
          {error && (
            <Box padding="200">
              <Banner tone="critical">{error}</Banner>
            </Box>
          )}
          {(processedImageUrl || processedImageUrlOverride || noMask) && !skipResultView ? (
            <Box padding="200">
              <ResultView
                originalImage={currentImage}
                processedImageUrl={processedImageUrlOverride || processedImageUrl}
                transparentAreas={transparentAreas.length > 0 ? transparentAreas : storedTransparentAreas || []}
                templateImages={templateImages}
                templatePositioningMode={templatePositioningMode}
                processingParameters={processingParameters}
                shapeSelections={shapeSelections}
                showAdvancedSettings={showAdvancedSettings}
                isReprocessing={isReprocessing}
                hideSettings={hideResultSettings}
                floatingZoomOnDesktop={isModal}
                compositeOnlyMode={isModal}
                sideContent={resultSideContent}
                containerHeight={resultContainerHeight}
                updateParameter={updateParameter}
                onTemplatePositioningModeChange={setTemplatePositioningMode}
                updateTemplatePositions={handleTemplatePositionsUpdate}
                processedDimensions={processedDimensions}
                initialTemplatePositions={initialTemplatePositions}
                initialPositionsAreComputed={initialPositionsAreComputed}
                noMask={noMask}
                t={t}
              />
            </Box>
          ) : (
            /* Canvas View */
            <BlockStack gap="400">
              {/* Instruction Banner (for both mobile and desktop) */}
              {!hideInstructions && InstructionBanner}

              {/* When no imageUrl is provided, show a clear empty state instead of
                  a blank canvas with an infinite loading spinner. */}
              {!imageUrl ? (
                <Box padding="400">
                  <Banner tone="warning">{t('no-base-image-for-mockup-wizard')}</Banner>
                </Box>
              ) : (
                /* Polaris Card surface around the interactive canvas — gives the
                  drawing area a clearly bounded, elevated frame distinct from
                  the page background. padding=0 lets the canvas extend edge-
                  to-edge so the floating toolbar (12px from top-left) and
                  zoom controls (12px from bottom-right) sit symmetrically
                  relative to the visible card corners.
                  In modal mode, add padding so the card doesn't abut the modal edges. */
                <Box
                  paddingInlineStart={isModal ? '300' : undefined}
                  paddingInlineEnd={isModal ? '300' : undefined}
                  paddingBlockStart={isModal ? '300' : undefined}
                  paddingBlockEnd={isModal ? '300' : undefined}
                >
                  <Card padding="0">
                    <Box position="relative">
                      <InteractiveCanvas
                        imageUrl={imageUrl}
                        shapeSelections={shapeSelections}
                        onShapeSelectionsChange={setShapeSelections}
                        onError={handleError}
                        onZoomChange={setZoomState}
                        autoTriggerDetection={autoTriggerDetection}
                      />

                      {/* Floating zoom overlay inside canvas.
                        In modal mode: always shown at bottom-left (matches quick setup step 3 behaviour).
                        In non-modal: shown on mobile or when hideMobileControls=true (simplified wizard).
                        hideMobileControls collapses to zoom-only; isModal also zoom-only. */}
                      {(isMobileView || hideMobileControls || isModal) && (
                        <MobileControls
                          shapeSelections={shapeSelections}
                          showResult={showResult}
                          processedImageUrl={processedImageUrl}
                          isProcessing={isProcessing}
                          isApplying={isApplying}
                          zoomScale={zoomState?.scale}
                          onZoomIn={zoomState?.zoomIn}
                          onZoomOut={zoomState?.zoomOut}
                          onResetZoom={zoomState?.resetZoom}
                          onReset={reset}
                          onBack={handleBackToCanvas}
                          onProcess={handleProcessImage}
                          onApply={handleApplyMask}
                          hideQuickActions={hideMobileControls || isModal}
                          t={t}
                        />
                      )}
                    </Box>
                  </Card>
                </Box>
              )}
            </BlockStack>
          )}
        </div>

        {/* Footer */}
        {!isModal && !hideFooter && (
          <div className={styles.footer}>
            <MockupWizardFooter
              isModal={isModal}
              shapeSelections={shapeSelections}
              detectedShapes={[]} // Will be provided by InteractiveCanvas later
              detectionStatus="idle" // Will be provided by InteractiveCanvas later
              detectionStats={null} // Will be provided by InteractiveCanvas later
              showResult={showResult}
              processedImageUrl={processedImageUrl}
              isProcessing={isProcessing}
              isApplying={isApplying}
              zoomScale={zoomState?.scale}
              onZoomIn={zoomState?.zoomIn}
              onZoomOut={zoomState?.zoomOut}
              onResetZoom={zoomState?.resetZoom}
              onReset={reset}
              onBack={handleBackToCanvas}
              onProcess={handleProcessImage}
              onApply={handleApplyMask}
              t={t}
            />
          </div>
        )}
      </div>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      isModal,
      hideTitle,
      hideInstructions,
      hideFooter,
      hideMobileControls,
      skipResultView,
      hideResultSettings,
      resultSideContent,
      resultContainerHeight,
      canvasHeight,
      t,
      error,
      showResult,
      processedImageUrl,
      processedImageUrlOverride,
      initialTemplatePositions,
      initialPositionsAreComputed,
      currentImage,
      transparentAreas,
      templateImages,
      templatePositioningMode,
      processingParameters,
      shapeSelections,
      showAdvancedSettings,
      isReprocessing,
      updateParameter,
      updateTemplatePositions,
      InstructionBanner,
      imageUrl,
      handleError,
      isMobileView,
      isProcessing,
      isApplying,
      zoomState?.scale,
      zoomState?.zoomIn,
      zoomState?.zoomOut,
      zoomState?.resetZoom,
      reset,
      handleBackToCanvas,
      handleProcessImage,
      handleApplyMask,
    ]
  )

  // Render as modal or standalone component
  if (isModal) {
    return (
      modalOpen && (
        <>
          <Modal
            size="large"
            open={modalOpen}
            onClose={onModalClose!}
            title={modalTitle || t('mockup-wizard-beta')}
            primaryAction={
              showResult && processedImageUrl
                ? {
                    content: isApplying ? t('uploading') : t('apply'),
                    loading: isApplying,
                    disabled: isApplying,
                    onAction: handleApplyMask,
                  }
                : {
                    loading: isProcessing,
                    content: isProcessing ? t('processing') : t('process'),
                    disabled: isProcessing || shapeSelections.length === 0,
                    onAction: handleProcessImage,
                  }
            }
            secondaryActions={
              showResult && processedImageUrl
                ? [
                    {
                      content: t('back'),
                      onAction: handleBackToCanvas,
                    },
                  ]
                : [
                    {
                      content: t('reset'),
                      disabled: isProcessing,
                      onAction: reset,
                    },
                  ]
            }
          >
            {MockupWizardContent}
          </Modal>
        </>
      )
    )
  }

  return MockupWizardContent
}
