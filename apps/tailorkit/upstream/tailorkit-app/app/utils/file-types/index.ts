export function _arrayBufferToBase64(buffer: any) {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}

/**
 * Convert Uint8Array to base64 string in chunks to avoid call stack size exceeded
 * @param uint8Array The Uint8Array to convert
 * @returns base64 string
 */
export const uint8ArrayToBase64 = (uint8Array: Uint8Array): string => {
  const chunkSize = 8192 // Process 8KB chunks
  let result = ''

  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.slice(i, i + chunkSize)
    result += String.fromCharCode.apply(null, chunk as unknown as number[])
  }

  return btoa(result)
}

/**
 * Convert base64 string to Uint8Array in chunks
 * @param base64 The base64 string to convert
 * @returns Uint8Array
 */
export const base64ToUint8Array = (base64: string): Uint8Array => {
  const binaryString = atob(base64)
  const length = binaryString.length
  const bytes = new Uint8Array(length)

  for (let i = 0; i < length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }

  return bytes
}

export async function imageFileToBase64(file: File): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      resolve(reader.result as string | null) // Base64 string without the data URI prefix
    }

    reader.onerror = error => reject(error)

    reader.readAsDataURL(file)
  })
}

export function base64ToBlob(base64: string, contentType: 'image/jpeg' | 'image/webp' | 'image/png' = 'image/jpeg') {
  const byteCharacters = atob(base64)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  return new Blob([byteArray], { type: contentType })
}

export function blobToBase64(blob: Blob | null): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()!

    if (!blob) {
      reject('Invalid blob file')
      return
    }

    // When FileReader finishes reading, the result is the base64 string
    reader.onloadend = () => {
      const base64String = reader.result as string
      resolve(base64String)
    }

    reader.onerror = reject

    // Read the Blob as DataURL (this will convert it to base64)
    reader.readAsDataURL(blob)
  })
}

export function dataURLtoFile(dataUrl: string, filename: string) {
  const arr = dataUrl.split(','),
    mime = arr[0].match(/:(.*?);/)?.[1],
    bstr = atob(arr[arr.length - 1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)

  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new File([u8arr], sanitizeFileName(filename), { type: mime })
}

export async function readFileFromURL(fileURL: string) {
  try {
    const response = await fetch(fileURL)
    if (!response.ok) {
      throw new Error('Network response was not ok')
    }
    const blob = await response.blob()

    // Return a promise that resolves when the FileReader reads the blob
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = function (event) {
        resolve(event.target?.result)
      }

      reader.onerror = function (error) {
        reject(`Error reading file: ${error}`)
      }

      reader.readAsText(blob)
    })
  } catch (error) {
    console.error('Error reading file from URL:', error)
    throw error // Re-throw the error to handle it in the calling function
  }
}

type UnitSize = 'kb' | 'mb' | 'gb' | 'bytes'

export function getSizeInUnit(size: number, unit: UnitSize) {
  const _unit = unit.toUpperCase()
  switch (_unit) {
    case 'KB':
      return `${(size / 1024).toFixed(2)} ${_unit}`
    case 'MB':
      return `${(size / (1024 * 1024)).toFixed(2)} ${_unit}`
    case 'GB':
      return `${(size / (1024 * 1024 * 1024)).toFixed(2)} ${_unit}`
    case 'BYTES':
      return `${size} Bytes`
    default:
      throw new Error('Unsupported unit. Please use "Bytes", "KB", "MB", or "GB".')
  }
}

/**
 * Convert a Blob to a File
 * @param blob - The Blob to convert
 * @param filename - The name of the file
 * @returns A File object
 */
export function convertBlobToFile(blob: Blob, filename: string) {
  return new File([blob], filename, { type: blob.type || 'image/png' })
}

/**
 * Convert a File to a Blob
 * @param file - The File to convert
 * @returns A Blob object
 */
export function convertFileToBlob(file: File) {
  return new Blob([file], { type: file.type })
}

/**
 * Convert a Blob to a Data URL
 * @param blob - The Blob to convert
 * @returns A Data URL
 */
export function convertBlobToDataUrl(blob: Blob) {
  return URL.createObjectURL(blob)
}

/**
 * Convert a File to a Data URL
 * @param file - The File to convert
 * @returns A Data URL
 */
export function convertFileToDataUrl(file: File) {
  const blob = convertFileToBlob(file)
  return convertBlobToDataUrl(blob)
}

/**
 * Fetches a file from a given URL and converts it to a File object.
 *
 * @param {string} url - The URL of the resource to fetch.
 * @param {string} filename - The name to assign to the resulting File object.
 * @returns {Promise<File | null>} A promise that resolves to a File object if successful, or null if an error occurs.
 */
