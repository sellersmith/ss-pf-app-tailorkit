/**
 * Generate a unique ID for the current session
 * @returns A unique ID
 */
export const generateUniqueId = () => {
  // Use crypto.randomUUID if available, otherwise fallback to a custom UUID generator
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  // Fallback UUID v4 generator for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
