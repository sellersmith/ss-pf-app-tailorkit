/**
 * WizardContent: renders the step indicator and current step content.
 * Receives all state and handlers via WizardCoreReturn — pure presentational
 * orchestrator with no local state.
 */

import { BlockStack, Text } from '@shopify/polaris'
import { WizardStepIndicator } from './WizardStepIndicator'
import { ProductSelectionStep, type PaginationState } from './steps/ProductSelectionStep'
import { ImageSelectionStep } from './steps/ImageSelectionStep'
import { MockupWizardStep } from './steps/MockupWizardStep'
import { StorefrontPreviewStep } from './steps/StorefrontPreviewStep'
import { ProductTabBar } from './components/ProductTabBar'
import type { WizardCoreReturn } from './hooks/useWizardCore'
import { SIMPLIFIED_ONBOARDING_EVENTS } from './tracking-events'

export interface WizardContentProps {
  core: WizardCoreReturn
  appConfig: Record<string, unknown>
  /** When true, the header (step indicator + heading) is rendered separately by the parent */
  hideHeader?: boolean
  /** Dynamic height (px) for the single scrollable content block in each step */
  scrollableHeight?: number
  /** Callback with pagination state for rendering in the footer */
  onPaginationChange?: (pagination: PaginationState | null) => void
}

/** Fixed header: step indicator + step heading/description. Exported separately
 *  so WizardInPage can render it outside the scroll container. */
export function WizardContentHeader({ core }: { core: WizardCoreReturn }) {
  const { state, t } = core
  // Hide heading on congrats screen (preview step after publish completed)
  const isPublishCompleted = state.currentStep === 'preview' && state.publishPhase === 'completed'
  const isBulkMode = state.selectedProducts.length > 1
  const showTabBar = isBulkMode && state.currentStep !== 'product'
  const stepInfo = isPublishCompleted
    ? null
    : (isBulkMode && STEP_HEADINGS_BULK[state.currentStep]) || STEP_HEADINGS[state.currentStep]

  return ((!core.isMobileView || stepInfo || showTabBar) && (
    <BlockStack gap="300">
      {!core.isMobileView && (
        <WizardStepIndicator currentStep={state.currentStep} completedSteps={core.completedSteps} />
      )}
      {stepInfo && (
        <BlockStack gap="100">
          <Text as="h2" variant="headingMd">
            {t(stepInfo.heading)}
          </Text>
          <Text as="p" variant="bodyMd" tone="subdued">
            {t(stepInfo.description)}
          </Text>
        </BlockStack>
      )}
      {showTabBar && (
        <ProductTabBar
          products={state.selectedProducts}
          activeIndex={state.activeProductIndex}
          perProductState={state.perProductState}
          currentStep={state.currentStep}
          onTabChange={core.handleProductTabChange}
        />
      )}
    </BlockStack>
  )) as React.ReactElement | null
}

/** Step heading + description for each wizard step */
const STEP_HEADINGS: Record<string, { heading: string; description: string }> = {
  product: {
    heading: 'choose-a-product-to-personalize',
    description: 'pick-a-product-we-ll-create-a-personalized-copy',
  },
  image: {
    heading: 'pick-a-product-image',
    description: 'choose-a-base-image-for-your-realistic-mockup',
  },
  mockup: {
    heading: 'define-the-personalization-area',
    description: 'draw-where-personalization-will-appear',
  },
  templates: {
    heading: 'choose-a-template-style',
    description: 'select-a-template-style-customers-will-see-an-ai-powered-editor-to-customize-this-area',
  },
  preview: {
    heading: 'Your product is ready to go live',
    description: 'Publish your personalized product and see it on your store.',
  },
}

/** Bulk-mode step headings — tabs make the per-product context clear */
const STEP_HEADINGS_BULK: Record<string, { heading: string; description: string }> = {
  image: {
    heading: 'Pick an image for each product',
    description: 'Select the image angle where personalization will appear',
  },
  mockup: {
    heading: 'Where should personalization appear?',
    description: 'Draw to mark the area — or skip to use the full image.',
  },
  templates: {
    heading: 'Choose template styles',
    description: 'Select a template style for each product',
  },
}

