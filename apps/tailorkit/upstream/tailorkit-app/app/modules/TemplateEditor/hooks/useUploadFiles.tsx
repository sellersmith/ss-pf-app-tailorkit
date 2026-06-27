import { useCallback } from 'react'
import { dataURLtoFile, getFileExtension } from '~/utils/file-types'
import { authenticatedFetch } from '~/shopify/fns.client'
import { TEMPLATES_ACTIONS } from '~/routes/api.templates/constants'
import { ALLOWED_IMAGE_EXTENSIONS } from '~/constants/dropzone'

export function useUploadFiles() {
  const uploadBase64Medias = useCallback(async (files: { src: string; name: string }[]) => {
    try {
      const formData = new FormData()

      files.forEach(file => {
        const src = file.src
        let name = file.name

        // Supplement extension if missing extension
        const ext = getFileExtension(name)

        if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
          name = `${name}.webp`
        }

        const fileData = dataURLtoFile(src, name)

        formData.append('files', fileData)
      })

      const result = await authenticatedFetch(`/api/templates?action=${TEMPLATES_ACTIONS.UPLOAD_FILES}`, {
        method: 'POST',
        body: formData,
      })

      return result
    } catch (e) {
      console.error('Failed to upload images with error', e)
    }
  }, [])

  const uploadFiles = useCallback(async (files: File[], fileUploadType?: string) => {
    try {
      const formData = new FormData()

      // Append all files to a single form data
      files.forEach(file => {
        formData.append('files', file)
        formData.append('fileUploadType', fileUploadType || '')
      })

      const result = await authenticatedFetch(`/api/templates?action=${TEMPLATES_ACTIONS.UPLOAD_FILES}`, {
        method: 'POST',
        body: formData,
      })

      return [result]
    } catch (e) {
      console.error('Failed to upload files with error', e)
      throw e
    }
  }, [])

  return {
    uploadBase64Medias,
    uploadFiles,
  }
}
