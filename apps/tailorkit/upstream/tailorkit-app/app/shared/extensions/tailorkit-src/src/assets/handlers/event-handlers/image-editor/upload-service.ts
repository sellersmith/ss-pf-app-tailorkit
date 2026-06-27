import { APP_PROXY_PATH } from '../../../constants'
import { STORE_FRONT_ACTION } from '../../../constants/app-actions'
import EmtlkitModal from '../../../components/commons/modal'
import { MODAL_SIZES } from '../../../components/commons/modal/constants'
import { Transmitter } from '../../../libraries/transmitter'
import { fetchWithAdminContext } from '../../../libraries/fetchWithAdminContext'

/**
 * Error modal configuration
 */
interface ErrorModalOptions {
  title: string
  message: string
  onRetry?: () => void
}

/**
 * Image upload result
 */
export interface ImageUploadResult {
  success: boolean
  url?: string
  error?: string
}

/**
 * Show an error modal with retry option
 */
export function showErrorModal(options: ErrorModalOptions): void {
  const { title, message, onRetry } = options

  const modal = new EmtlkitModal({
    header: title,
    content: message,
    size: MODAL_SIZES.SMALL,
    footer: `
      <div class="emtlkit--d-flex" style="justify-content: flex-end; gap: 8px; width: 100%;">
        <button class="emtlkit-button emtlkit-button-modal emtlkit-button--secondary error-modal-cancel">Cancel</button>
        ${onRetry ? '<button class="emtlkit-button emtlkit-button-modal emtlkit-button--primary error-modal-retry">Try Again</button>' : ''}
      </div>
    `,
    closeOnBackdropClick: true,
    closeOnEsc: true,
  })

  modal.open()

  // Add event listeners to buttons
  setTimeout(() => {
    const cancelButton = document.querySelector('.error-modal-cancel')
    const retryButton = document.querySelector('.error-modal-retry')

    if (cancelButton) {
      cancelButton.addEventListener('click', () => {
        modal.close()
      })
    }

    if (retryButton && onRetry) {
      retryButton.addEventListener('click', () => {
        modal.close()
        // Retry upload after a small delay to allow modal to close
        setTimeout(onRetry, 100)
      })
    }
  }, 100)
}

export const MAX_IMAGE_SIZE = 25 * 1024 * 1024
export const MAX_AI_REFERENCE_IMAGE_SIZE = 15 * 1024 * 1024

/**
 * Validate an image file for format and size
 * Note: Resolution validation removed - server will auto-resize large images
 * @param file - The file to validate
 * @param options - Optional configuration for validation
 * @param options.maxSize - Maximum file size in bytes (defaults to MAX_IMAGE_SIZE)
 */
export function validateImageFile(
  file: File,
  options?: { maxSize?: number }
): { valid: boolean; errorMessage?: string } {
  const maxSize = options?.maxSize ?? MAX_IMAGE_SIZE
  const maxSizeMB = Math.round(maxSize / (1024 * 1024))

  // Validation messages
  const errorMessages = {
    format: 'Only .png, .jpg, or .webp files are allowed.',
    size: `File size must not exceed ${maxSizeMB}MB.`,
  }

  // 1. Validate file format
  const validFormats = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
  if (!validFormats.includes(file.type)) {
    return { valid: false, errorMessage: errorMessages.format }
  }

  // 2. Validate file size
  if (file.size > maxSize) {
    return { valid: false, errorMessage: errorMessages.size }
  }

  // 3. Resolution validation removed - server will handle auto-resizing
  // This allows users to upload high-resolution images without restrictions
  // Server will automatically resize images > 8000px on longest side

  // All validations passed
  return { valid: true }
}

/**
 * Validate an AI reference image file (15MB limit)
 */
export function validateAIReferenceImage(file: File): { valid: boolean; errorMessage?: string } {
  return validateImageFile(file, { maxSize: MAX_AI_REFERENCE_IMAGE_SIZE })
}

/**
 * Convert a URL to a File object using the proxy service to avoid CORS issues
 * This function fetches the image through our backend proxy to bypass CORS restrictions
 * when external servers don't allow cross-origin requests.
 */