export async function proxyImageUrlToFile(url: string, filename: string): Promise<File | null> {
  try {
    const fileObject = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`)

    const blobFile = await fileObject.blob()
    const file = convertBlobToFile(blobFile, filename || 'image-generation')

    return file
  } catch (e) {
    return null
  }
}

/**
 * Sanitizes a file name by:
 * - Replacing special characters with underscores
 * - Removing leading underscores
 * - Replacing multiple consecutive underscores with a single underscore
 * - Preserves trailing underscore if it resulted from special character replacement
 * - Removes explicit trailing underscores from original filename
 *
 * @param fileName - The original file name to sanitize
 * @returns The sanitized file name
 */
export function sanitizeFileName(fileName: string): string {
  if (!fileName) return ''

  // First remove any explicit trailing underscores from the original filename
  const withoutTrailingUnderscores = fileName.replace(/_+(?=\.[^.]*$|$)/, '')

  return (
    withoutTrailingUnderscores
      // Replace special characters with underscores
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      // Replace multiple consecutive underscores with a single underscore
      .replace(/_+/g, '_')
      // Remove leading underscores
      .replace(/^_+/, '')
  )
}

/**
 * Checks if a given URL is an image URL by fetching the URL and checking the content type.
 *
 * @param url - The URL to check
 * @returns {Promise<boolean>} - A promise that resolves to true if the URL is an image, false otherwise
 */
export async function isImageUrl(url: string) {
  try {
    const response = await fetch(url, { method: 'HEAD' })
    const contentType = response.headers.get('content-type')
    return contentType && contentType.startsWith('image/')
  } catch (error) {
    return false
  }
}

/**
 * Removes the file extension from a given file name.
 *
 * @param fileName - The name of the file from which to remove the extension.
 * @returns The file name without the extension.
 */
export function getFileNameWithoutExtension(fileName: string) {
  return fileName.replace(/\.[a-zA-Z0-9]{1,4}$/, '')
}

/**
 * Retrieves the file extension from a given file name.
 *
 * @param fileName - The name of the file from which to extract the extension.
 * @returns The file extension, or an empty string if no extension is found.
 */
export function getFileExtension(fileName: string) {
  const parts = fileName.split('.')
  return parts.length > 1 ? parts.pop()! : ''
}

export function resizeDataUrlImage(dataUrl: string, width: number, height: number) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.src = dataUrl

    img.onload = () => {
      const ratio = img.width / img.height
      const canvas = document.createElement('canvas')
      canvas.width = ratio > 1 ? width : width * ratio
      canvas.height = ratio < 1 ? height : height / ratio
      const ctx = canvas.getContext('2d')

      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height)

        resolve(canvas.toDataURL())
      } else {
        reject(new Error('Failed to get canvas context'))
      }
    }
  })
}

/**
 * Checks if an image URL represents an SVG/vector image
 */
export function isSvgImage(url: string | undefined): boolean {
  if (!url) return false

  // Check for SVG data URI
  if (url.startsWith('data:image/svg+xml')) {
    return true
  }

  // Check for SVG file extension in URL (handle query params)
  const urlWithoutQuery = url.toLowerCase().split('?')[0]
  return urlWithoutQuery.endsWith('.svg')
}

// Supported image MIME types for clipboard paste
const SUPPORTED_CLIPBOARD_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

/**
 * Reads an image blob from the clipboard using the Async Clipboard API
 * @returns The image blob if found, null otherwise
 */
export async function readImageFromClipboard(): Promise<Blob | null> {
  try {
    // Check if clipboard API is available
    if (!navigator.clipboard?.read) {
      return null
    }

    const clipboardItems = await navigator.clipboard.read()

    for (const item of clipboardItems) {
      for (const type of item.types) {
        if (SUPPORTED_CLIPBOARD_IMAGE_TYPES.includes(type)) {
          const blob = await item.getType(type)
          return blob
        }
      }
    }

    return null
  } catch (error) {
    // Permission denied or no image in clipboard
    // Return null to allow fallback to text paste
    console.debug('Clipboard image read failed:', error)
    return null
  }
}

export interface ImageFromBlob {
  width: number
  height: number
  dataUrl: string
}

/**
 * Creates image metadata from a blob by loading it into an Image element
 * @param blob The image blob to process
 * @returns Object containing width, height, and data URL of the image
 */
export async function createImageFromBlob(blob: Blob): Promise<ImageFromBlob> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob)

    const img = new Image()

    img.onload = () => {
      // Convert to data URL for immediate display
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(objectUrl)
        reject(new Error('Failed to get canvas context'))
        return
      }

      ctx.drawImage(img, 0, 0)

      // Use PNG format for best quality
      const dataUrl = canvas.toDataURL('image/png')

      // Clean up object URL to prevent memory leaks
      URL.revokeObjectURL(objectUrl)

      resolve({
        width: img.width,
        height: img.height,
        dataUrl,
      })
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to load image from clipboard'))
    }

    img.src = objectUrl
  })
}
