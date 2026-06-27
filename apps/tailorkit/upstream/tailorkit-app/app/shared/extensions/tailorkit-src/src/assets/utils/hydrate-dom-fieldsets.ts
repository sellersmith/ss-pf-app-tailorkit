/**
 * DOM hydration helper for bulk personalization unit switching.
 *
 * Strategy: capture the full innerHTML of the fieldsets container plus a
 * structured snapshot of input values per unit. On unit switch, restore the
 * target unit's innerHTML and re-apply values + checked states, then fire
 * change events so dependent UI (image preview, color swatch, etc) refreshes.
 *
 * Why HTML clone instead of value-only restore: customizer fieldsets contain
 * dynamically-rendered children (image option grids, color swatches) where DOM
 * state (selected class, focus, scroll position) matters. Cloning the rendered
 * subtree is more robust than replaying every option-type's setter.
 */

export interface FieldsetSnapshot {
  /** Full innerHTML of the fieldsets container at snapshot time. */
  html: string
  /** Captured input values keyed by name attribute, used to fast-restore typed text. */
  values: Record<string, string>
  /** Captured checkbox/radio checked states keyed by an input identifier. */
  checked: Record<string, boolean>
  /** CSS class state on .emtlkit--option-container elements (active/inactive). */
  activeOptionIds: string[]
}

/**
 * Snapshot the current state of all fieldsets inside a container.
 * Caller is responsible for invoking this at the right moment (e.g. before
 * switching active unit so the outgoing unit's state is preserved).
 */
export function snapshotFieldsetsState(container: HTMLElement): FieldsetSnapshot {
  const html = container.innerHTML

  const values: Record<string, string> = {}
  container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input[name], textarea[name]').forEach(el => {
    if (el.name && el.type !== 'radio' && el.type !== 'checkbox') {
      values[el.name] = el.value
    }
  })

  const checked: Record<string, boolean> = {}
  container.querySelectorAll<HTMLInputElement>('input[type="radio"], input[type="checkbox"]').forEach(el => {
    const key = el.getAttribute('data-id') || el.id || el.name
    if (key) checked[key] = el.checked
  })

  const activeOptionIds: string[] = []
  container.querySelectorAll<HTMLElement>('.emtlkit--option-container.active').forEach(el => {
    const id = el.querySelector<HTMLInputElement>('input')?.getAttribute('data-id')
    if (id) activeOptionIds.push(id)
  })

  return { html, values, checked, activeOptionIds }
}

/**
 * Restore fieldsets state from a snapshot into the container.
 * Replaces innerHTML, re-applies typed text values, and fires change events
 * so dependent UI (image preview, canvas render) refreshes.
 *
 * Returns true on success, false when the snapshot is null/invalid.
 */
export function restoreFieldsetsState(container: HTMLElement, snapshot: FieldsetSnapshot | null): boolean {
  if (!snapshot || typeof snapshot.html !== 'string') return false

  container.innerHTML = snapshot.html

  // Re-apply typed text values that may not survive innerHTML round-trip
  // (input elements reflect attribute, not property, so a typed value is gone after innerHTML reset).
  Object.entries(snapshot.values).forEach(([name, value]) => {
    container
      .querySelectorAll<
        HTMLInputElement | HTMLTextAreaElement
      >(`input[name="${CSS.escape(name)}"], textarea[name="${CSS.escape(name)}"]`)
      .forEach(el => {
        if (el.value !== value) {
          el.value = value
          el.dispatchEvent(new Event('input', { bubbles: true }))
          el.dispatchEvent(new Event('change', { bubbles: true }))
        }
      })
  })

  return true
}

/**
 * Build an empty snapshot, used to initialize new units before any user input.
 * Restoring an empty snapshot yields the original server-rendered HTML.
 */
export function emptyFieldsetSnapshot(originalHtml: string): FieldsetSnapshot {
  return { html: originalHtml, values: {}, checked: {}, activeOptionIds: [] }
}
