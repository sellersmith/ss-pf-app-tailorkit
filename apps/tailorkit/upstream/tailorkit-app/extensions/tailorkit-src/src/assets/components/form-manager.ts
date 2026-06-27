import { PROPERTY_PREFIX, PRINT_ID_PREFIX, ProductPersonalizerWebComponentTag } from '../constants'
import type { DisplayDataMap, MetaData } from '../utils/update-form-data'
import { generateUniqueId } from '../utils/uuid'
import { smoothScrollToElement } from '../utils/scroll'
import type { TailorKitProductPersonalizer } from './product-personalizer'
import { isFieldSetHidden } from '../utils/fieldset'
import { CLASS_TAILORKIT_INPUT, CLASS_TAILORKIT_TRACKING } from '../utils/dom-constants'
import { getConfirmationCheckboxSettings } from '../features/confirmation-checkbox/settings'
import { PersonalizerStore } from '../libraries/personalizer-store'
import { ATC_ALPINE_SELECTORS, ALL_CHECKOUT_SELECTORS, ATC_BUTTON_SELECTORS } from '../constants/selectors'
import { validateFields, type FieldDefinition, type ValidationRule } from '../validators'
import { FEATURE_FLAGS } from '../constants/feature-flags'
import { formatCustomerPrice, getCustomerCurrencyInfo } from '../utils/storefront-pricing'
import { getFeature } from '../utils/feature-loader'
import type { CharmBuilderFeatureModule } from '../utils/feature-loader.types'

// ─── Per-instance state ────────────────────────────────────────────────────
// Each product-personalizer/customizer pair on the page gets its own state
// bucket keyed by instanceId (e.g. "123456::page", "default").
// This prevents cross-instance contamination when two products are shown
// on the same page (cross-product modal / multi-instance scenario).
//
// BACKWARD COMPAT: All public static methods that previously used the module-level
// variables now accept an optional `instanceId` parameter that defaults to 'default',
// preserving identical behaviour for all single-instance call sites.
// ──────────────────────────────────────────────────────────────────────────

interface PerInstanceState {
  /** Flag to skip checkbox validation when triggered from modal (modal already validated) */
  skipCheckboxValidation: boolean
  /** Track confirmation checkbox state (persists across modal open/close) */
  modalConfirmationChecked: boolean
  /** Flag to indicate modal mode is active — skip inline validation */
  isModalModeActive: boolean
  /** Modal trigger container reference for shake animation */
  modalTriggerContainer: HTMLElement | null
  /** Current instance ID for modal-mode validation */
  modalInstanceId: string
  /** Cached field definitions extracted from window.__tailorkit__ */
  cachedFieldDefinitions: FieldDefinition[]
  /** Stored Alpine.js on:click handlers (to restore when unblocking) */
  storedOnClickHandlers: Map<HTMLElement, string>
  /** Click interceptors attached to theme buttons */
  clickInterceptors: Map<HTMLElement, (e: Event) => void>
}

const _instanceStates = new Map<string, PerInstanceState>()

function getInstanceState(instanceId: string = 'default'): PerInstanceState {
  if (!_instanceStates.has(instanceId)) {
    _instanceStates.set(instanceId, {
      skipCheckboxValidation: false,
      modalConfirmationChecked: false,
      isModalModeActive: false,
      modalTriggerContainer: null,
      modalInstanceId: '',
      cachedFieldDefinitions: [],
      storedOnClickHandlers: new Map(),
      clickInterceptors: new Map(),
    })
  }
  return _instanceStates.get(instanceId)!
}

/** Call from disconnectedCallback to prevent memory leaks. */
export function destroyFormManagerInstance(instanceId: string): void {
  const state = _instanceStates.get(instanceId)
  if (state) {
    state.storedOnClickHandlers.clear()
    state.clickInterceptors.clear()
    _instanceStates.delete(instanceId)
  }
}

// ─── Legacy module-level fallbacks (kept for any direct module-level reads) ─
// These are only used by code that was written before instanceId support.
// All internal logic now goes through getInstanceState(instanceId).
// ────────────────────────────────────────────────────────────────────────────

/**
 * Handles form management and input creation for add-to-cart forms
 */
