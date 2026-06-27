/**
 * Type definitions for the Simplified Product Publish Onboarding wizard.
 * All types are self-contained within this module.
 */

import type { ReactNode } from 'react'
import type { TemplatePosition, TransparentArea, ShapeSelection } from '~/modules/MockupWizard/types'

// Re-export for convenience within the module
export type { TemplatePosition, ShapeSelection }

// ============================================================================
// Step & template type unions
// ============================================================================

export type WizardStep = 'product' | 'image' | 'mockup' | 'templates' | 'preview'

/**
 * How the final publish step persists the personalization:
 *  - 'clone': duplicate the merchant's product into "Personalized {title}" (current default)
 *  - 'integrate-direct': attach the integration onto the ORIGINAL product's variants
 *    (no duplicate created). Only allowed for products with no existing active integration.
 */
export type PublishMode = 'clone' | 'integrate-direct'

export type TemplateType =
  // Text templates (instant)
  | 'plain-custom-text'
  | 'embossed-custom-text'
  | 'debossed-custom-text'
  // Initial templates (SVG vector, lazy)
  | 'plain-initial'
  | 'laser-engraving-initial'
  // Monogram templates (SVG vector, lazy)
  | 'plain-monogram'
  | 'debossed-monogram'
  | 'hot-foil-stamping-monogram'
  // Image/illustration templates (AI image, lazy)
  | 'custom-illustration'
  | 'custom-pet-portrait'
  | 'custom-person-portrait'
  | 'custom-accent-motif-pattern'

// ============================================================================
// Product & mockup data
// ============================================================================

export interface WizardProductImage {
  id: string
  url: string
  altText?: string
}

export interface WizardProduct {
  id: string
  title: string
  handle: string
  images: WizardProductImage[]
  variants: { id: string; title: string; price: string }[]
}

export interface WizardMockupResult {
  /** null for no-mask flow (merchant skipped drawing — product image used as-is) */
  processedImageUrl: string | null
  templatePositions: TemplatePosition[]
  processedDimensions: { width: number; height: number; scale?: number }
  /** True after drawComposite or user manipulation has computed final positions.
   *  When false, positions are raw area bounds from step 3 auto-apply that need
   *  fit/fill calculation on first render of step 4. */
  positionsAreComputed?: boolean
  /** Transparent areas from processing — persisted so they survive MockupWizardStep
   *  remount on bulk-mode tab switch. Without these, drawCompositeImage falls back to
   *  positionOverrides which lack sourceShapeDimensions, producing wrong template placement
   *  for non-rectangular shapes (vector paths, ellipses, rotated rectangles). */
  transparentAreas?: TransparentArea[]
  /** When true, merchant skipped drawing — template is composited on top of full product image */
  noMask?: boolean
  /** Product-image-space template positions (templatePositions / scale). Used by publish
   *  step to define print-area bounds without re-deriving scale at publish time. */
  productPositions?: TemplatePosition[]
}

// ============================================================================
// Template generation state
// ============================================================================

export interface TemplateGenState {
  status: 'idle' | 'generating' | 'ready' | 'error'
  thumbnailUrl: string | null
  /** CDN URL of the original AI-generated image (for vector/image templates) */
  sourceImageUrl: string | null
  /** SVG overlay with filter primitives (storefront reads this to extract and re-apply filter preset) */
  overlaySvg: string | null
  templateId: string | null
  error: string | null
}

// ============================================================================
// Publish state (Step 5 phases)
// ============================================================================

export type PublishPhase = 'install' | 'ready' | 'publishing' | 'completed'

export interface PublishResult {
  storefrontUrl: string
  integrationId: string
  mockupId: string
  newProductId: string
  /** Total time from wizard open to publish completion (ms) */
  totalDurationMs: number
  /** Source product ID that was published (used to look up mockup in perProductState) */
  sourceProductId?: string
  /** Mockup image URL of the published product (captured at publish time) */
  mockupImageUrl?: string
  /** Server-confirmed outcome — true when the generated mockup was promoted to the
   *  product's featured image (position 0). Used for authoritative adoption telemetry:
   *  intent (toggle value) can diverge from outcome (server may skip on failure). */
  featuredMediaReplaced?: boolean
  /** Optional error code from the server if media replacement failed (e.g., MEDIA_NOT_READY_FAILED) */
  featuredMediaError?: string
}

