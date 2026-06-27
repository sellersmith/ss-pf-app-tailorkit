/**
 * Utility functions for image handling in integration modals
 */

/**
 * Extracts and truncates filename from image URL
 * @param url - The image URL
 * @param maxLength - Maximum length for the filename (default: 30)
 * @returns - Truncated filename with preserved extension
 */
export const getImageFileName = (url: string, maxLength: number = 30): string => {
  const segments = url.split('/')
  const fileName = segments[segments.length - 1] || 'image'

  if (fileName.length <= maxLength) {
    return fileName
  }

  // Find the file extension
  const lastDotIndex = fileName.lastIndexOf('.')
  const extension = lastDotIndex > -1 ? fileName.substring(lastDotIndex) : ''
  const nameWithoutExtension = lastDotIndex > -1 ? fileName.substring(0, lastDotIndex) : fileName

  // Calculate how much space we have for the name part
  const availableLength = maxLength - extension.length - 3 // 3 for "..."

  if (availableLength <= 0) {
    // If even with truncation we can't fit, just truncate the whole thing
    return `${fileName.substring(0, maxLength - 3)}...`
  }

  // Truncate the name part and add ellipsis
  const truncatedName = nameWithoutExtension.substring(0, availableLength)
  return `${truncatedName}...${extension}`
}
