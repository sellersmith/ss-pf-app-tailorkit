/**
 * State machine (reducer) for the Simplified Onboarding wizard.
 * Pure function — no side effects, fully testable.
 */

import { TEMPLATE_TYPES, WIZARD_STEPS } from './constants'
import type { PerProductState, TemplateGenState, TemplateType, WizardAction, WizardState, WizardStep } from './types'

// ============================================================================
// Initial state factory
// ============================================================================

function createInitialTemplateStates(): Record<TemplateType, TemplateGenState> {
  const states = {} as Record<TemplateType, TemplateGenState>
  for (const config of TEMPLATE_TYPES) {
    states[config.type] = {
      status: 'idle',
      thumbnailUrl: null,
      sourceImageUrl: null,
      overlaySvg: null,
      templateId: null,
      error: null,
    }
  }
  return states
}

export function createInitialWizardState(): WizardState {
  return {
    currentStep: 'product',
    selectedProduct: null,
    selectedImageUrl: null,
    selectedImageIndex: 0,
    mockupResult: null,
    selectedTemplateType: null,
    selectedExistingTemplate: null,
    templateStates: createInitialTemplateStates(),
    appBlockInstalled: false,
    enabledAppEmbed: false,
    integrationId: null,
    isNavigating: false,
    error: null,
    publishPhase: 'install',
    publishResult: null,
    // Default to 'clone' — preserves the existing safe behavior. The toggle on Step 5
    // lets the merchant opt into 'integrate-direct' to attach personalization to the
    // ORIGINAL product instead of duplicating it.
    publishMode: 'clone',
    // Default OFF — never modify the merchant's product photos without explicit consent.
    // Toggle lives on Step 5 beside the publish-mode toggle; per-product in bulk mode.
    replaceFeaturedMedia: false,
    // Bulk mode
    selectedProducts: [],
    activeProductIndex: 0,
    perProductState: {},
  }
}

// ============================================================================
// Helper: clear downstream state from a given step
// ============================================================================

function getStepIndex(step: WizardStep): number {
  return WIZARD_STEPS.indexOf(step)
}

function clearDownstreamState(state: WizardState, fromStep: WizardStep): WizardState {
  const fromIndex = getStepIndex(fromStep)
  let result = { ...state }

  // Clear state for steps at or after fromIndex
  if (fromIndex <= getStepIndex('image')) {
    result = {
      ...result,
      selectedImageUrl: null,
      selectedImageIndex: 0,
    }
  }
  if (fromIndex <= getStepIndex('mockup')) {
    result = {
      ...result,
      mockupResult: null,
    }
  }
  if (fromIndex <= getStepIndex('templates')) {
    result = {
      ...result,
      selectedTemplateType: null,
      selectedExistingTemplate: null,
      templateStates: createInitialTemplateStates(),
      integrationId: null,
    }
  }
  if (fromIndex <= getStepIndex('preview')) {
    result = {
      ...result,
      appBlockInstalled: false,
      enabledAppEmbed: false,
      publishPhase: 'install',
      publishResult: null,
    }
  }

  return result
}

/** Create initial per-product state for bulk mode. */
function createInitialPerProductState(): PerProductState {
  return {
    selectedImageUrl: null,
    selectedImageIndex: 0,
    mockupResult: null,
    selectedTemplateType: null,
    selectedExistingTemplate: null,
    templateStates: createInitialTemplateStates(),
    publishPhase: 'install',
    publishResult: null,
    // Safe default — merchant must opt in to modify product photos.
    replaceFeaturedMedia: false,
  }
}

/** Sync single-product fields from the active product's per-product state. */
function syncActiveProductState(state: WizardState): WizardState {
  if (state.selectedProducts.length <= 1) return state
  const activeProduct = state.selectedProducts[state.activeProductIndex]
  if (!activeProduct) return state
  const pps = state.perProductState[activeProduct.id]
  if (!pps) return state
  return {
    ...state,
    selectedProduct: activeProduct,
    selectedImageUrl: pps.selectedImageUrl,
    selectedImageIndex: pps.selectedImageIndex,
    mockupResult: pps.mockupResult,
    selectedTemplateType: pps.selectedTemplateType,
    selectedExistingTemplate: pps.selectedExistingTemplate,
    templateStates: pps.templateStates,
    publishPhase: pps.publishPhase,
    publishResult: pps.publishResult,
    replaceFeaturedMedia: pps.replaceFeaturedMedia,
  }
}