export async function urlToFile(url: string, filename: string): Promise<File> {
  try {
    // For same-origin or data URLs, fetch directly
    if (url.startsWith('blob:') || url.startsWith('data:')) {
      const response = await fetchWithAdminContext(url)

      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`)
      }

      const blob = await response.blob()
      return new File([blob], filename, { type: blob.type || 'image/png' })
    }

    // For external URLs, use the proxy service to avoid CORS issues
    const proxyUrl = `${APP_PROXY_PATH}/app_proxy/storefront`
    const formData = new FormData()
    formData.append('action', STORE_FRONT_ACTION.PROXY_IMAGE)
    formData.append('imageUrl', url)

    const response = await fetchWithAdminContext(proxyUrl, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      // Provide more specific error messaging based on status
      let errorMessage = `Failed to fetch image through proxy: ${response.status}`

      if (response.status === 400) {
        errorMessage = 'Invalid image URL provided'
      } else if (response.status === 500) {
        errorMessage = 'Failed to fetch image from external source.'
      } else if (response.status === 401 || response.status === 403) {
        errorMessage = 'Access denied. Please ensure you are logged in and have permission to access this resource.'
      }

      throw new Error(errorMessage)
    }

    const blob = await response.blob()

    // Validate that we received a valid image
    if (!blob.type.startsWith('image/')) {
      throw new Error('The fetched content is not a valid image format.')
    }

    return new File([blob], filename, { type: blob.type || 'image/png' })
  } catch (error) {
    console.error('Error converting URL to file:', error)

    // Enhance error messaging for better user experience
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Network error: Unable to fetch the image. Please check your internet connection and try again.')
    }

    throw error
  }
}

/**
 * Upload an image file to the server
 */
export async function uploadImageToServer(file: File, trackingFeature = true): Promise<ImageUploadResult> {
  const formData = new FormData()
  formData.append('action', STORE_FRONT_ACTION.UPLOAD_IMAGE)
  formData.append('files', file)

  try {
    const url = `${APP_PROXY_PATH}/app_proxy/storefront`

    // Wrap fetch in additional error handling for network failures
    let response: Response
    try {
      response = await fetchWithAdminContext(url, {
        method: 'POST',
        body: formData,
      })
    } catch (networkError) {
      console.error('Network error during upload:', networkError)
      throw new Error('Network error: Please check your internet connection and try again.')
    }

    // Handle response normally since we're not using no-cors mode
    if (!response.ok) {
      let errorMessage = `Upload failed with status ${response.status}`
      try {
        const errorData = await response.json()
        errorMessage += `: ${errorData.message || 'Server error'}`
      } catch (parseError) {
        console.error('Failed to parse error response:', parseError)
        errorMessage += ': Unable to parse server error response'
      }
      throw new Error(errorMessage)
    }

    let result: any
    try {
      result = await response.json()
    } catch (jsonError) {
      console.error('Failed to parse response JSON:', jsonError)
      throw new Error('Server returned invalid response format.')
    }

    if (!result.success || !result.data || !result.data.uploadedFiles || result.data.uploadedFiles.length === 0) {
      throw new Error('Upload request succeeded but did not return valid file data.')
    }

    const uploadedFiles = result.data.uploadedFiles
    const uploadedImageUrl = uploadedFiles[0]?.image?.originalSrc

    if (!uploadedImageUrl) {
      console.error('Uploaded image URL not found in response:', uploadedFiles[0])
      throw new Error('Uploaded image URL not found in the server response.')
    }

    if (trackingFeature) {
      Transmitter.trigger('tailorkit-storefront-usage', { feature: 'UPLOAD_IMAGE' })
    }

    return {
      success: true,
      url: uploadedImageUrl,
    }
  } catch (error) {
    console.error('Upload error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Upload an image file to the server with error modal handling
 * This wrapper prevents uncaught promise rejections and shows user-friendly error messages
 */
export async function uploadImageWithErrorHandling(
  file: File,
  options?: {
    onSuccess?: (url: string) => void
    onError?: (error: string) => void
    showRetryModal?: boolean
  }
): Promise<ImageUploadResult> {
  const { onSuccess, onError, showRetryModal = true } = options || {}

  try {
    // Validate file first
    const validation = await validateImageFile(file)
    if (!validation.valid) {
      const errorMessage = validation.errorMessage || 'Invalid image file'

      if (showRetryModal) {
        showErrorModal({
          title: 'Invalid Image',
          message: errorMessage,
        })
      }

      onError?.(errorMessage)
      return { success: false, error: errorMessage }
    }

    // Attempt upload
    const result = await uploadImageToServer(file)

    if (result.success && result.url) {
      onSuccess?.(result.url)
      return result
    }

    const errorMessage = result.error || 'Upload failed for unknown reason'

    if (showRetryModal) {
      showErrorModal({
        title: 'Upload Failed',
        message: errorMessage,
        onRetry: () => {
          // Retry the upload
          uploadImageWithErrorHandling(file, options).catch(retryError => {
            console.error('Retry upload failed:', retryError)
          })
        },
      })
    }

    onError?.(errorMessage)
    return result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
    console.error('Unexpected error in uploadImageWithErrorHandling:', error)

    if (showRetryModal) {
      showErrorModal({
        title: 'Upload Error',
        message: errorMessage,
        onRetry: () => {
          // Retry the upload
          uploadImageWithErrorHandling(file, options).catch(retryError => {
            console.error('Retry upload failed:', retryError)
          })
        },
      })
    }

    onError?.(errorMessage)
    return { success: false, error: errorMessage }
  }
}

/**
 * Create a file input element for image selection
 */
export function createImageFileInput(onFileSelected: (file: File) => void, onCancel?: () => void): void {
  const fileInput = document.createElement('input')
  fileInput.type = 'file'
  fileInput.accept = '.png,.jpg,.jpeg,.webp'
  fileInput.style.display = 'none'

  // Helper to clean up element safely
  const cleanup = () => {
    if (fileInput.parentNode) {
      fileInput.parentNode.removeChild(fileInput)
    }
  }

  fileInput.addEventListener('change', e => {
    const files = (e.target as HTMLInputElement).files
    if (!files || files.length === 0) {
      cleanup()
      return
    }

    onFileSelected(files[0])

    // Give the browser a moment before removing (esp. Safari/iOS)
    setTimeout(cleanup, 0)
  })

  // Handle cancel event (when user cancels the file picker)
  fileInput.addEventListener('cancel', () => {
    onCancel?.()
    cleanup()
  })

  // Fallback: detect when dialog closes without selection using focus events
  const handleFocus = () => {
    // Small delay to allow change event to fire first if file was selected
    setTimeout(() => {
      if (fileInput.parentNode) {
        onCancel?.()
        cleanup()
      }
    }, 300)
  }

  window.addEventListener('focus', handleFocus, { once: true })

  // Append first, then trigger click in next frame to ensure element is truly in the DOM
  document.body.appendChild(fileInput)
  requestAnimationFrame(() => fileInput.click())
}
