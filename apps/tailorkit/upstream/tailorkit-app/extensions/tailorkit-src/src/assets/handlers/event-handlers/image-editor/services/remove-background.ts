import { APP_PROXY_PATH } from '../../../../constants'
import { STORE_FRONT_ACTION } from '../../../../constants/app-actions'
import { fetchWithAdminContext } from '../../../../libraries/fetchWithAdminContext'

/**
 * Remove background from an image
 * @param url - The URL to remove background from
 * @param image - The image file to remove background from
 * @param model - The model to use for background removal
 * @returns The image with background removed
 */
export const removeBackground = async (url: string, image: File, model: string = 'u2net') => {
  const formData = new FormData()

  formData.append('action', STORE_FRONT_ACTION.REMOVE_BACKGROUND_IMAGE)
  formData.append('image', image)
  formData.append('model', model)

  const response = await fetchWithAdminContext(url, {
    method: 'POST',
    body: formData,
  })

  const data = await response.json()
  return data
}

/**
 * Remove background from an image on the storefront
 * @param image - The image file to remove background from
 * @returns The image with background removed
 */
export const removeBackgroundOnStorefront = async (image: File) => {
  const url = `${APP_PROXY_PATH}/app_proxy/storefront`
  return removeBackground(url, image)
}