// ============================================================================
// Wizard state
// ============================================================================

export interface ExistingTemplate {
  id: string
  name: string
  previewUrl: string
}

/** Per-product state for bulk mode (steps 2-5 state scoped to one product).
 *  templateStates is per-product because each product's transparent area has different
 *  dimensions, so template images must be generated at matching sizes. */
export interface PerProductState {
  selectedImageUrl: string | null
  selectedImageIndex: number
  mockupResult: WizardMockupResult | null
  selectedTemplateType: TemplateType | null
  templateStates: Record<TemplateType, TemplateGenState>
  selectedExistingTemplate: ExistingTemplate | null
  publishPhase: PublishPhase
  publishResult: PublishResult | null
  /** Per-product toggle — each product has its own mockup so the decision to replace the
   *  featured image is naturally per-product. Differs from publishMode, which is global. */
  replaceFeaturedMedia: boolean
}

export interface WizardState {
  currentStep: WizardStep
  // Single-product mode (backward compat) — always reflects active product
  selectedProduct: WizardProduct | null
  selectedImageUrl: string | null
  selectedImageIndex: number
  mockupResult: WizardMockupResult | null
  selectedTemplateType: TemplateType | null
  selectedExistingTemplate: ExistingTemplate | null
  templateStates: Record<TemplateType, TemplateGenState>
  appBlockInstalled: boolean
  enabledAppEmbed: boolean
  integrationId: string | null
  isNavigating: boolean
  error: string | null
  publishPhase: PublishPhase
  publishResult: PublishResult | null
  // Publish mode — single setting applies to all products (bulk mode uses one mode for all)
  publishMode: PublishMode
  // Replace featured media — per-product in bulk mode (synced via perProductState).
  // Default false — merchant must opt in to modify product photos.
  replaceFeaturedMedia: boolean
  // Bulk mode — populated when multiple products selected
  selectedProducts: WizardProduct[]
  activeProductIndex: number
  perProductState: Record<string, PerProductState>
}

// ============================================================================
// Wizard actions (discriminated union for reducer)
// ============================================================================

export type WizardAction =
  | { type: 'SET_STEP'; step: WizardStep }
  | { type: 'SET_PRODUCT'; product: WizardProduct }
  | { type: 'SET_IMAGE'; imageUrl: string; imageIndex: number }
  | { type: 'SET_MOCKUP_RESULT'; result: WizardMockupResult | null }
  | { type: 'SELECT_TEMPLATE'; templateType: TemplateType }
  | { type: 'SET_TEMPLATE_STATE'; templateType: TemplateType; state: TemplateGenState }
  | { type: 'SET_APP_BLOCK_INSTALLED'; installed: boolean }
  | { type: 'SET_APP_EMBED_ENABLED'; enabled: boolean }
  | { type: 'SET_INTEGRATION_ID'; integrationId: string }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_NAVIGATING'; isNavigating: boolean }
  | { type: 'RESET_FROM_STEP'; step: WizardStep }
  | { type: 'SET_PUBLISH_PHASE'; phase: PublishPhase }
  | { type: 'SET_PUBLISH_RESULT'; result: PublishResult }
  | { type: 'SET_PUBLISH_MODE'; mode: PublishMode }
  | { type: 'SET_REPLACE_FEATURED_MEDIA'; value: boolean }
  | { type: 'SELECT_EXISTING_TEMPLATE'; template: ExistingTemplate | null }
  // Bulk mode actions
  | { type: 'SET_PRODUCTS'; products: WizardProduct[] }
  | { type: 'SET_ACTIVE_PRODUCT_INDEX'; index: number }
  | { type: 'UPDATE_PRODUCT_STATE'; productId: string; state: Partial<PerProductState> }
  | { type: 'UPDATE_PRODUCT_IMAGES'; productId: string; images: WizardProductImage[] }
  /** Product-scoped position update: writes templatePositions to a specific product's
   *  perProductState AND to state.mockupResult (for UI). Bypasses saveActiveProductState
   *  to prevent positions from being written to the wrong product on tab switch races. */
  | {
      type: 'SET_TEMPLATE_POSITIONS'
      productId: string
      positions: TemplatePosition[]
      productPositions?: TemplatePosition[]
    }

