/**
 * Platform-specific keyboard shortcut utilities
 * Returns appropriate modifier key labels based on the user's operating system
 */

/**
 * Check if the current platform is macOS
 */
export function isMacOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform)
}

/**
 * Get platform-specific modifier key labels
 * - Mac: "control" and "option"
 * - Windows/Linux: "Ctrl" and "Alt"
 */
export function getShortcutModifiers() {
  const mac = isMacOS()
  return {
    ctrl: mac ? 'control' : 'Ctrl',
    alt: mac ? 'option' : 'Alt',
    shift: 'shift',
  }
}

/**
 * Format a keyboard shortcut string with the correct platform modifier
 * @param key The key (e.g., 'A', 'E', 'Z')
 * @param modifier The modifier type ('ctrl', 'alt', 'shift')
 * @returns Formatted shortcut string (e.g., "option+E" on Mac, "Alt+E" on Windows)
 */
export function formatShortcut(key: string, modifier: 'ctrl' | 'alt' | 'shift'): string {
  const mods = getShortcutModifiers()
  return `${mods[modifier]}+${key}`
}

/**
 * Format a keyboard shortcut with multiple modifiers
 * @param key The key (e.g., 'Z')
 * @param modifiers Array of modifier types
 * @returns Formatted shortcut string (e.g., "Ctrl+shift+Z")
 */
export function formatShortcutMulti(key: string, modifiers: Array<'ctrl' | 'alt' | 'shift'>): string {
  const mods = getShortcutModifiers()
  const modifierLabels = modifiers.map(m => mods[m])
  return `${modifierLabels.join('+')}+${key}`
}
