/**
 * Shared DOM utility helpers.
 * Kept dependency-free so test environments and Web Components both reuse them.
 */

/**
 * Escape HTML special characters before interpolating untrusted content into innerHTML.
 * Use whenever a user-controlled string lands inside an HTML template literal that is
 * subsequently assigned to `el.innerHTML`. Renders < > & " ' as their entity references.
 */
export function escapeHtml(input: unknown): string {
  return String(input ?? '').replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  )
}

/**
 * Generate a UUID v4 when crypto.randomUUID is available, fall back to a low-entropy
 * pseudo-random string otherwise. Used for grouping bulk line items and other
 * non-cryptographic identifiers (NOT suitable for security tokens).
 */
export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}