export class FormManager {
  /**
   * Update all add-to-cart forms with the processed data
   */
  static updateAddToCartForms(
    addToCartForms: HTMLFormElement[],
    metaData: MetaData,
    displayData: { [printAreaId: string]: DisplayDataMap },
    productPersonalizer: TailorKitProductPersonalizer,
    productName: string,
    getDisplayValueWithPricing: (fieldset: Element, layerOption: { value: string }) => string
  ) {
    addToCartForms.forEach(addToCartForm => {
      // Clear previous inputs
      FormManager.clearPreviousInputs(addToCartForm)

      // Add basic form data with a placeholder ref_id (will be regenerated on submit)
      const initialRefId = generateUniqueId()
      FormManager.addBasicFormData(addToCartForm, initialRefId, productName)

      // Add metadata inputs
      FormManager.addMetaDataInputs(addToCartForm, metaData)

      // Add display data inputs
      FormManager.addDisplayDataInputs(addToCartForm, displayData, productPersonalizer, getDisplayValueWithPricing)

      // Add charm selection inputs (if charm builder is enabled)
      FormManager.addCharmInputs(addToCartForm, productPersonalizer)

      // Ensure a fresh ref_id is generated every time the merchant clicks "Add to cart"
      FormManager.attachRefIdGenerator(addToCartForm, productName)
    })
  }

  /**
   * Clear previous inputs from form
   */
  private static clearPreviousInputs(addToCartForm: HTMLFormElement) {
    // Remove all inputs with data-name attribute (both emtlkit--input and emtlkit--tracking)
    addToCartForm.querySelectorAll('input[data-name]').forEach(input => input.parentNode?.removeChild(input))
  }

  /**
   * Add basic form data
   */
  private static addBasicFormData(addToCartForm: HTMLFormElement, uniqueId: string, productName: string) {
    FormManager.createInputElement(`${PROPERTY_PREFIX}_ref_id`, uniqueId, addToCartForm)
    FormManager.createInputElement(`${PROPERTY_PREFIX}_product_name`, productName, addToCartForm)
    FormManager.createInputElement(PROPERTY_PREFIX, PROPERTY_PREFIX, addToCartForm)
  }

  /**
   * Add metadata inputs to form
   */
  private static addMetaDataInputs(addToCartForm: HTMLFormElement, metaData: MetaData) {
    for (const printAreaId in metaData) {
      const isEmpty = !Object.keys(metaData[printAreaId]).length

      if (isEmpty) {
        const propName = `${PROPERTY_PREFIX} ${printAreaId} empty-option-set`
        FormManager.createInputElement(propName, printAreaId, addToCartForm)
      }

      for (const layerId in metaData[printAreaId]) {
        const propName = `${PROPERTY_PREFIX} ${printAreaId} ${layerId}`
        FormManager.createInputElement(propName, metaData[printAreaId][layerId], addToCartForm)
      }
    }
  }

  /**
   * Add display data inputs to form
   */
  private static addDisplayDataInputs(
    addToCartForm: HTMLFormElement,
    displayData: { [printAreaId: string]: DisplayDataMap },
    productPersonalizer: TailorKitProductPersonalizer,
    getDisplayValueWithPricing: (fieldset: Element, layerOption: { value: string }) => string
  ) {
    const labelOptions: { [key: string]: string } = {}

    for (const printAreaId in displayData) {
      for (const layerId in displayData[printAreaId]) {
        const layerOptions = displayData[printAreaId][layerId] as { type: string; label: string; value: string }[]

        layerOptions.forEach(layerOption => {
          const label = FormManager.getUniqueLabel(layerOption.label as string, labelOptions)
          labelOptions[label] = layerOption.value

          // Get the fieldset for pricing information
          const fieldset = productPersonalizer.querySelector(
            `fieldset[data-print-area-id="${printAreaId}"][data-layer-id="${layerId}"][data-option-type="${layerOption.type}"]`
          )

          const displayValueWithPricing = fieldset
            ? getDisplayValueWithPricing(fieldset, layerOption)
            : layerOption.value

          // Create input label for displaying name with pricing
          FormManager.createInputElement(label, displayValueWithPricing, addToCartForm)

          // Create label print id with property prefix
          const propsName = `${PROPERTY_PREFIX} ${label} ${PRINT_ID_PREFIX}:${printAreaId}`
          FormManager.createInputElement(propsName, displayValueWithPricing, addToCartForm)
        })
      }
    }
  }