/** Save current single-product fields back to the active product's per-product state. */
function saveActiveProductState(state: WizardState): WizardState {
  if (state.selectedProducts.length <= 1) return state
  const activeProduct = state.selectedProducts[state.activeProductIndex]
  if (!activeProduct) return state
  return {
    ...state,
    perProductState: {
      ...state.perProductState,
      [activeProduct.id]: {
        selectedImageUrl: state.selectedImageUrl,
        selectedImageIndex: state.selectedImageIndex,
        mockupResult: state.mockupResult,
        selectedTemplateType: state.selectedTemplateType,
        selectedExistingTemplate: state.selectedExistingTemplate,
        templateStates: state.templateStates,
        publishPhase: state.publishPhase,
        publishResult: state.publishResult,
        replaceFeaturedMedia: state.replaceFeaturedMedia,
      },
    },
  }
}

// ============================================================================
// Reducer
// ============================================================================

/** Actions that modify single-product fields — auto-synced to perProductState in bulk mode. */
const PER_PRODUCT_SYNC_ACTIONS: ReadonlySet<WizardAction['type']> = new Set([
  'SET_IMAGE',
  'SET_MOCKUP_RESULT',
  'SELECT_TEMPLATE',
  'SELECT_EXISTING_TEMPLATE',
  'SET_TEMPLATE_STATE',
  'SET_PUBLISH_PHASE',
  'SET_PUBLISH_RESULT',
  'SET_REPLACE_FEATURED_MEDIA',
])

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  const nextState = wizardReducerCore(state, action)
  // In bulk mode, auto-sync single-product fields → perProductState after mutations
  if (nextState.selectedProducts.length > 1 && PER_PRODUCT_SYNC_ACTIONS.has(action.type)) {
    const saved = saveActiveProductState(nextState)
    return saved
  }
  return nextState
}

