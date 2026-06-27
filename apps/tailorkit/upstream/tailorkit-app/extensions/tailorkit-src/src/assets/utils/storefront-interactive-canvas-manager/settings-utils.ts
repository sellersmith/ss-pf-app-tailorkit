/**
 * Reads the undoRedo setting from the customizer web component's data-app-settings attribute.
 * Returns false if the setting is absent, malformed, or disabled.
 */
export function readUndoRedoSetting(): boolean {
  try {
    const customizer = document.querySelector('tailorkit-product-personalizer-customizer')
    const raw = customizer?.getAttribute('data-app-settings')
    if (raw) return JSON.parse(raw).undoRedo === true
  } catch {
    // Fallback to disabled
  }
  return false
}
