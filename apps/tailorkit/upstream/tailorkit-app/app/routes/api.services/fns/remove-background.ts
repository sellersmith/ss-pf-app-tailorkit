import { REMOVE_BACKGROUND_MODEL, REMOVE_BACKGROUND_URL } from '~/routes/api.app_proxy.storefront/constants'

/**
 * Remove background from an image
 * @param image - The image file to remove background from
 * @param shopDomain - The shop domain to remove background from
 * @returns The image with background removed
 */
export const removeBackground = async (image: File, shopDomain?: string) => {
  try {
    // Validate image input - should be a File object, not a string
    if (!image || !(image instanceof File)) {
      throw new Error('Invalid image file. Expected a File object.')
    }

    const url = REMOVE_BACKGROUND_URL
    const model = REMOVE_BACKGROUND_MODEL

    const formData = new FormData()
    formData.append('image', image) // Now properly handling File object
    formData.append('model', model)
    if (shopDomain) {
      formData.append('shopDomain', shopDomain)
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      })

      // Check if the response is successful
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        console.error(`Remove background API error: ${response.status} ${response.statusText}`, errorText)

        throw new Error(`Background removal service failed: ${response.status} ${response.statusText}`)
      }

      // Safely parse JSON response
      let data
      try {
        data = await response.json()
      } catch (jsonError) {
        console.error('Failed to parse background removal response as JSON:', jsonError)
        throw new Error('Invalid response format from background removal service')
      }

      return data
    } catch (fetchError: any) {
      console.error('Network error during background removal:', fetchError)

      throw new Error('Network error occurred while removing background')
    }
  } catch (error) {
    console.error('Error removing background:', error)
    throw new Error('Error removing background')
  }
}