// ============================================================================
// Component props
// ============================================================================

export interface SimplifiedOnboardingWizardProps {
  active: boolean
  appConfig: Record<string, unknown>
  onComplete: () => void
  onSkip: () => void
  /** Identifies which surface launched the wizard (for Mixpanel funnel segmentation) */
  entryPoint?: string
  /** When set, shows a back arrow in the Page header (non-onboarding in-page mode) */
  backAction?: { content: string; onAction: () => void }
}

export interface WizardStepIndicatorProps {
  currentStep: WizardStep
  completedSteps: WizardStep[]
}

export interface TemplateThumbCardProps {
  type: TemplateType
  label: string
  state: TemplateGenState
  isSelected: boolean
  isInstant: boolean
  onClick: () => void
  /** Regenerate an AI-generated template (non-instant only) */
  onRegenerate?: () => void
}

export interface SimulatedPreviewProps {
  productTitle: string
  productPrice: string
  productImageUrl: string
}

// ============================================================================
// API types
// ============================================================================

export interface GenerateTemplateRequest {
  templateType: TemplateType
  productId: string
  productImageUrl: string
  mockupResult: WizardMockupResult
  integrationId?: string
}

export interface GenerateTemplateResponse {
  success: boolean
  templateId: string
  integrationId: string
  thumbnailUrl: string
  error?: string
}

// ============================================================================
// A/B test
// ============================================================================

export type ABTestGroup = 'control' | 'treatment'

// ============================================================================
// useWizardCore return type (public contract consumed by WizardContent etc.)
// ============================================================================

/** Ref type for MockupWizardStep — structural to avoid circular import */
export interface MockupWizardStepRefLike {
  triggerProcess: () => boolean
  getCompositeDataUrl: () => string | null
}

export interface WizardCoreReturn {
  state: WizardState
  dispatch: React.Dispatch<WizardAction>
  isMobileView: boolean
  /** useTranslation t function — exposed so WizardContent can use it without re-calling the hook */
  t: (key: string, options?: Record<string, unknown>) => string
  primaryAction: { content: string; onAction: () => void; disabled?: boolean; loading?: boolean } | undefined
  secondaryActions: { content: string; onAction: () => void; loading?: boolean; disabled?: boolean }[]
  title: string
  completedSteps: WizardStep[]
  handleClose: () => void
  handleProductSelect: (product: WizardProduct) => void
  handleProductsSelect: (products: WizardProduct[]) => void
  handleProductTabChange: (index: number) => void
  handleImageSelect: (index: number) => void
  handleMockupApply: (result: WizardMockupResult) => void
  handleMockupError: () => void
  handleShapeCountChange: (count: number) => void
  handleShapeSelectionsChange: (shapes: ShapeSelection[]) => void
  handleTemplatePositionsChange: (positions: TemplatePosition[]) => void
  goToStep: (step: WizardStep) => void
  currentProductShapes: ShapeSelection[] | undefined
  /** Ref to MockupWizardStep for composite data URL capture */
  mockupStepRef: React.RefObject<MockupWizardStepRefLike>
  compositeImageUrlRef: React.MutableRefObject<string | null>
  compositeImageUrlsRef: React.MutableRefObject<Record<string, string>>
  currentTemplateImageUrls: string[]
  templateListContent: ReactNode
  publishStepMessage: string
  wizardStartTime: number
  trackEvent: (event: string, data?: Record<string, unknown>) => void
}
