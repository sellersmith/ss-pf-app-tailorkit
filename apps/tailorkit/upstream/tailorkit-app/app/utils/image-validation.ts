/**
 * SSR-safe image validator. Mirrors the rules in
 * extensions/tailorkit-src/.../upload-service.ts but with zero browser/Polaris
 * deps so both server actions and client UI can share the same gate.
 *
 * Resolution checks are intentionally absent — the server auto-resizes
 * oversized images upstream of upload.
 */

export const MAX_IMAGE_SIZE = 25 * 1024 * 1024
export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'] as const

export interface ImageValidationResult {
  valid: boolean
  errorMessage?: string
}

export function validateImageFile(file: File, options?: { maxSize?: number }): ImageValidationResult {
  const maxSize = options?.maxSize ?? MAX_IMAGE_SIZE
  const maxSizeMB = Math.round(maxSize / (1024 * 1024))

  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return { valid: false, errorMessage: 'Only .png, .jpg, or .webp files are allowed.' }
  }
  if (file.size > maxSize) {
    return { valid: false, errorMessage: `File size must not exceed ${maxSizeMB}MB.` }
  }
  return { valid: true }
}
