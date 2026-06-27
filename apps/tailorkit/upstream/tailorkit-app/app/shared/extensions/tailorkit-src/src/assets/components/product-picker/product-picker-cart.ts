/**
 * Product Picker Cart Integration
 *
 * Builds Shopify `items[]` payload for multi-product ATC (Add to Cart).
 * Each selected product becomes an additional cart item linked to the base
 * product via shared `_TLK_ref_id`.
 *
 * Follows the OneTick items[] pattern:
 *   items[idx][id], items[idx][quantity], items[idx][properties][key]
 */

import type { ProductPickerStateManager, SlotAssignment } from './product-picker-state'
import { PROPERTY_PREFIX } from '../../constants'

// ─── Types ──────────────────────────────────────────────────────────

export interface ProductPickerCartItem {
  id: string
  quantity: number
  properties: Record<string, string>
}

// ─── Build Cart Items ───────────────────────────────────────────────

/**
 * Build an array of cart items from the current product picker selection.
 * Each selected product becomes a separate cart item with hidden properties.
 */
export function buildProductPickerCartItems(
  stateManager: ProductPickerStateManager,
  refId: string,
  baseProductName: string
): ProductPickerCartItem[] {
  const assignments = stateManager.getSlotAssignments()
  if (assignments.length === 0) return []

  return assignments.map((assignment: SlotAssignment) => ({
    id: assignment.product.vid,
    quantity: assignment.quantity,
    properties: {
      [`${PROPERTY_PREFIX}_ref_id`]: refId,
      [`${PROPERTY_PREFIX}_hidden`]: 'true',
      [`${PROPERTY_PREFIX}_type`]: 'product-picker-item',
      [`${PROPERTY_PREFIX}_qty_per_unit`]: String(assignment.quantity),
      'For Product': baseProductName,
    },
  }))
}

// ─── Inject into ATC Form ───────────────────────────────────────────

/**
 * Inject product picker items as hidden inputs into an ATC form.
 * Creates `items[idx][id]`, `items[idx][quantity]`, and
 * `items[idx][properties][key]` hidden inputs.
 */
export function injectProductPickerItemsIntoForm(
  form: HTMLFormElement,
  items: ProductPickerCartItem[]
): void {
  // Remove previously injected product picker inputs
  form.querySelectorAll('input[data-product-picker-item]').forEach(el => el.remove())

  items.forEach((item, idx) => {
    appendHiddenInput(form, `items[${idx}][id]`, item.id, idx)
    appendHiddenInput(form, `items[${idx}][quantity]`, String(item.quantity), idx)

    for (const [key, value] of Object.entries(item.properties)) {
      appendHiddenInput(form, `items[${idx}][properties][${key}]`, value, idx)
    }
  })
}

/**
 * Remove all previously injected product picker inputs from a form.
 */
export function clearProductPickerItemsFromForm(form: HTMLFormElement): void {
  form.querySelectorAll('input[data-product-picker-item]').forEach(el => el.remove())
}

// ─── Validation ─────────────────────────────────────────────────────

/**
 * Validate that the product picker selection meets the min/max rules.
 * Returns `{ isValid: true }` or `{ isValid: false, reason: string }`.
 */
export function validateProductPickerSelection(
  stateManager: ProductPickerStateManager
): { isValid: boolean; reason?: string } {
  const state = stateManager.getState()
  const count = stateManager.getSelectionCount()
  const { required, min, max } = state.selectionRules

  if (required && count === 0) {
    return { isValid: false, reason: 'Product selection is required' }
  }

  if (min > 0 && count < min) {
    return { isValid: false, reason: `Select at least ${min} product${min > 1 ? 's' : ''}` }
  }

  if (max > 0 && count > max) {
    return { isValid: false, reason: `Select at most ${max} product${max > 1 ? 's' : ''}` }
  }

  return { isValid: true }
}

// ─── Helpers ────────────────────────────────────────────────────────

function appendHiddenInput(form: HTMLFormElement, name: string, value: string, idx: number): void {
  const input = document.createElement('input')
  input.type = 'hidden'
  input.name = name
  input.value = value
  input.setAttribute('data-product-picker-item', String(idx))
  form.appendChild(input)
}
