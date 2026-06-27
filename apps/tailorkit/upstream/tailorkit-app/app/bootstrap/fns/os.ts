/**
 * Returns true if the user is on a Mac
 * @returns {boolean}
 */
export function isMacOS(): boolean {
  return typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac')
}
