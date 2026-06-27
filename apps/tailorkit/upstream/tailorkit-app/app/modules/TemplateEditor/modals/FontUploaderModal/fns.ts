import { ALLOWED_FONT_TYPES, ALLOWED_FONT_EXTENSIONS } from '~/constants/dropzone'
import type { InvalidFileError } from '.'
import { isSmallerThanMaxContentFile } from '~/utils/file-types/validate-media-file-size'
import { chunkArray } from '~/utils/chunkArray'
import type { useUploadFiles } from '../../hooks/useUploadFiles'

interface FontFileValidation {
  isValidExtension: boolean
  isValidType: boolean
}

const VALIDATION_MESSAGES = {
  TYPE: 'type',
  SIZE: 'size',
} as const

/**
 * Checks if a file name has a valid font extension
 * @param fileName - The name of the file to check
 * @returns boolean indicating if the extension is valid
 */
const hasValidFontExtension = (fileName: string): boolean => {
  if (!fileName.includes('.') || fileName.startsWith('.') || fileName.endsWith('.')) {
    return false
  }

  const extension = fileName.split('.').pop()
  return Boolean(extension && ALLOWED_FONT_EXTENSIONS.includes(`.${extension}`))
}

/**
 * Validates if the file type is an allowed font type
 * @param file - The file to validate
 * @returns FontFileValidation object with validation results
 */
const validateFontType = (file: File): FontFileValidation => {
  const isWoff2 = file.name.endsWith('.woff2')
  const isTtf = file.name.endsWith('.ttf')
  const isOtf = file.name.endsWith('.otf')

  const isValidType = ALLOWED_FONT_TYPES.includes(file.type) || isWoff2 || isTtf || isOtf
  const isValidExtension = hasValidFontExtension(file.name)

  return { isValidExtension, isValidType }
}

/**
 * Process file upload
 * @param files - The files to upload
 * @param uploadFn - The upload function
 * @param onProgress - The progress callback
 * @param onError - The error callback
 * @returns {Promise<{success: boolean, uploadedFiles: any[], errorFiles?: InvalidFileError[]}>}
 * - Upload result with successful files and any error files
 */
export async function processFileUpload(
  files: File[],
  uploadFn: ReturnType<typeof useUploadFiles>['uploadFiles'],
  onProgress: (count: number) => void,
  onError: (message: string, errors?: InvalidFileError[]) => void,
  options?: {
    fileUploadType?: string
  }
) {
  const { fileUploadType } = options || {}

  // The chunk size range is from 10 to 25
  const chunkSize = Math.min(25, Math.max(10, Math.floor(files.length / 3)))

  const chunkedFiles = chunkArray(files, chunkSize)
  let fileUploaded = 0
  const allUploadedFiles: any[] = []
  const allErrorFiles: InvalidFileError[] = []

  for (const chunk of chunkedFiles) {
    const [response] = await uploadFn(chunk, fileUploadType)

    if (!response.success) {
      onError(response.message, response.data.errors)
      if (response.data?.errors) {
        allErrorFiles.push(...response.data.errors)
      }
      // Continue with next chunk instead of returning early
      continue
    }

    // Check if response has data property and if it has uploadedFiles property
    if (response.data && Array.isArray(response.data.uploadedFiles)) {
      fileUploaded += response.data.uploadedFiles.length
      allUploadedFiles.push(...response.data.uploadedFiles)
      onProgress(fileUploaded)
    } else {
      // Fallback to chunk length if response format is different
      fileUploaded += chunk.length
      onProgress(fileUploaded)
    }

    // Check for errors but don't stop the process
    const errorFiles = response.data?.errorFiles || []
    if (errorFiles.length > 0) {
      onError('invalid-font-files', errorFiles)
      allErrorFiles.push(...errorFiles)
    }
  }

  // Return success if we have any uploaded files, along with any error files
  return {
    success: allUploadedFiles.length > 0,
    uploadedFiles: allUploadedFiles,
    errorFiles: allErrorFiles.length > 0 ? allErrorFiles : undefined,
  }
}

/**
 * Validates an array of files for font uploading
 * Checks file type, extension, and size
 * @param files - Array of files to validate
 * @returns Array of InvalidFileError for files that fail validation
 */
export const validateFiles = (files: File[]): InvalidFileError[] => {
  return files
    .map(file => {
      const { isValidExtension, isValidType } = validateFontType(file)

      if (!isValidType || !isValidExtension) {
        return { name: file.name, reason: VALIDATION_MESSAGES.TYPE }
      }

      if (!isSmallerThanMaxContentFile(file.size)) {
        return { name: file.name, reason: VALIDATION_MESSAGES.SIZE }
      }

      return null
    })
    .filter((error): error is InvalidFileError => error !== null)
}