export function WizardContent({
  core,
  appConfig,
  hideHeader,
  scrollableHeight,
  onPaginationChange,
}: WizardContentProps) {
  const { state } = core
  const isBulkMode = state.selectedProducts.length > 1

  const renderStepBody = () => {
    switch (state.currentStep) {
      case 'product':
        return (
          <ProductSelectionStep
            selectedProduct={state.selectedProduct}
            selectedProducts={state.selectedProducts}
            onSelectProduct={core.handleProductSelect}
            onSelectProducts={core.handleProductsSelect}
            hideHeader
            scrollableHeight={scrollableHeight}
            onPaginationChange={onPaginationChange}
          />
        )

      case 'image':
        return state.selectedProduct ? (
          <ImageSelectionStep
            // key forces remount on tab switch — clean lifecycle per product
            key={isBulkMode ? state.selectedProduct.id : undefined}
            images={state.selectedProduct.images}
            selectedIndex={state.selectedImageIndex}
            onSelect={core.handleImageSelect}
            onAutoAdvance={isBulkMode ? undefined : () => core.goToStep('mockup')}
            hideHeader
            scrollableHeight={scrollableHeight}
          />
        ) : null

      case 'mockup':
      case 'templates': {
        return state.selectedImageUrl ? (
          <MockupWizardStep
            // key forces remount on tab switch — frees canvas/Konva memory
            key={isBulkMode ? state.selectedProduct?.id : undefined}
            ref={core.mockupStepRef}
            imageUrl={state.selectedImageUrl}
            templateImages={core.currentTemplateImageUrls}
            showResult={state.currentStep === 'templates'}
            processedImageUrlOverride={state.mockupResult?.processedImageUrl ?? undefined}
            noMask={state.mockupResult?.noMask ?? false}
            initialTemplatePositions={state.mockupResult?.templatePositions}
            initialPositionsAreComputed={state.mockupResult?.positionsAreComputed}
            resultSideContent={core.templateListContent}
            onApply={core.handleMockupApply}
            onError={core.handleMockupError}
            onShapeCountChange={core.handleShapeCountChange}
            onShapeSelectionsChange={core.handleShapeSelectionsChange}
            onTemplatePositionsChange={core.handleTemplatePositionsChange}
            initialShapeSelections={core.currentProductShapes}
            storedTransparentAreas={state.mockupResult?.transparentAreas}
            scrollableHeight={scrollableHeight}
          />
        ) : null
      }

      case 'preview':
        return state.selectedProduct && state.mockupResult ? (
          <StorefrontPreviewStep
            key={isBulkMode ? state.selectedProduct.id : undefined}
            product={state.selectedProduct}
            mockupResult={state.mockupResult}
            compositeImageUrl={
              (isBulkMode
                && state.selectedProduct?.id
                && core.compositeImageUrlsRef.current[state.selectedProduct.id])
              || core.compositeImageUrlRef.current
            }
            selectedTemplateType={state.selectedTemplateType}
            appConfig={appConfig}
            appBlockInstalled={state.appBlockInstalled}
            publishPhase={state.publishPhase}
            publishResult={state.publishResult}
            publishStepMessage={core.publishStepMessage}
            wizardStartTime={core.wizardStartTime}
            hideHeader
            onAppBlockInstalled={installed => {
              core.dispatch({ type: 'SET_APP_BLOCK_INSTALLED', installed })
              if (installed) {
                core.dispatch({ type: 'SET_PUBLISH_PHASE', phase: 'ready' })
              }
              core.trackEvent(SIMPLIFIED_ONBOARDING_EVENTS.APP_BLOCK_STATUS, {
                installedDuringStep: installed,
              })
            }}
            onAppEmbedEnabled={enabled => {
              core.dispatch({ type: 'SET_APP_EMBED_ENABLED', enabled })
            }}
            publishMode={state.publishMode}
            selectedProductCount={state.selectedProducts.length || (state.selectedProduct ? 1 : 0)}
            replaceFeaturedMedia={state.replaceFeaturedMedia}
            onPublishModeChange={(mode, previousMode) => {
              core.dispatch({ type: 'SET_PUBLISH_MODE', mode })
              core.trackEvent(SIMPLIFIED_ONBOARDING_EVENTS.PUBLISH_MODE_CHANGED, {
                from_mode: previousMode,
                to_mode: mode,
                product_id: state.selectedProduct?.id,
                is_bulk: state.selectedProducts.length > 1,
                // Cross-correlation: lets us segment publish-mode changes by concurrent
                // replace-featured-media state (e.g. which users flip both toggles).
                replace_featured_media: state.replaceFeaturedMedia,
              })
            }}
            onReplaceFeaturedMediaChange={(next, previous) => {
              core.dispatch({ type: 'SET_REPLACE_FEATURED_MEDIA', value: next })
              core.trackEvent(SIMPLIFIED_ONBOARDING_EVENTS.REPLACE_FEATURED_MEDIA_TOGGLED, {
                from_checked: previous,
                to_checked: next,
                product_id: state.selectedProduct?.id,
                is_bulk: state.selectedProducts.length > 1,
                // Cross-correlation: segment opt-ins by publish mode.
                publish_mode: state.publishMode,
              })
            }}
          />
        ) : null

      default:
        return null
    }
  }

  if (hideHeader) {
    return renderStepBody()
  }

  return (
    <BlockStack gap="400">
      <WizardContentHeader core={core} />
      {renderStepBody()}
    </BlockStack>
  )
}
