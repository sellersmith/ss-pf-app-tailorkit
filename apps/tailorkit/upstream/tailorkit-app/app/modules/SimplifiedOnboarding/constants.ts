/**
 * Constants for the Simplified Product Publish Onboarding wizard.
 */

import type { TemplateType, WizardStep } from './types'

// ============================================================================
// Step definitions
// ============================================================================

export const WIZARD_STEPS: readonly WizardStep[] = ['product', 'image', 'mockup', 'templates', 'preview'] as const

export const STEP_LABELS: Record<WizardStep, string> = {
  product: 'Product',
  image: 'Image',
  mockup: 'Area',
  templates: 'Template',
  preview: 'Preview',
}

export const STEP_NUMBERS: Record<WizardStep, number> = {
  product: 1,
  image: 2,
  mockup: 3,
  templates: 4,
  preview: 5,
}

// ============================================================================
// Template type definitions
// ============================================================================

export interface TemplateTypeConfig {
  type: TemplateType
  label: string
  isInstant: boolean
}

export const TEMPLATE_TYPES: TemplateTypeConfig[] = [
  // Text templates (instant — rendered client-side via Konva)
  { type: 'plain-custom-text', label: 'Plain Text', isInstant: true },
  { type: 'embossed-custom-text', label: 'Embossed Text', isInstant: true },
  { type: 'debossed-custom-text', label: 'Debossed Text', isInstant: true },
  // Initial templates (lazy — AI vector generation + optional filter)
  { type: 'plain-initial', label: 'Plain Initial', isInstant: false },
  { type: 'laser-engraving-initial', label: 'Laser Engraving Initial', isInstant: false },
  // Monogram templates (lazy — AI vector generation + optional filter)
  { type: 'plain-monogram', label: 'Plain Monogram', isInstant: false },
  { type: 'debossed-monogram', label: 'Debossed Monogram', isInstant: false },
  { type: 'hot-foil-stamping-monogram', label: 'Hot Foil Stamping Monogram', isInstant: false },
  // Image/illustration templates (lazy — AI image generation)
  { type: 'custom-illustration', label: 'Custom Illustration', isInstant: false },
  { type: 'custom-pet-portrait', label: 'Custom Pet Portrait', isInstant: false },
  { type: 'custom-person-portrait', label: 'Custom Person Portrait', isInstant: false },
  { type: 'custom-accent-motif-pattern', label: 'Custom Accent Motif Pattern', isInstant: false },
]

export const INSTANT_TEMPLATE_TYPES: TemplateType[] = TEMPLATE_TYPES.filter(t => t.isInstant).map(t => t.type)

export const LAZY_TEMPLATE_TYPES: TemplateType[] = TEMPLATE_TYPES.filter(t => !t.isInstant).map(t => t.type)

// ============================================================================
// Pre-made (ready-made) templates — curated starting points from the control
// onboarding path. Cloned to the merchant's shop on selection.
// ============================================================================

export interface PremadeTemplateConfig {
  id: string
  label: string
  /** CDN thumbnail for the card — same images used in the control path category grid */
  image: string
}

/** Pre-made templates available in the simplified flow Step 4. Excludes "Explore all features" (no template). */
export const PREMADE_TEMPLATES: PremadeTemplateConfig[] = [
  {
    id: 'b4cb4839-4d2c-4d19-8bd9-dd7616fbe5c3',
    label: 'Custom text',
    image: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Custom_text.png?v=1772076703',
  },
  {
    id: '29a0a82b-b6ab-4b15-be6e-10dc46f214eb',
    label: 'Engraving effects',
    image: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/3D_effects.png?v=1772076703',
  },
  {
    id: '35b73c20-9feb-4f3f-87c8-eba30bbf629f',
    label: 'Multi-line text',
    image: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Multiline.png?v=1772076716',
  },
  {
    id: 'f2c42cbb-8004-4937-b2b9-3f6c45e90173',
    label: 'Curve text',
    image: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Curve.png?v=1772076703',
  },
  {
    id: 'd87d2df0-9258-486b-8ef8-34beec7ae2bc',
    label: 'Image upload',
    image: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Upload_image.png?v=1772076703',
  },
  {
    id: '09af59ba-05ec-4e21-904a-dc0b4a5a30c6',
    label: 'AI image effects',
    image: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/AI_Image.png?v=1772076703',
  },
  {
    id: '43eb2610-0f5f-4fcf-9b49-d13a72b07db3',
    label: 'Image shapes',
    image: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Image_shape.png?v=1772076709',
  },
]

// ============================================================================
// Session storage keys
// ============================================================================

export const SESSION_STORAGE_KEY = 'TLK_ONBOARDING_PENDING_PUBLISH'
export const AB_TEST_SESSION_KEY = 'TLK_ONBOARDING_AB_GROUP'

// ============================================================================
// Misc
// ============================================================================

/** Maximum number of product images to display in Step 2 */
export const MAX_PRODUCT_IMAGES = 20

/** Auto-advance delay (ms) when product has only one image */
export const SINGLE_IMAGE_AUTO_ADVANCE_DELAY = 500

/** Maximum concurrent lazy template generation requests */
export const MAX_CONCURRENT_GENERATIONS = 2

// ============================================================================
// A/B test flags
// ============================================================================

/**
 * Feature flag for the "Create new personalized product" A/B test.
 *
 * When true, clicks on "Create" buttons are randomly routed to:
 *   - 'control': Existing ProductSelector modal flow
 *   - 'treatment': SimplifiedOnboardingWizard in-page flow
 *
 * When false, all users see the control (existing flow).
 */
export const SIMPLIFIED_CREATE_AB_TEST_FLAG = true
