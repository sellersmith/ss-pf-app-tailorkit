export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']

const IMAGE_EXTENSION_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

/**
 * Extracts and validates MIME type from a URL based on file extension
 * @param url - The URL to extract MIME type from
 * @returns The MIME type if valid, null otherwise
 */
export function getImageMimeTypeFromUrl(url: string): string | null {
  if (!url) return null
  const extensionMatch = url.toLowerCase().match(/\.(jpg|jpeg|png|webp)(?:\?|$)/i)
  if (!extensionMatch) return null
  const ext = `.${extensionMatch[1]}`
  return IMAGE_EXTENSION_TO_MIME[ext] || null
}
export const ALLOWED_PHOTO_SHOP_TYPES = ['image/vnd.adobe.photoshop', '.psd']

/**
 * @description
 * font/ttf, font/otf, font/woff, application/font-woff will check with type of file font
 * On Mac: file with extension .woff2 doesn't have file type so we have to use .woff2 instead
 * on Win: file with extension .ttf or .otf doesn't have file type so we have to use .ttf, .otf instead
 */
export const ALLOWED_FONT_TYPES = [
  'font/ttf',
  'font/otf',
  'font/woff',
  'application/font-woff',
  '.woff2',
  '.otf',
  '.ttf',
]
export const ALLOWED_FONT_EXTENSIONS = ['.otf', '.ttf', '.woff', '.woff2']