  /**
   * Add charm selection inputs to form.
   *
   * NEW (multi-builder): writes a single consolidated `_TLK_charms` JSON property
   * containing selections, slots, and positions for ALL charm builders, keyed by layerId:
   * ```
   * {
   *   [layerId]: { products: { [productId]: { variantId, qty, unitPrice, currencyCode } },
   *                slots?: [...], positions?: [...] }
   * }
   * ```
   *
   * LEGACY (single-builder backward compat): also writes individual flat keys
   * (`_PF_charm_<productId>`, `_PF_charm_slots`, `_PF_charm_positions`) when there
   * is exactly one charm builder, so old print-render code continues to work.
   *
   * Gated behind CHARM_BUILDER_STOREFRONT feature flag.
   */
  static addCharmInputs(addToCartForm: HTMLFormElement, productPersonalizer: TailorKitProductPersonalizer) {
    if (!FEATURE_FLAGS.CHARM_BUILDER_STOREFRONT) return

    const charmStateMap = productPersonalizer.charmStateMap
    if (!charmStateMap || charmStateMap.size === 0) return

    const currencyInfo = getCustomerCurrencyInfo()

    // Access charm-builder IIFE module for slot/position data
    const charmModule = getFeature<CharmBuilderFeatureModule>('charm-builder')

    // Build consolidated JSON payload — one entry per active charm builder
    const consolidatedCharms: Record<
      string,
      {
        products: Record<string, { variantId: string; qty: number; unitPrice: string; currencyCode: string }>
        slots?: unknown[]
        positions?: unknown[]
      }
    > = {}

    for (const [layerId, charmState] of charmStateMap) {
      if (!charmState.selections.length) continue

      // Customer-visible display properties (one per selection across all builders)
      for (const selection of charmState.selections) {
        const unitPriceInCustomerCurrency = (parseFloat(selection.price) || 0) * currencyInfo.rate
        const totalPriceInCustomerCurrency = unitPriceInCustomerCurrency * selection.quantity
        const formattedTotal = formatCustomerPrice(totalPriceInCustomerCurrency, currencyInfo)

        const displayLabel = `Charm - ${selection.title} x${selection.quantity}`
        const displayValue = `+${currencyInfo.symbol}${formattedTotal}`
        FormManager.createInputElement(displayLabel, displayValue, addToCartForm)
      }

      // Build per-layer products map for the consolidated property
      const productsMap: Record<string, { variantId: string; qty: number; unitPrice: string; currencyCode: string }>
        = {}
      for (const selection of charmState.selections) {
        productsMap[selection.productId] = {
          variantId: selection.variantId,
          qty: selection.quantity,
          unitPrice: selection.price,
          currencyCode: selection.currencyCode,
        }
      }

      const layerEntry: (typeof consolidatedCharms)[string] = { products: productsMap }

      // Attach slot assignments and free-mode positions if available
      if (charmModule) {
        const slotAssignments = charmModule.getSlotAssignments(layerId)
        if (slotAssignments.length > 0) layerEntry.slots = slotAssignments

        const freeModePositions = charmModule.getFreeModePositions(layerId)
        if (freeModePositions.length > 0) layerEntry.positions = freeModePositions
      }

      consolidatedCharms[layerId] = layerEntry
    }

    if (Object.keys(consolidatedCharms).length === 0) return

    // Write consolidated JSON property (new format — read by Phase 4 print render)
    FormManager.createInputElement(`${PROPERTY_PREFIX}_charms`, JSON.stringify(consolidatedCharms), addToCartForm, true)

    // BACKWARD COMPAT: when there is exactly one charm builder, also write legacy flat keys
    // so existing print-render code (Phase 4) continues to work until it's updated.
    if (charmStateMap.size === 1) {
      const [layerId, charmState] = Array.from(charmStateMap.entries())[0]
      for (const selection of charmState.selections) {
        const trackingLabel = `${PROPERTY_PREFIX}_charm_${selection.productId}`
        const trackingValue = JSON.stringify({
          variantId: selection.variantId,
          qty: selection.quantity,
          unitPrice: selection.price,
          currencyCode: selection.currencyCode,
        })
        FormManager.createInputElement(trackingLabel, trackingValue, addToCartForm, true)
      }

      if (charmModule) {
        const slotAssignments = charmModule.getSlotAssignments(layerId)
        if (slotAssignments.length > 0) {
          FormManager.createInputElement(
            `${PROPERTY_PREFIX}_charm_slots`,
            JSON.stringify(slotAssignments),
            addToCartForm,
            true
          )
        }
        const freeModePositions = charmModule.getFreeModePositions(layerId)
        if (freeModePositions.length > 0) {
          FormManager.createInputElement(
            `${PROPERTY_PREFIX}_charm_positions`,
            JSON.stringify(freeModePositions),
            addToCartForm,
            true
          )
        }
      }
    }
  }

  /**
   * Add confirmation checkbox input to form if enabled and checked.
   * Called at submit time to capture current checkbox state.
   * Public alias for use by Buy It Now handler.
   */
  static addConfirmationCheckboxInputToForm(addToCartForm: HTMLFormElement) {
    FormManager.addConfirmationCheckboxInput(addToCartForm)
  }

