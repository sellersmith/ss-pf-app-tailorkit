// Centralized selectors to avoid duplication and missed cases
import { CLASS_TEXTFIELD_INPUT, ROLE_TEXT_COUNTER, ROLE_TEXT_INPUT } from './dom-constants'

// Matches customer text input across legacy HTML, textarea, and the new web component's inner input
// Prefer stable data-role first to avoid breakage on class changes
// eslint-disable-next-line max-len
export const TEXT_CUSTOMER_INPUT_SELECTOR = `input[data-role="${ROLE_TEXT_INPUT}"], .emtlkit--text-input input[type="text"], .emtlkit--text-input textarea, .${CLASS_TEXTFIELD_INPUT}`

// Layer-scoped selector for a specific fieldset/layer id
export const getLayerTextCustomerInputSelector = (layerId: string): string =>
  `fieldset[data-layer-id="${layerId}"] ${TEXT_CUSTOMER_INPUT_SELECTOR}`

// Character counter element selector (covers both implementations)
export const FIELDSET_TEXT_COUNTER_SELECTOR = `[data-role="${ROLE_TEXT_COUNTER}"], .emtlkit-textfield__character-count, .character-count`
