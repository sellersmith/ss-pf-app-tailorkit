import type { ActionFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import { authenticate } from '~/shopify/app.server'
import { catchAsync } from '~/utils/catchAsync'
import { SERVICE_ACTION } from './constants'
import { removeBackground } from './fns/remove-background'
import { removeBackgroundFromBuffer } from '~/utils/image-processing/core/solid-bg-removal.server'
import { uploadFiles } from '~/shopify/graphql/files/fns.server'
import { ShopifyApiClient } from '~/shopify/graphql/api.server'

export const action = catchAsync(async ({ request }: ActionFunctionArgs) => {
  const {
    admin,
    session: { shop: shopDomain },
  } = await authenticate.admin(request)

  const formData = await request.formData()
  const action = formData.get('action')

  switch (action) {
    case SERVICE_ACTION.REMOVE_BACKGROUND: {
      let data: any
      const image = formData.get('image') as File
      const type = (formData.get('type') || 'ai') as string

      if (type === 'ai') {
        data = await removeBackground(image, shopDomain)
      } else {
        if (type === 'white') {
          // Use enhanced settings for engraving images with better edge smoothing
          data = await removeBackgroundFromBuffer(await fileToBuffer(image), {
            replaceGlobally: true,
            targetColor: { r: 255, g: 255, b: 255 },
          })
        } else {
          // Keep existing logic for regular images
          data = await removeBackgroundFromBuffer(await fileToBuffer(image), {
            removeEnclosed: true,
          })
        }

        // Upload the buffer to Shopify CDN
        const api = new ShopifyApiClient(admin)
        const files = [bufferToFile(data, image.name)]
        const res = await uploadFiles({ api, files, shopDomain })

        data = { downloadUrl: res?.uploadedFiles?.[0]?.image?.originalSrc || res?.uploadedFiles?.[0]?.url }
      }

      return json({ success: true, data })
    }
  }
})

/**
 * Converts a File object to a Buffer
 * @param {File} file - The File object to convert
 * @returns {Promise<Buffer>} - A Promise that resolves to a Buffer containing the file data
 */
async function fileToBuffer(file: File): Promise<Buffer> {
  try {
    // Get the ArrayBuffer from the File object
    const arrayBuffer = await file.arrayBuffer()

    // Convert ArrayBuffer to Buffer
    const buffer = Buffer.from(arrayBuffer)

    return buffer
  } catch (error: any) {
    throw new Error(`Failed to convert File to Buffer: ${error.message}`)
  }
}

/**
 * Converts a Buffer to a File object
 * @param {Buffer} buffer - The Buffer to convert
 * @param {string} filename - The name for the file
 * @param {string} [mimeType='application/octet-stream'] - The MIME type of the file
 * @param {number} [lastModified=Date.now()] - Last modified timestamp
 * @returns {File} - A File object created from the buffer
 */
function bufferToFile(
  buffer: Buffer,
  filename: string,
  mimeType = 'application/octet-stream',
  lastModified = Date.now()
) {
  try {
    // Convert Buffer to Uint8Array (which File constructor accepts)
    const uint8Array = new Uint8Array(buffer)

    // Create and return the File object
    const file = new File([uint8Array], filename, {
      type: mimeType,
      lastModified: lastModified,
    })

    return file
  } catch (error: any) {
    throw new Error(`Failed to convert Buffer to File: ${error.message}`)
  }
}