  /**
   * Add confirmation checkbox input to form if enabled and checked.
   * Called at submit time to capture current checkbox state.
   */
  private static addConfirmationCheckboxInput(addToCartForm: HTMLFormElement) {
    const confirmationLabel = '_Confirmation'

    // Remove any existing confirmation input (in case of re-submission)
    const existingInput = addToCartForm.querySelector(`input[data-name="${confirmationLabel}"]`)
    existingInput?.remove()

    const settings = getConfirmationCheckboxSettings()
    if (!settings.enabled) return

    // Find the confirmation checkbox input
    const checkboxInput = document.querySelector('input[data-confirmation-input="true"]') as HTMLInputElement | null

    if (checkboxInput?.checked) {
      FormManager.createInputElement(confirmationLabel, 'Confirmed', addToCartForm)
    }
  }

  /**
   * Get unique label to avoid duplicates
   */
  private static getUniqueLabel(originalLabel: string, labelOptions: { [key: string]: string }): string {
    let label = originalLabel

    if (labelOptions[label]) {
      // Find the last label in labelOptions that contains label and has #
      const lastLabel = Object.keys(labelOptions)
        .filter(key => key.includes(label) && key.includes('#'))
        .pop()

      if (lastLabel) {
        // Get index of label
        const [, indexOfLabel] = lastLabel.split('#')
        // Plus one to identify which label
        label = `${label} #${parseInt(indexOfLabel) + 1}`
      } else {
        // Assign next label is second index
        label = `${label} #2`
      }
    }

    return label
  }

  /**
   * Create input element and append to parent
   */
  static createInputElement(label: string, value: string, parent: HTMLElement, isTracking: boolean = false) {
    const input = document.createElement('input')

    input.value = value
    input.type = 'hidden'
    input.name = `properties[${label}]`
    input.className = isTracking ? CLASS_TAILORKIT_TRACKING : CLASS_TAILORKIT_INPUT

    parent.appendChild(input)
    input.setAttribute('data-name', label)
  }

  /**
   * Validate that all required text customer inputs are filled.
   * If any required field is empty, the first one will be focused and the page
   * will scroll to it. Returns true when the form is valid.
   */
  static validateRequiredTextCustomers(): boolean {
    // Look for TailorKit personalizer on the page
    const productPersonalizer = document.querySelector(
      ProductPersonalizerWebComponentTag
    ) as TailorKitProductPersonalizer | null

    if (!productPersonalizer) {
      return true // No customizer – nothing to validate
    }

    // Find all required text_customer fieldsets
    const requiredLabels = productPersonalizer.querySelectorAll(
      'fieldset[data-option-type="text_customer"] label.emtlkit--required-indicator'
    )

    for (const labelEl of Array.from(requiredLabels)) {
      const fieldset = labelEl.closest('fieldset')

      if (!fieldset || isFieldSetHidden(fieldset)) continue

      // Check for both input[type="text"] and textarea (multi-line text fields)
      const input = fieldset.querySelector('input[type="text"], textarea') as
        | HTMLInputElement
        | HTMLTextAreaElement
        | null

      if (input && input.value.trim() === '') {
        // Smooth scroll & focus
        smoothScrollToElement(input as HTMLElement)
        // Focus without altering scroll (preventScroll avoids jump)
        input.focus({ preventScroll: true } as any)

        // Trigger shake animation on the label
        labelEl.classList.remove('emtlkit--required-indicator--shake')
        // Force reflow to restart animation
        void (labelEl as HTMLElement).offsetWidth
        labelEl.classList.add('emtlkit--required-indicator--shake')

        return false
      }
    }

    return true
  }

  /**
   * Validate that all required image upload fields have at least one image.
   * If any required field is empty, scrolls to it and shakes the label. Returns true when valid.
   */
  static validateRequiredImageUploads(): boolean {
    const productPersonalizer = document.querySelector(
      ProductPersonalizerWebComponentTag
    ) as TailorKitProductPersonalizer | null

    if (!productPersonalizer) {
      return true // No customizer – nothing to validate
    }

    // Find all required image option fieldsets
    const requiredLabels = productPersonalizer.querySelectorAll(
      'fieldset[data-option-type="image_option"] label.emtlkit--required-indicator'
    )

    for (const labelEl of Array.from(requiredLabels)) {
      const fieldset = labelEl.closest('fieldset') as HTMLFieldSetElement | null

      if (!fieldset || isFieldSetHidden(fieldset)) continue

      // Check if there are any uploaded/generated images in the options list
      // Images are rendered in .image-uploaded-generated-option-set-container with radio inputs
      const imageContainer = fieldset.querySelector('.image-uploaded-generated-option-set-container')
      const hasImages = (imageContainer?.querySelectorAll('input[type="radio"][data-id]')?.length ?? 0) > 0

      if (!hasImages) {
        // Smooth scroll to fieldset
        smoothScrollToElement(fieldset)

        // Trigger shake animation on the label
        labelEl.classList.remove('emtlkit--required-indicator--shake')
        // Force reflow to restart animation
        void (labelEl as HTMLElement).offsetWidth
        labelEl.classList.add('emtlkit--required-indicator--shake')

        return false
      }
    }

    return true
  }

