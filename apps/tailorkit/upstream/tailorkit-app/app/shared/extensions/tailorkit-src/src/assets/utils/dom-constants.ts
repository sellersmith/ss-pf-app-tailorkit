// Central DOM constants for classes and data-role hooks

// Classes (keep in sync with styles)
export const CLASS_TEXTFIELD_INPUT = 'emtlkit-textfield__input'
export const CLASS_TEXTFIELD_COUNTER = 'emtlkit-textfield__character-count'

/** CSS class applied to TailorKit inputs in add-to-cart forms */
export const CLASS_TAILORKIT_INPUT = 'emtlkit--input'

/** CSS class applied to TailorKit tracking inputs */
export const CLASS_TAILORKIT_TRACKING = 'emtlkit--tracking'

/**
 * Class to exclude inputs from triggering canvas re-render.
 * Add this class to a container to prevent its child inputs from triggering text input handlers.
 */
export const CLASS_EXCLUDE_INPUT_HANDLER = 'emtlkit--exclude-input-handler'

// Stable data-role hooks (preferred for JS)
export const ROLE_TEXT_INPUT = 'tlk-text-input'
export const ROLE_TEXT_COUNTER = 'tlk-text-counter'