function wizardReducerCore(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_STEP':
      return {
        ...state,
        currentStep: action.step,
        error: null,
      }

    case 'SET_PRODUCT': {
      // If product changed, clear downstream state
      const productChanged = state.selectedProduct?.id !== action.product.id
      const baseState = productChanged ? clearDownstreamState(state, 'image') : state
      // Clear bulk mode when switching to single product selection
      return {
        ...baseState,
        selectedProduct: action.product,
        selectedProducts: [],
        activeProductIndex: 0,
        perProductState: {},
        error: null,
      }
    }

    case 'SET_IMAGE': {
      // If the image changed, clear mockup and downstream state (shapes, templates)
      // so Step 3 doesn't show stale selections from the previous image
      const imageChanged = state.selectedImageUrl !== action.imageUrl
      const base = imageChanged ? clearDownstreamState(state, 'mockup') : state
      return {
        ...base,
        selectedImageUrl: action.imageUrl,
        selectedImageIndex: action.imageIndex,
        error: null,
      }
    }

    case 'SET_MOCKUP_RESULT': {
      // When mockup result changes (new shape processed), clear downstream template
      // state so Step 4 regenerates templates with the new shape's dimensions/rotation
      const base = clearDownstreamState(state, 'templates')
      return {
        ...base,
        mockupResult: action.result,
        error: null,
      }
    }

    case 'SELECT_TEMPLATE':
      return {
        ...state,
        selectedTemplateType: action.templateType,
        selectedExistingTemplate: null, // mutual exclusion with existing template
      }

    case 'SELECT_EXISTING_TEMPLATE':
      return {
        ...state,
        selectedExistingTemplate: action.template,
        selectedTemplateType: null, // mutual exclusion with AI-generated
      }

    case 'SET_TEMPLATE_STATE':
      return {
        ...state,
        templateStates: {
          ...state.templateStates,
          [action.templateType]: action.state,
        },
      }

    case 'SET_APP_BLOCK_INSTALLED':
      return {
        ...state,
        appBlockInstalled: action.installed,
      }

    case 'SET_APP_EMBED_ENABLED':
      return {
        ...state,
        enabledAppEmbed: action.enabled,
      }

    case 'SET_INTEGRATION_ID':
      return {
        ...state,
        integrationId: action.integrationId,
      }

    case 'SET_ERROR':
      return {
        ...state,
        error: action.error,
      }

    case 'SET_NAVIGATING':
      return {
        ...state,
        isNavigating: action.isNavigating,
      }

    case 'SET_PUBLISH_PHASE':
      return {
        ...state,
        publishPhase: action.phase,
      }

    case 'SET_PUBLISH_RESULT':
      return {
        ...state,
        publishPhase: 'completed',
        publishResult: action.result,
      }

    case 'SET_PUBLISH_MODE':
      // Mode is independent of step state — do NOT clear downstream. Toggle persists
      // across product changes / step resets so a merchant's choice survives navigation.
      return {
        ...state,
        publishMode: action.mode,
      }

    case 'SET_REPLACE_FEATURED_MEDIA':
      // Per-product toggle (bulk-sync via PER_PRODUCT_SYNC_ACTIONS above). Independent of
      // step state — persists across navigation within the active product.
      return {
        ...state,
        replaceFeaturedMedia: action.value,
      }

    case 'RESET_FROM_STEP':
      return {
        ...clearDownstreamState(state, action.step),
        currentStep: action.step,
        error: null,
      }

    // Bulk mode actions
    case 'SET_PRODUCTS': {
      const products = action.products
      const perProductState: Record<string, PerProductState> = {}
      for (const p of products) {
        perProductState[p.id] = createInitialPerProductState()
      }
      return {
        ...state,
        selectedProducts: products,
        selectedProduct: products[0] || null,
        activeProductIndex: 0,
        perProductState,
        error: null,
      }
    }

    case 'SET_ACTIVE_PRODUCT_INDEX': {
      // Save current product's state, switch to new index, load new product's state
      const saved = saveActiveProductState(state)
      const result = syncActiveProductState({
        ...saved,
        activeProductIndex: action.index,
      })
      return result
    }

    case 'UPDATE_PRODUCT_STATE': {
      const existing = state.perProductState[action.productId] || createInitialPerProductState()
      return {
        ...state,
        perProductState: {
          ...state.perProductState,
          [action.productId]: { ...existing, ...action.state },
        },
      }
    }

    case 'SET_TEMPLATE_POSITIONS': {
      // Product-scoped position update: writes directly to a specific product's
      // perProductState by ID. Uses the PRODUCT's stored mockupResult as base (not
      // state.mockupResult which may belong to a different product after a tab switch).
      // Also updates state.mockupResult for UI rendering ONLY if this is the active product.
      const pps = state.perProductState[action.productId]
      const baseMockupResult = pps?.mockupResult || state.mockupResult
      if (!baseMockupResult) return state
      // In single-product mode (selectedProducts is empty), always update flat mockupResult.
      // In bulk mode, only update if this is the active product to prevent cross-product overwrite.
      const isActiveProduct
        = state.selectedProducts.length <= 1 || action.productId === state.selectedProducts[state.activeProductIndex]?.id
      const updatedResult = {
        ...baseMockupResult,
        templatePositions: action.positions,
        positionsAreComputed: true,
        ...(action.productPositions !== undefined ? { productPositions: action.productPositions } : {}),
      }
      return {
        ...state,
        // Only update the flat mockupResult field if this is the active product.
        // Otherwise, we'd overwrite the active product's data with another product's.
        mockupResult: isActiveProduct ? updatedResult : state.mockupResult,
        perProductState: pps
          ? {
              ...state.perProductState,
              [action.productId]: { ...pps, mockupResult: updatedResult },
            }
          : state.perProductState,
      }
    }

    case 'UPDATE_PRODUCT_IMAGES': {
      const updatedProducts = state.selectedProducts.map(p =>
        p.id === action.productId ? { ...p, images: action.images } : p
      )
      // Also update selectedProduct if it's the active one
      const activeProduct = updatedProducts[state.activeProductIndex]
      return {
        ...state,
        selectedProducts: updatedProducts,
        selectedProduct: activeProduct?.id === action.productId ? activeProduct : state.selectedProduct,
      }
    }

    default:
      return state
  }
}