  /**
   * Set flag to skip checkbox validation (used by modal after it validates)
   */
  static setSkipCheckboxValidation(skip: boolean, instanceId: string = 'default'): void {
    getInstanceState(instanceId).skipCheckboxValidation = skip
  }

  /**
   * Check if checkbox validation should be skipped
   * Note: This does NOT reset the flag - only validateConfirmationCheckbox() resets it
   */
  static shouldSkipCheckboxValidation(instanceId: string = 'default'): boolean {
    return getInstanceState(instanceId).skipCheckboxValidation
  }

  /**
   * Set modal confirmation checkbox state (persists across modal open/close)
   */
  static setModalConfirmationChecked(checked: boolean, instanceId: string = 'default'): void {
    getInstanceState(instanceId).modalConfirmationChecked = checked
  }

  /**
   * Get modal confirmation checkbox state
   */
  static isModalConfirmationChecked(instanceId: string = 'default'): boolean {
    return getInstanceState(instanceId).modalConfirmationChecked
  }

  /**
   * Set modal mode active state
   * When modal mode is active, FormManager should not perform inline validation
   * because the ModalButtonInterceptor handles validation
   */
  static setModalModeActive(active: boolean, instanceId: string = 'default'): void {
    getInstanceState(instanceId).isModalModeActive = active
  }

  /**
   * Check if modal mode is active
   */
  static isModalMode(instanceId: string = 'default'): boolean {
    return getInstanceState(instanceId).isModalModeActive
  }

  /**
   * Validate that the confirmation checkbox is checked (if enabled).
   * If unchecked and feature is enabled, scrolls to checkbox and triggers shake animation.
   * Returns true when validation passes.
   */
  static validateConfirmationCheckbox(instanceId: string = 'default'): boolean {
    const state = getInstanceState(instanceId)

    // Skip validation if flag is set (modal already validated).
    // Defer reset to next microtask so BOTH click + submit handlers in the same
    // event cycle see the flag as true (the click handler runs first in capture
    // phase, then the submit handler — both need to pass).
    if (state.skipCheckboxValidation) {
      queueMicrotask(() => {
        state.skipCheckboxValidation = false
      })
      return true
    }

    // Skip validation in modal mode - ModalButtonInterceptor handles it
    if (state.isModalModeActive) {
      return true
    }

    const settings = getConfirmationCheckboxSettings()

    // If feature is disabled, skip validation
    if (!settings.enabled) {
      return true
    }

    // Find the confirmation checkbox element using specific data attribute
    const checkbox = document.querySelector('[data-confirmation-input="true"]') as HTMLInputElement | null

    if (!checkbox) {
      // Checkbox not rendered yet - allow submission
      return true
    }

    const checkboxWrapper = checkbox.closest('[data-confirmation-checkbox]') as HTMLElement | null

    // Check the actual DOM checked property
    const isChecked = checkbox.checked === true

    if (!isChecked) {
      // Scroll to checkbox wrapper (or checkbox if wrapper not found)
      smoothScrollToElement(checkboxWrapper || checkbox)

      // Trigger shake animation by adding/removing class
      if (checkboxWrapper) {
        checkboxWrapper.classList.remove('emtlkit-confirmation-checkbox--shake')
        // Force reflow to restart animation
        void checkboxWrapper.offsetWidth
        checkboxWrapper.classList.add('emtlkit-confirmation-checkbox--shake')
      }

      // Focus checkbox for accessibility
      checkbox.focus({ preventScroll: true } as any)

      return false
    }

    return true
  }

  // ==================== STATE-BASED VALIDATION (FOR MODAL MODE) ====================

