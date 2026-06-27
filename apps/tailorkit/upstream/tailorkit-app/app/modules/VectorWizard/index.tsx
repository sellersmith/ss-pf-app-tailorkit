/* eslint-disable max-len */
import type { VectorWizardProps, ShapeSelection, VectorConversionParameters, VectorResult } from './types'
import styles from './styles.module.css'
import ResultView from './components/ResultView'
import InteractiveCanvas from './components/InteractiveCanvas'
import VectorWizardFooter from './components/VectorWizardFooter'
import MobileControls from './components/MobileControls'
import VectorEditor, { type VectorEditorRef } from '~/modules/VectorEditor'
import { useTranslation } from 'react-i18next'
import { EVENTS_TRACKING, EVENTS_PARAMETERS_NAME } from '~/bootstrap/constants/eventsTracking'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { useImageProcessing } from './hooks/useImageProcessing'
import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { Text, BlockStack, Modal, List, Banner } from '@shopify/polaris'
import { Accordion } from '~/components/Accordion'
import useDevices from '~/utils/hooks/useDevice'

export default function VectorWizard({
  imageUrl,
  onError,
  onApply,
  modalTitle,
  onModalClose,
  isModal = false,
  modalOpen = false,
  showAdvancedSettings = true,
  apiEndpoint = '/api/vector-wizard',
}: VectorWizardProps) {
  const { t } = useTranslation()
  const { isMobileView } = useDevices()
  const { trackEvent } = useEventsTracking()
  const wasAppliedRef = useRef(false)
  const generatedVectorUrlRef = useRef<string | null>(null)

  // Core state
  const [shapeSelections, setShapeSelections] = useState<ShapeSelection[]>([])
  const [error, setError] = useState<string | null>(null)

  // Vector editor state (for inline editing in modal)
  const [editingResult, setEditingResult] = useState<VectorResult | null>(null)
  const editingResultRef = useRef<VectorResult | null>(null)
  const vectorEditorRef = useRef<VectorEditorRef>(null)

  // Keep ref in sync with state to avoid stale closures in callbacks
  useEffect(() => {
    editingResultRef.current = editingResult
  }, [editingResult])

  // Track STARTED event
  useEffect(() => {
    if (!isModal || modalOpen) {
      trackEvent(EVENTS_TRACKING.VECTOR_WIZARD_STARTED, {
        is_modal: isModal,
        [EVENTS_PARAMETERS_NAME.ORIGINAL_IMAGE_URL]: imageUrl,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Zoom state for canvas view
  const [zoomState, setZoomState] = useState<{
    scale: number
    zoomIn: () => void
    zoomOut: () => void
    resetZoom: () => void
  } | null>(null)

  // Default vector conversion parameters
  const defaultParameters: VectorConversionParameters = {
    colorMode: 'monochrome',
    colorCount: 16,
    threshold: 128,
    turdSize: 2,
    turnPolicy: 'minority',
    alphaMax: 1.0,
    optCurve: true,
    optTolerance: 0.2,
    removeSolidBackground: false,
    bgRemovalTolerance: 30,
    removeWhiteBackground: false,
  }

  const [processingParameters, setProcessingParameters] = useState<VectorConversionParameters>(defaultParameters)

  // Image processing hook
  const {
    isProcessing,
    isReprocessing,
    isApplying,
    vectorResults,
    showResult,
    processImage,
    reprocessImage,
    applyVectors,
    updateVectorResult,
    backToCanvas,
  } = useImageProcessing(imageUrl, apiEndpoint, onError, onApply)

  // Update processing parameter with debounced reprocessing
  const updateParameter = useCallback(
    (key: keyof VectorConversionParameters, value: any) => {
      const newParameters = { ...processingParameters, [key]: value }
      setProcessingParameters(newParameters)

      // Only reprocess if we have a result to update
      if (showResult) {
        reprocessImage(shapeSelections, newParameters, t)
      }
    },
    [processingParameters, showResult, reprocessImage, shapeSelections, t]
  )

  // Handle quality preset changes
  const handleQualityPresetChange = useCallback(
    (preset: 'low' | 'medium' | 'high') => {
      let newParameters: VectorConversionParameters

      switch (preset) {
        case 'low':
          newParameters = {
            ...processingParameters,
            threshold: 80,
            turdSize: 1,
            optTolerance: 0.1,
          }
          break
        case 'high':
          newParameters = {
            ...processingParameters,
            threshold: 180,
            turdSize: 10,
            optTolerance: 0.5,
          }
          break
        case 'medium':
        default:
          newParameters = {
            ...processingParameters,
            threshold: 128,
            turdSize: 2,
            optTolerance: 0.2,
          }
          break
      }

      setProcessingParameters(newParameters)

      // Reprocess if we have a result
      if (showResult) {
        reprocessImage(shapeSelections, newParameters, t)
      }
    },
    [processingParameters, showResult, reprocessImage, shapeSelections, t]
  )

  // Handle image processing
  const handleProcessImage = useCallback(() => {
    processImage(shapeSelections, processingParameters, t)
    trackEvent(EVENTS_TRACKING.VECTOR_WIZARD_PROCESSED, {
      is_modal: isModal,
      [EVENTS_PARAMETERS_NAME.ORIGINAL_IMAGE_URL]: imageUrl,
    })
  }, [processImage, shapeSelections, processingParameters, t, trackEvent, isModal, imageUrl])

  // Handle apply vectors
  const handleApplyVectors = useCallback(async () => {
    // Apply vectors and get the CDN URL after upload
    const uploadedVectorUrl = await applyVectors(shapeSelections, processingParameters, t)
    // Store the CDN URL for tracking on close
    generatedVectorUrlRef.current = uploadedVectorUrl
    wasAppliedRef.current = true
    trackEvent(EVENTS_TRACKING.VECTOR_WIZARD_APPLIED, {
      is_modal: isModal,
      [EVENTS_PARAMETERS_NAME.ORIGINAL_IMAGE_URL]: imageUrl,
      [EVENTS_PARAMETERS_NAME.GENERATED_VECTOR_URL]: uploadedVectorUrl,
    })
  }, [applyVectors, shapeSelections, processingParameters, t, trackEvent, isModal, imageUrl])

  // Clear all points and selections, restart auto-detection
  const reset = useCallback(() => {
    setShapeSelections([]) // This will trigger auto-detection restart in InteractiveCanvas
    setError(null)
  }, [])

  // Navigate back to canvas view without clearing user data
  const handleBackToCanvas = useCallback(() => {
    backToCanvas()
    setError(null)
    // Do NOT clear seed points and shape selections - preserve user work
  }, [backToCanvas])

  // Handle error state
  const handleError = useCallback(
    (errorMessage: string) => {
      setError(errorMessage)
      onError?.(errorMessage)
    },
    [onError]
  )

  // Handle editing a vector result (opens inline editor in modal mode)
  const handleEditResult = useCallback((result: VectorResult) => {
    setEditingResult(result)
  }, [])

  // Handle save from vector editor
  const handleEditorSave = useCallback(
    (editedSvgDataUri: string) => {
      // Use ref to avoid stale closure - editingResultRef always has current value
      const currentEditingResult = editingResultRef.current
      if (currentEditingResult) {
        updateVectorResult(currentEditingResult.shapeId, editedSvgDataUri)
      }
      setEditingResult(null)
    },
    [updateVectorResult]
  )

  // Handle back from vector editor (return to results view)
  const handleEditorBack = useCallback(() => {
    setEditingResult(null)
  }, [])

  // Trigger save on vector editor via ref
  const handleEditorSaveAction = useCallback(() => {
    vectorEditorRef.current?.save()
  }, [])

  // Handle modal close with tracking
  const handleModalCloseWithTracking = useCallback(() => {
    trackEvent(EVENTS_TRACKING.VECTOR_WIZARD_CLOSED, {
      is_modal: true,
      was_applied: wasAppliedRef.current,
      [EVENTS_PARAMETERS_NAME.ORIGINAL_IMAGE_URL]: imageUrl,
      [EVENTS_PARAMETERS_NAME.GENERATED_VECTOR_URL]: generatedVectorUrlRef.current,
    })
    wasAppliedRef.current = false
    generatedVectorUrlRef.current = null
    onModalClose?.()
  }, [trackEvent, onModalClose, imageUrl])

  // Instruction banner component (for both mobile and desktop)
  const InstructionBanner = useMemo(() => {
    return (
      <Accordion
        open={false}
        rememberState={true}
        label={t('instructions')}
        id={isMobileView ? 'vector-wizard-instructions-mobile' : 'vector-wizard-instructions-desktop'}
        content={
          isMobileView ? (
            <List>
              <List.Item>{t('drag-to-draw-shape-mode-for-rectangle-ellipse')}</List.Item>
              <List.Item>{t('tap-to-select-shape-tap-and-hold-to-remove')}</List.Item>
            </List>
          ) : (
            <List>
              <List.Item>{t('drag-to-draw-shape-press-shift-for-rectangle-ellipse')}</List.Item>
              <List.Item>{t('click-to-select-shape-press-delete-backspace-to-remove')}</List.Item>
            </List>
          )
        }
      />
    )
  }, [isMobileView, t])

  // Main content component (render directly to prevent remounting during shape updates)
  const VectorWizardContent = (
    <div className={styles.VectorWizardContainer}>
      {/* Header */}
      {!isModal && (
        <div className={styles.header}>
          <Text variant="headingMd" as="h3">
            {t('vector-wizard-beta')}
          </Text>
        </div>
      )}

      {/* Content Area */}
      <div className={styles.content}>
        {error && <Banner tone="critical">{error}</Banner>}

        {/* Show Vector Editor when editing a result */}
        {editingResult && editingResult.svgDataUri ? (
          <VectorEditor
            ref={vectorEditorRef}
            svgDataUri={editingResult.svgDataUri}
            isModal={false}
            showFooter={false}
            onSave={handleEditorSave}
            onModalClose={handleEditorBack}
          />
        ) : showResult && vectorResults.length > 0 ? (
          /* Result View */
          <ResultView
            vectorResults={vectorResults}
            processingParameters={processingParameters}
            shapeSelections={shapeSelections}
            showAdvancedSettings={showAdvancedSettings}
            isReprocessing={isReprocessing}
            updateParameter={updateParameter}
            onQualityPresetChange={handleQualityPresetChange}
            onApply={onApply}
            onUpdateVectorResult={updateVectorResult}
            onEditResult={handleEditResult}
            t={t}
          />
        ) : (
          /* Canvas View */
          <BlockStack gap="400">
            {/* Instruction Banner (for both mobile and desktop) */}
            {InstructionBanner}

            <InteractiveCanvas
              imageUrl={imageUrl}
              shapeSelections={shapeSelections}
              onShapeSelectionsChange={setShapeSelections}
              onError={handleError}
              onZoomChange={setZoomState}
            />

            {/* Mobile Controls (Non-Modal Only) */}
            {isMobileView && !isModal && (
              <MobileControls
                shapeSelections={shapeSelections}
                showResult={showResult}
                vectorResults={vectorResults}
                isProcessing={isProcessing}
                isApplying={isApplying}
                zoomScale={zoomState?.scale}
                onZoomIn={zoomState?.zoomIn}
                onZoomOut={zoomState?.zoomOut}
                onResetZoom={zoomState?.resetZoom}
                onReset={reset}
                onBack={handleBackToCanvas}
                onProcess={handleProcessImage}
                onApply={handleApplyVectors}
                t={t}
              />
            )}
          </BlockStack>
        )}
      </div>

      {/* Footer */}
      {!isModal && (
        <div className={styles.footer}>
          <VectorWizardFooter
            isModal={isModal}
            onModalClose={onModalClose}
            hasOnApplyCallback={!!onApply}
            shapeSelections={shapeSelections}
            showResult={showResult}
            vectorResults={vectorResults}
            isProcessing={isProcessing}
            isApplying={isApplying}
            zoomScale={zoomState?.scale}
            onZoomIn={zoomState?.zoomIn}
            onZoomOut={zoomState?.zoomOut}
            onResetZoom={zoomState?.resetZoom}
            onReset={reset}
            onBack={handleBackToCanvas}
            onProcess={handleProcessImage}
            onApply={handleApplyVectors}
            t={t}
          />
        </div>
      )}
    </div>
  )

  // Render as modal or standalone component
  if (isModal) {
    // Determine modal title based on editing state
    const currentModalTitle = editingResult ? t('edit-vector') : modalTitle || t('vector-wizard-beta')

    // Determine primary action based on state
    const getPrimaryAction = () => {
      if (editingResult) {
        return {
          content: t('save'),
          onAction: handleEditorSaveAction,
        }
      }
      if (showResult && vectorResults.length > 0) {
        return {
          content: onApply ? (isApplying ? t('uploading') : t('apply')) : t('close'),
          loading: onApply && isApplying,
          disabled: onApply && isApplying,
          onAction: onApply ? handleApplyVectors : onModalClose,
        }
      }
      return {
        loading: isProcessing,
        content: isProcessing ? t('processing') : t('process'),
        disabled:
          isProcessing || shapeSelections.filter(shape => shape.source !== 'deleted-auto-detected').length === 0,
        onAction: handleProcessImage,
      }
    }

    // Determine secondary actions based on state
    const getSecondaryActions = () => {
      if (editingResult) {
        return [
          {
            content: t('back'),
            onAction: handleEditorBack,
          },
        ]
      }
      if (showResult && vectorResults.length > 0) {
        return [
          {
            content: t('back'),
            onAction: handleBackToCanvas,
          },
        ]
      }
      return [
        {
          content: t('reset'),
          disabled: isProcessing,
          onAction: reset,
        },
      ]
    }

    return (
      <Modal
        size="large"
        open={modalOpen}
        onClose={handleModalCloseWithTracking}
        title={currentModalTitle}
        footer={
          // Hide footer when editing (editor has its own toolbar)
          editingResult ? undefined : (
            <VectorWizardFooter
              isModal={isModal}
              onModalClose={onModalClose}
              hasOnApplyCallback={!!onApply}
              shapeSelections={shapeSelections}
              showResult={showResult}
              vectorResults={vectorResults}
              isProcessing={isProcessing}
              isApplying={isApplying}
              zoomScale={zoomState?.scale}
              onZoomIn={zoomState?.zoomIn}
              onZoomOut={zoomState?.zoomOut}
              onResetZoom={zoomState?.resetZoom}
              t={t}
            />
          )
        }
        primaryAction={getPrimaryAction()}
        secondaryActions={getSecondaryActions()}
      >
        {VectorWizardContent}
      </Modal>
    )
  }

  return VectorWizardContent
}
