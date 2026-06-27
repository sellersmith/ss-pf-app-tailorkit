import { isSmallerThanMaxContentFile } from '~/utils/file-types/validate-media-file-size'
import type { InvalidFileError } from './constants'
import { VALIDATION_MESSAGES } from './constants'

/**
 * Validates an array of files for font uploading
 * Checks file type, extension, and size
 * @param files - Array of files to validate
 * @returns Array of InvalidFileError for files that fail validation
 */
const validateFiles = async (
  files: File[],
  validateFunction: (file: File) => Promise<{ isValidExtension: boolean; isValidType: boolean; isValidFile?: boolean }>
): Promise<InvalidFileError[]> => {
  const results: InvalidFileError[] = []

  for (const file of files) {
    const { isValidExtension, isValidType, isValidFile = true } = await validateFunction(file)

    if (!isValidType || !isValidExtension || !isValidFile) {
      results.push({ name: file.name, reason: VALIDATION_MESSAGES.TYPE })
    }

    if (!isSmallerThanMaxContentFile(file.size)) {
      results.push({ name: file.name, reason: VALIDATION_MESSAGES.SIZE })
    }
  }

  return results.filter((error): error is InvalidFileError => error !== null)
}

export { validateFiles }
