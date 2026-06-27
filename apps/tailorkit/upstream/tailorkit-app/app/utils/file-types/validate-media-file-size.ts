import { EMediaErrors } from '~/constants/errors'
import type { ErrorFile } from '~/types/media'
import { convertBlobToDataUrl } from '.'

export const MAX_CONTE_FILE_RESOLUTION = 25 * 1e6 // 25 MP in pixels
export const MAX_CONTENT_FILE_SIZE = 20 * 1e6 // 20 MB

export function isSmallerThanMaxContentFile(fileSize: number, maxFileSize = MAX_CONTENT_FILE_SIZE) {
  return fileSize < maxFileSize
}

export function isSmallerThanMaxContentFileResolution(
  width: number,
  height: number,
  maxResolution = MAX_CONTE_FILE_RESOLUTION
) {
  return width * height < maxResolution
}

/**
 * @description Check media files are valid before uploading file
 * @param files
 * @returns
 */
export async function validateMediaFiles(files: File[]) {
  const results: { file: File; blobFile: string; isValid: boolean; width: number; height: number }[] = []
  // Loop through chunk files
  for (const file of files) {
    const blobFile = convertBlobToDataUrl(file)
    const validation = await getImageValidation(file, blobFile, false)
    results.push({
      file,
      blobFile,
      isValid: validation.valid,
      width: validation.width,
      height: validation.height,
    })
  }

  const acceptedFiles = results.filter(result => result.isValid)
  const rejectedFiles = results
    .filter(result => !result.isValid)
    .map(result => ({ ...result.file, error: EMediaErrors.FILE_RESOLUTION_ERROR }) as ErrorFile)

  return {
    acceptedFiles,
    rejectedFiles,
  }
}

/**
 * Validates a media file and returns validity + dimensions.
 * Used by validateMediaFiles to surface width/height for uploading placeholders.
 */
export const getImageValidation = (
  file: File,
  blobFile?: string,
  revokeImageAfter = true
): Promise<{ valid: boolean; width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file selected.'))
      return
    }

    const isSmallerThanMaxFileSize = isSmallerThanMaxContentFile(file.size)
    if (!isSmallerThanMaxFileSize) {
      resolve({ valid: false, width: 0, height: 0 })
      return
    }

    const reader = new FileReader()

    reader.onload = function (e) {
      const image = new Image()

      image.onload = function () {
        const aspectRatio = image.width / image.height
        const isWithinRange = aspectRatio >= 1 / 100 && aspectRatio <= 100 / 1
        const isValidResolution = isSmallerThanMaxContentFileResolution(image.width, image.height)

        revokeImageAfter && URL.revokeObjectURL(image.src)

        resolve({
          valid: isWithinRange && isValidResolution,
          width: image.width,
          height: image.height,
        })
      }

      image.src = blobFile || URL.createObjectURL(new Blob([e.target!.result as ArrayBuffer]))
    }

    reader.onerror = function (error) {
      reject(error)
    }

    reader.readAsArrayBuffer(file)
  })
}

/**
 * Legacy wrapper — returns boolean only. Used by MaskUploaderModal.
 */
export const isValidRatio = async (file: File, blobFile?: string, revokeImageAfter = true) => {
  const result = await getImageValidation(file, blobFile, revokeImageAfter)
  return result.valid
}
