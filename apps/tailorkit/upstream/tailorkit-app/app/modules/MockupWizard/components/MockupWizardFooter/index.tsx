import { InlineStack, Button, Text } from '@shopify/polaris'
import { PlusIcon, MinusIcon, SearchIcon } from '@shopify/polaris-icons'
import type { ShapeSelection } from '../../types'
import { MIN_SCALE } from '~/constants/canvas'
import useScreenBreakpoints from '~/utils/hooks/use-screen-breakpoints'
import styles from '../../styles.module.css'

interface MockupWizardFooterProps {
  isModal: boolean

  // State props
  shapeSelections: ShapeSelection[]
  detectedShapes: any[]
  detectionStatus: 'idle' | 'detecting' | 'completed' | 'failed'
  detectionStats: any
  showResult: boolean
  processedImageUrl: string | null
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

export default function MockupWizardFooter({
  isModal,
  shapeSelections,
  showResult,
  processedImageUrl,
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
}: MockupWizardFooterProps) {
  const { isMobileView } = useScreenBreakpoints()
  // Mobile layout for non-modal UI
  if (isMobileView && !isModal) {
    return (
      <div className={`${styles.footer} ${styles.mobileFooter}`}>
        {/* Mobile Zoom Controls */}
        {!(showResult && processedImageUrl) && zoomScale !== undefined && onZoomIn && onZoomOut && onResetZoom && (
          <div className={styles.zoomControlsWrapper}>
            <Button size="medium" icon={SearchIcon} onClick={onResetZoom} accessibilityLabel="Reset zoom" />
            <Button
              size="medium"
              icon={MinusIcon}
              onClick={onZoomOut}
              accessibilityLabel="Zoom out"
              disabled={zoomScale <= MIN_SCALE}
            />
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
          {showResult && processedImageUrl ? (
            <>
              <Button onClick={onBack} size="large">
                {t('back')}
              </Button>
              <Button variant="primary" onClick={onApply} loading={isApplying} disabled={isApplying} size="large">
                {isApplying ? t('uploading') : t('apply')}
              </Button>
            </>
          ) : (
            <>
              <Button onClick={onReset} disabled={isProcessing} size="large">
                {t('reset')}
              </Button>
              <Button
                id="mockup-wizard-process-btn"
                variant="primary"
                onClick={onProcess}
                loading={isProcessing}
                disabled={isProcessing || shapeSelections.length === 0}
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
      {!(showResult && processedImageUrl) && zoomScale !== undefined && onZoomIn && onZoomOut && onResetZoom && (
        <>
          <Button size="micro" icon={SearchIcon} onClick={onResetZoom} accessibilityLabel="Reset zoom" />
          <Button
            size="micro"
            icon={MinusIcon}
            onClick={onZoomOut}
            accessibilityLabel="Zoom out"
            disabled={zoomScale <= MIN_SCALE}
          />
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
          {showResult && processedImageUrl ? (
            <>
              {/* Result Footer */}
              <Button onClick={onBack}>{t('back')}</Button>
              <Button variant="primary" onClick={onApply} loading={isApplying} disabled={isApplying}>
                {isApplying ? t('uploading') : t('apply')}
              </Button>
            </>
          ) : (
            <>
              <Button onClick={onReset} disabled={isProcessing}>
                {t('reset')}
              </Button>
              <Button
                id="mockup-wizard-process-btn"
                variant="primary"
                onClick={onProcess}
                loading={isProcessing}
                disabled={isProcessing || shapeSelections.length === 0}
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
