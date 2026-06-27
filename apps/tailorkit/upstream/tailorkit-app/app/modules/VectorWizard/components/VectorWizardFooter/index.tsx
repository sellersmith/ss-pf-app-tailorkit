import React from 'react'
import { InlineStack, Button, Text } from '@shopify/polaris'
import { PlusIcon, MinusIcon, SearchIcon } from '@shopify/polaris-icons'
import type { ShapeSelection, VectorResult } from '../../types'
import { MIN_SCALE } from '~/constants/canvas'
import useDevices from '~/utils/hooks/useDevice'
import styles from '../../styles.module.css'

interface VectorWizardFooterProps {
  isModal: boolean
  onModalClose?: () => void
  hasOnApplyCallback?: boolean // New: to determine button text

  // State props
  shapeSelections: ShapeSelection[]
  showResult: boolean
  vectorResults: VectorResult[]
  isProcessing: boolean
  isApplying: boolean

  // Zoom props (only for canvas view)
  zoomScale?: number
  onZoomIn?: () => void
  onZoomOut?: () => void
  onResetZoom?: () => void

  // Action props
  onReset?: () => void
  onBack?: () => void
  onProcess?: () => void
  onApply?: () => void

  // Translation
  t: (key: string, options?: any) => string
}

export default function VectorWizardFooter({
  isModal,
  onModalClose,
  hasOnApplyCallback = false,
  shapeSelections,
  showResult,
  vectorResults,
  isProcessing,
  isApplying,
  zoomScale,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onReset,
  onBack,
  onProcess,
  onApply,
  t,
}: VectorWizardFooterProps) {
  const { isMobileView } = useDevices()

  // Determine button text based on whether onApply callback exists
  const applyButtonText = hasOnApplyCallback ? (isApplying ? t('uploading') : t('apply')) : undefined
  // Mobile layout for non-modal UI
  if (isMobileView && !isModal) {
    return (
      <div className={`${styles.footer} ${styles.mobileFooter}`}>
        {/* Mobile Zoom Controls */}
        {!(showResult && vectorResults.length > 0)
          && zoomScale !== undefined
          && onZoomIn
          && onZoomOut
          && onResetZoom && (
            <div className={styles.zoomControlsWrapper}>
              <Button
                size="medium"
                icon={MinusIcon}
                onClick={onZoomOut}
                accessibilityLabel="Zoom out"
                disabled={zoomScale <= MIN_SCALE}
              />
              <Button size="medium" icon={SearchIcon} onClick={onResetZoom} accessibilityLabel="Reset zoom" />
              <Text variant="bodyMd" as="span" tone="subdued">
                {Math.round(zoomScale * 100)}%
              </Text>
              <Button
                size="medium"
                icon={PlusIcon}
                onClick={onZoomIn}
                accessibilityLabel="Zoom in"
                disabled={zoomScale >= 5.0}
              />
            </div>
          )}

        {/* Mobile Action Buttons */}
        <div className={styles.actionButtonsWrapper}>
          {showResult && vectorResults.length > 0 ? (
            <>
              <Button onClick={onBack} size="large">
                {t('back')}
              </Button>
              <Button
                variant="primary"
                onClick={hasOnApplyCallback ? onApply : onModalClose}
                loading={hasOnApplyCallback && isApplying}
                disabled={hasOnApplyCallback && isApplying}
                size="large"
              >
                {applyButtonText || t('close')}
              </Button>
            </>
          ) : (
            <>
              <Button onClick={onReset} disabled={isProcessing} size="large">
                {t('reset')}
              </Button>
              <Button
                variant="primary"
                onClick={onProcess}
                loading={isProcessing}
                disabled={
                  isProcessing || shapeSelections.filter(shape => shape.source !== 'deleted-auto-detected').length === 0
                }
                size="large"
              >
                {isProcessing ? t('processing') : t('process')}
              </Button>
            </>
          )}
        </div>
      </div>
    )
  }

  // Desktop layout (unchanged)
  return (
    <InlineStack gap="200" align="space-between">
      {/* Zoom Controls */}
      {!(showResult && vectorResults.length > 0) && zoomScale !== undefined && onZoomIn && onZoomOut && onResetZoom && (
        <>
          <Button
            size="micro"
            icon={MinusIcon}
            onClick={onZoomOut}
            accessibilityLabel="Zoom out"
            disabled={zoomScale <= MIN_SCALE}
          />
          <Button size="micro" icon={SearchIcon} onClick={onResetZoom} accessibilityLabel="Reset zoom" />
          <Text variant="bodySm" as="span" tone="subdued">
            {Math.round(zoomScale * 100)}%
          </Text>
          <Button
            size="micro"
            icon={PlusIcon}
            onClick={onZoomIn}
            accessibilityLabel="Zoom in"
            disabled={zoomScale >= 5.0}
          />
        </>
      )}

      {/* Canvas Footer */}
      {!isModal && (
        <InlineStack gap="200">
          {showResult && vectorResults.length > 0 ? (
            <>
              {/* Result Footer */}
              <Button onClick={onBack}>{t('back')}</Button>
              <Button
                variant="primary"
                onClick={hasOnApplyCallback ? onApply : onModalClose}
                loading={hasOnApplyCallback && isApplying}
                disabled={hasOnApplyCallback && isApplying}
              >
                {applyButtonText || t('close')}
              </Button>
            </>
          ) : (
            <>
              <Button onClick={onReset} disabled={isProcessing}>
                {t('reset')}
              </Button>
              <Button
                variant="primary"
                onClick={onProcess}
                loading={isProcessing}
                disabled={
                  isProcessing || shapeSelections.filter(shape => shape.source !== 'deleted-auto-detected').length === 0
                }
              >
                {isProcessing ? t('processing') : t('process')}
              </Button>
            </>
          )}
        </InlineStack>
      )}
    </InlineStack>
  )
}