  /**
   * Extract field definitions from window.__tailorkit__ product personalizer data.
   * Uses declarative rules instead of type-specific validation.
   * Layer info is in: lis[].data.ls[].s.required
   */
  static extractFieldDefinitions(instanceId: string = 'default'): FieldDefinition[] {
    // Prefer namespaced data for multi-instance; fall back to flat key for single-instance compat
    const ns = instanceId !== 'default' ? window.__tailorkit__?.[instanceId] : null
    const productPersonalizer = ns?.['product_personalizer'] ?? window.__tailorkit__?.['product_personalizer']

    if (!productPersonalizer) {
      return []
    }

    const lis = productPersonalizer.lis || []
    const fields: FieldDefinition[] = []

    for (const li of lis) {
      // Only template type layer integrations have option layers
      if (li.t !== 'template') continue

      const printAreaId = li.data?.printAreaId || ''
      const layers = li.data?.ls || []

      for (const layer of layers) {
        const settings = layer.s || {}

        // Build rules from settings - NO TYPE CHECKS
        const rules: ValidationRule[] = []

        if (settings.required) {
          rules.push({ type: 'required' })
          rules.push({ type: 'notEmpty' })
        }

        // Future extensibility: add more rules from settings
        // if (settings.minLength) rules.push({ type: 'minLength', params: { length: settings.minLength } })
        // if (settings.maxLength) rules.push({ type: 'maxLength', params: { length: settings.maxLength } })
        // if (settings.pattern) rules.push({ type: 'pattern', params: { pattern: settings.pattern } })

        if (rules.length > 0) {
          fields.push({
            printAreaId,
            layerId: layer.i,
            rules,
            label: settings.label || settings.n || layer.n,
            // Track controller dependencies for visibility-aware validation
            isControlledBy: layer.isControlledBy,
          })
        }
      }
    }

    getInstanceState(instanceId).cachedFieldDefinitions = fields
    return fields
  }

  /**
   * Validate all required fields using PersonalizerStore state.
   * Uses declarative rule-based validation via validateFields.
   * Used when DOM elements are not available (modal mode with modal closed).
   */
  private static validateRequiredFieldsFromState(instanceId: string): { isValid: boolean; reason?: string } {
    const state = PersonalizerStore.getState(instanceId)
    if (!state) return { isValid: false, reason: 'no_state' }

    const { metaData } = state
    const instanceState = getInstanceState(instanceId)
    const fields
      = instanceState.cachedFieldDefinitions.length > 0
        ? instanceState.cachedFieldDefinitions
        : this.extractFieldDefinitions(instanceId)

    // Filter out hidden controlled layers: if a layer is controlled by another layer
    // and has no metaData entry, it means OptionProcessor deleted it because the
    // fieldset is hidden (the controller's selected option doesn't show this layer).
    const visibleFields = fields.filter(field => {
      if (!field.isControlledBy?.length) return true
      const hasMetaData = metaData?.[field.printAreaId]?.[field.layerId] !== undefined
      return hasMetaData
    })

    const result = validateFields(visibleFields, metaData)

    if (!result.isValid) {
      const firstError = result.errors[0]
      return { isValid: false, reason: `validation_failed: ${firstError?.rule}` }
    }

    return { isValid: true }
  }

  /**
   * Validate all required fields for modal mode.
   * Returns { isValid: true } if all fields are filled, or { isValid: false, reason: string } if not.
   */
  static validateAllFieldsFromState(instanceId: string): { isValid: boolean; reason?: string } {
    const instanceState = getInstanceState(instanceId)

    // Re-extract field definitions in case they weren't available at init time
    if (instanceState.cachedFieldDefinitions.length === 0) {
      this.extractFieldDefinitions(instanceId)
    }

    // If no fields with rules, check confirmation checkbox only
    if (instanceState.cachedFieldDefinitions.length === 0) {
      return this.validateConfirmationCheckboxFromState(instanceId)
    }

    // Validate all fields using declarative rules
    const result = this.validateRequiredFieldsFromState(instanceId)
    if (!result.isValid) return result

    // All fields validated, check confirmation checkbox
    return this.validateConfirmationCheckboxFromState(instanceId)
  }

