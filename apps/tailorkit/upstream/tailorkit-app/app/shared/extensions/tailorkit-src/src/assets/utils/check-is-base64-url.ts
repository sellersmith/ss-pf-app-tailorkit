/**
 * Validates if a string is a valid base64 data URL for images
 * @param base64String - The base64 string to validate
 * @returns True if the string is a valid image data URL, false otherwise
 */
export const isValidBase64DataURL = (base64String: string): boolean => {
  if (!base64String || typeof base64String !== 'string' || base64String.trim() === '') {
    return false
  }

  // Check if it's a data URL format
  const dataURLRegex = /^data:image\/(png|jpg|jpeg|gif|webp|svg\+xml);base64,/i
  if (!dataURLRegex.test(base64String)) {
    return false
  }

  try {
    // Extract the base64 part (after the comma)
    const base64Part = base64String.split(',')[1]

    // Check if base64 part exists
    if (!base64Part) {
      return false
    }

    // Validate base64 format
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/
    if (!base64Regex.test(base64Part)) {
      return false
    }

    // Check if base64 length is valid (must be multiple of 4)
    if (base64Part.length % 4 !== 0) {
      return false
    }

    // Additional validation: try to decode to ensure it's valid base64
    // This will throw an error if the base64 is malformed
    atob(base64Part)

    return true
  } catch (error) {
    console.error('[TailorKit] Invalid base64 data URL:', error)
    return false
  }
}
