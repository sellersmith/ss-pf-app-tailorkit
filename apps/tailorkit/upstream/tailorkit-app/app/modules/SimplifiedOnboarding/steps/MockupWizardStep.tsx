/**
 * Steps 3-4: MockupWizard (Define Area + Template Preview)
 *
 * Single MockupWizard instance that serves two wizard steps:
 * - Step 3 (mockup): Canvas mode — user draws personalization area
 * - Step 4 (templates): Result mode — composite preview + template list in side panel
 *
 * When processing completes, the wizard advances to step 4 and MockupWizard
 * shows its ResultView with hideResultSettings + resultSideContent (template list).
 * Template images are passed dynamically so the composite updates on selection.
 */

import { useCallback, useImperativeHandle, useRef, useState, forwardRef, type ReactNode } from 'react'
import { Banner, BlockStack } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import MockupWizard from '~/modules/MockupWizard'
import type { ShapeSelection, TemplatePosition, TransparentArea } from '~/modules/MockupWizard/types'
import type { WizardMockupResult } from '../types'
import styles from '../styles.module.css'

interface MockupWizardStepProps {
  imageUrl: string
  /** Current template preview image URLs to composite on the mockup */
  templateImages: string[]
  /** Content for the right column in result view (template list) */
  resultSideContent?: ReactNode
  /** Whether result view is showing (step 4 active) */
  showResult: boolean
  /** Override the mask URL (e.g. no-shadow mask for non-plain templates) */
  processedImageUrlOverride?: string
  /** When true, no mask layer is applied — template composites on top of full product image */
  noMask?: boolean
  /** Pre-computed template positions from stored mockupResult (for direct advance) */
  initialTemplatePositions?: TemplatePosition[]
  /** Whether initialTemplatePositions are computed (fitted/manipulated) vs raw area bounds */
  initialPositionsAreComputed?: boolean
  onApply: (result: WizardMockupResult) => void
  /** Called when processing fails */
  onError?: (error: string) => void
  /** Called when the number of valid shape selections changes */
  onShapeCountChange?: (count: number) => void
  /** Called when template positions change (from drawComposite or manipulator) */
  onTemplatePositionsChange?: (positions: TemplatePosition[]) => void
  /** Restored shape selections from bulk-mode tab persistence */
  initialShapeSelections?: ShapeSelection[]
  /** Called when shape selections change (for bulk-mode tab persistence) */
  onShapeSelectionsChange?: (shapes: ShapeSelection[]) => void
  /** Stored transparent areas from previous processing (survives bulk-mode remount) */
  storedTransparentAreas?: TransparentArea[]
  /** Dynamic height (px) for the scrollable canvas / result view */
  scrollableHeight?: number
}

export interface MockupWizardStepRef {
  /** Programmatically trigger MockupWizard's Process action. Returns true if triggered, false if button was disabled/missing. */
  triggerProcess: () => boolean
  /** Capture the composite canvas as a data URL */
  getCompositeDataUrl: () => string | null
}

export const MockupWizardStep = forwardRef<MockupWizardStepRef, MockupWizardStepProps>(function MockupWizardStep(
  {
    imageUrl,
    templateImages,
    resultSideContent,
    showResult,
    processedImageUrlOverride,
    noMask = false,
    initialTemplatePositions,
    initialPositionsAreComputed,
    onApply,
    onError,
    onShapeCountChange,
    onTemplatePositionsChange,
    initialShapeSelections,
    onShapeSelectionsChange,
    storedTransparentAreas,
    scrollableHeight,
  },
  ref
) {
  const { t } = useTranslation()
  const [error, setError] = useState<string | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Expose triggerProcess and getCompositeDataUrl to parent
  useImperativeHandle(ref, () => ({
    triggerProcess() {
      const btn = wrapperRef.current?.querySelector<HTMLButtonElement>('#mockup-wizard-process-btn')
      if (btn && !btn.disabled) {
        btn.click()
        return true
      }
      return false
    },
    getCompositeDataUrl() {
      const canvas = wrapperRef.current?.querySelector<HTMLCanvasElement>('canvas')
      if (canvas && canvas.width > 0 && canvas.height > 0) {
        try {
          return canvas.toDataURL('image/png')
        } catch {
          return null
        }
      }
      return null
    },
  }))

  const handleApply = useCallback(
    (
      processedImageUrl: string,
      templatePositions?: TemplatePosition[],
      processedDimensions?: { width: number; height: number },
      areas?: TransparentArea[]
    ) => {
      if (!processedImageUrl) {
        setError(t('failed-to-process-image-please-try-again'))
        return
      }

      const result: WizardMockupResult = {
        processedImageUrl,
        templatePositions: templatePositions || [],
        processedDimensions: processedDimensions || { width: 0, height: 0 },
        transparentAreas: areas,
      }
      onApply(result)
    },
    [onApply, t]
  )

  const handleError = useCallback(
    (errorMessage: string) => {
      setError(errorMessage)
      onError?.(errorMessage)
    },
    [onError]
  )

  return (
    <BlockStack gap="400">
      {error && (
        <Banner
          tone="critical"
          title={t('failed-to-process-image-please-try-again')}
          onDismiss={() => setError(null)}
        />
      )}

      {/* Step 3 (canvas): footer hidden via CSS so Process button stays in DOM for triggerProcess.
            Step 4 (result): footer hidden via hideFooter prop, height constrained to prevent modal scroll. */}
      <div ref={wrapperRef} className={styles.mockupWizardWrapper} data-show-result={showResult || undefined}>
        <MockupWizard
          imageUrl={imageUrl}
          isModal={false}
          hideTitle
          hideInstructions
          hideFooter={showResult}
          hideMobileControls
          forceFullTransparency
          skipResultView={!showResult}
          canvasHeight={scrollableHeight ? `${scrollableHeight}px` : 'max(60vh, 400px)'}
          showAdvancedSettings={false}
          templateImages={templateImages}
          processedImageUrlOverride={showResult ? (noMask ? imageUrl : processedImageUrlOverride) : undefined}
          initialTemplatePositions={showResult ? initialTemplatePositions : undefined}
          initialPositionsAreComputed={showResult ? initialPositionsAreComputed : undefined}
          defaultTemplatePositioningMode="fit"
          hideResultSettings
          resultSideContent={showResult ? resultSideContent : undefined}
          resultContainerHeight={scrollableHeight ? `${scrollableHeight}px` : 'max(60vh, 400px)'}
          onApply={handleApply}
          onError={handleError}
          onShapeCountChange={onShapeCountChange}
          onTemplatePositionsChange={onTemplatePositionsChange}
          initialShapeSelections={initialShapeSelections}
          onShapeSelectionsChange={onShapeSelectionsChange}
          storedTransparentAreas={showResult ? storedTransparentAreas : undefined}
          noMask={noMask}
        />
      </div>
    </BlockStack>
  )
})