  /**
   * Validate confirmation checkbox for modal mode (state-based).
   */
  private static validateConfirmationCheckboxFromState(instanceId: string = 'default'): {
    isValid: boolean
    reason?: string
  } {
    const instanceState = getInstanceState(instanceId)
    const confirmationSettings = getConfirmationCheckboxSettings()

    if (confirmationSettings.enabled) {
      // Check FormManager's persisted state (set by modal when checkbox is checked)
      if (instanceState.modalConfirmationChecked) {
        return { isValid: true }
      }

      // Check skipCheckboxValidation flag
      if (instanceState.skipCheckboxValidation) {
        return { isValid: true }
      }

      // Also check 'default' instance — modal sets confirmation flags on 'default',
      // but the theme button interceptor validates against a product-specific instanceId
      // (e.g. '1869178535987::page'). Without this fallback, the modal's checkbox
      // confirmation is invisible to the interceptor, blocking ATC after modal close.
      if (instanceId !== 'default') {
        const defaultState = getInstanceState('default')
        if (defaultState.modalConfirmationChecked || defaultState.skipCheckboxValidation) {
          return { isValid: true }
        }
      }

      // Check DOM checkbox (for inline mode or if modal is open)
      const checkbox = document.querySelector('[data-confirmation-input="true"]') as HTMLInputElement | null

      if (!checkbox) {
        // Checkbox not in DOM and state is false - user needs to open modal
        return { isValid: false, reason: 'confirmation_not_checked_state' }
      }

      if (!checkbox.checked) {
        return { isValid: false, reason: 'confirmation_unchecked' }
      }
    }

    return { isValid: true }
  }

  // ==================== BUTTON BLOCKING (FOR MODAL MODE) ====================

  /**
   * Set modal trigger container reference for shake animation
   */
  static setModalTriggerContainer(container: HTMLElement | null, instanceId: string = 'default'): void {
    getInstanceState(instanceId).modalTriggerContainer = container
  }

  /**
   * Set modal instance ID for validation
   */
  static setModalInstanceId(instanceId: string, ownerInstanceId: string = 'default'): void {
    getInstanceState(ownerInstanceId).modalInstanceId = instanceId
    // Extract field definitions when instance ID is set
    this.extractFieldDefinitions(instanceId)
  }

  /**
   * Show shake animation on the modal trigger button
   */
  static shakeModalTrigger(instanceId: string = 'default'): void {
    const { modalTriggerContainer } = getInstanceState(instanceId)
    if (!modalTriggerContainer) return

    const triggerButton = modalTriggerContainer.querySelector('button') as HTMLElement | null
    if (!triggerButton) return

    // Scroll to the trigger button if not fully visible
    smoothScrollToElement(triggerButton)

    // Add shake animation class
    triggerButton.classList.remove('emtlkit-modal-trigger--shake')
    void triggerButton.offsetWidth // Force reflow
    triggerButton.classList.add('emtlkit-modal-trigger--shake')

    // Remove shake class after animation completes
    setTimeout(() => {
      triggerButton.classList.remove('emtlkit-modal-trigger--shake')
    }, 500)
  }

  /**
   * Handle theme button click in modal mode - validate and block if needed.
   * instanceId is captured in the interceptor closure at blockThemeButtons() call time.
   */
  private static handleThemeButtonClick(e: Event, instanceId: string): void {
    const { modalInstanceId: validationInstanceId } = getInstanceState(instanceId)
    const validationResult = this.validateAllFieldsFromState(validationInstanceId || instanceId)

    if (validationResult.isValid) {
      return // Allow click
    }

    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()
    this.shakeModalTrigger(instanceId)
  }

  /**
   * Intercept form submit events in modal mode
   */
  private static interceptFormSubmits(parentElement: HTMLElement, instanceId: string): void {
    const productId = parentElement.getAttribute('data-product-id')
    if (!productId) return

    const productInputs = document.querySelectorAll(`input[name="product-id"][value="${productId}"]`)
    productInputs.forEach(input => {
      const form = input.closest('form[action*="/cart/add"]') as HTMLFormElement
      if (!form || form.dataset.tlkModalInterceptorAttached === 'true') return

      form.dataset.tlkModalInterceptorAttached = 'true'
      form.addEventListener(
        'submit',
        e => {
          const { modalInstanceId: validationInstanceId } = getInstanceState(instanceId)
          const validationResult = this.validateAllFieldsFromState(validationInstanceId || instanceId)
          if (!validationResult.isValid) {
            e.preventDefault()
            e.stopPropagation()
            e.stopImmediatePropagation()
            this.shakeModalTrigger(instanceId)
          }
        },
        true
      )
    })
  }

  /**
   * Block theme ATC/BIN buttons by removing on:click attributes and intercepting clicks.
   * Call this in modal mode to prevent form submission until required fields are filled.
   */
  static blockThemeButtons(parentElement: HTMLElement, instanceId: string = 'default'): void {
    const state = getInstanceState(instanceId)

    // Remove on:click attributes from buttons with Alpine.js handlers
    ATC_ALPINE_SELECTORS.forEach(selector => {
      document.querySelectorAll(selector).forEach(button => {
        const el = button as HTMLElement
        const onClickValue = el.getAttribute('on:click')
        if (onClickValue && !state.storedOnClickHandlers.has(el)) {
          state.storedOnClickHandlers.set(el, onClickValue)
          el.removeAttribute('on:click')
        }
      })
    })

    // Add click interceptors to all checkout buttons
    ALL_CHECKOUT_SELECTORS.forEach(selector => {
      document.querySelectorAll(selector).forEach(button => {
        const el = button as HTMLElement
        if (state.clickInterceptors.has(el)) return

        const interceptor = (e: Event) => this.handleThemeButtonClick(e, instanceId)
        state.clickInterceptors.set(el, interceptor)
        el.addEventListener('click', interceptor, true)
      })
    })

    // Also intercept form submit events
    this.interceptFormSubmits(parentElement, instanceId)
  }

  /**
   * Unblock theme buttons - restore on:click handlers and remove interceptors.
   * Call this when switching from modal mode to inline mode.
   */
  static unblockThemeButtons(instanceId: string = 'default'): void {
    const state = getInstanceState(instanceId)

    // Restore on:click attributes
    state.storedOnClickHandlers.forEach((value, el) => {
      if (el && el.isConnected) {
        el.setAttribute('on:click', value)
      }
    })
    state.storedOnClickHandlers.clear()

    // Remove click interceptors
    state.clickInterceptors.forEach((interceptor, el) => {
      if (el && el.isConnected) {
        el.removeEventListener('click', interceptor, true)
      }
    })
    state.clickInterceptors.clear()
  }

  // ==================== FORM SUBMISSION HANDLING ====================

  /**
   * Attach a submit handler that rewrites (or adds) the _ref_id input so that
   * every cart submission receives a brand-new unique id. This prevents
   * "Duplicate ref_id detected" errors when the shopper adds the same product
   * multiple times during a single page session.
   */
  private static attachRefIdGenerator(addToCartForm: HTMLFormElement, productName: string) {
    // Avoid attaching the listener multiple times
    if (addToCartForm.dataset.tlkRefIdHandlerAttached === 'true') return

    addToCartForm.dataset.tlkRefIdHandlerAttached = 'true'

    const handleValidationAndRefId = (event: Event) => {
      const validators = [
        FormManager.validateRequiredTextCustomers,
        FormManager.validateRequiredImageUploads,
        FormManager.validateConfirmationCheckbox,
      ]

      for (const validate of validators) {
        if (!validate()) {
          event.preventDefault()
          event.stopPropagation()
          event.stopImmediatePropagation()
          return
        }
      }

      // Add confirmation checkbox input if enabled and checked (must be done at submit time)
      FormManager.addConfirmationCheckboxInput(addToCartForm)

      // Generate a fresh id each submit
      const newRefId = generateUniqueId()

      // Find existing _ref_id input
      const refInput = addToCartForm.querySelector(
        `input[data-name="${PROPERTY_PREFIX}_ref_id"]`
      ) as HTMLInputElement | null

      if (!refInput) {
        // If for some reason it doesn't exist (e.g. removed by theme JS), recreate it
        FormManager.createInputElement(`${PROPERTY_PREFIX}_ref_id`, newRefId, addToCartForm)
      } else {
        refInput.value = newRefId
      }

      // Make sure basic product name & flag inputs still exist (hardening against theme manipulation)
      if (!addToCartForm.querySelector(`input[data-name="${PROPERTY_PREFIX}_product_name"]`)) {
        FormManager.createInputElement(`${PROPERTY_PREFIX}_product_name`, productName, addToCartForm)
      }
      if (!addToCartForm.querySelector(`input[data-name="${PROPERTY_PREFIX}"]`)) {
        FormManager.createInputElement(PROPERTY_PREFIX, PROPERTY_PREFIX, addToCartForm)
      }
    }

    // Attach submit listener in CAPTURE phase (runs early)
    addToCartForm.addEventListener('submit', handleValidationAndRefId, true)

    // Also intercept clicks on submit/add-to-cart buttons (capture phase) to prevent theme JS
    const submitButtons = addToCartForm.querySelectorAll(ATC_BUTTON_SELECTORS.join(','))
    submitButtons.forEach(btn => {
      const el = btn as HTMLElement & { dataset: any }
      if (el.dataset.tlkRequiredHandlerAttached) return
      el.dataset.tlkRequiredHandlerAttached = 'true'

      el.addEventListener(
        'click',
        event => {
          const validators = [
            FormManager.validateRequiredTextCustomers,
            FormManager.validateRequiredImageUploads,
            FormManager.validateConfirmationCheckbox,
          ]

          for (const validate of validators) {
            if (!validate()) {
              event.preventDefault()
              event.stopPropagation()
              event.stopImmediatePropagation()
              return
            }
          }
        },
        true // capture
      )
    })
  }
}
