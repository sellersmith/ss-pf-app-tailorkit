import type { ActionFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import { authenticate } from '~/shopify/app.server'
import { catchAsync } from '~/utils/catchAsync'
import { ShopifyApiClient } from '~/shopify/graphql/api.server'

type UploadMockupRequestBody = {
  imageData: string // base64 string (with or without data URL prefix)
  filename?: string
}

/**
 * Upload a mockup image (base64) to Shopify staged files and return the public URL.
 *
 * Route: POST /api/mockup-upload
 */
export const action = catchAsync(async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request)

  if (request.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, { status: 405 })
  }

  const body = (await request.json().catch(() => null)) as UploadMockupRequestBody | null
  let imageData = body?.imageData

  if (!imageData) {
    return json({ success: false, error: 'imageData is required' }, { status: 400 })
  }

  const api = new ShopifyApiClient(admin)

  try {
    // Remove data URL prefix if present (e.g., "data:image/webp;base64,")
    if (imageData.startsWith('data:')) {
      const base64Index = imageData.indexOf(',')
      if (base64Index !== -1) {
        imageData = imageData.substring(base64Index + 1)
      }
    }

    // Convert base64 to Buffer
    const imageBuffer = Buffer.from(imageData, 'base64')
    const filename = body?.filename || 'mockup.webp'
    const fileSize = imageBuffer.byteLength

    // 1. Create staged upload target
    const stagedUploadResult = await api.createStagedUploads([
      {
        filename,
        fileSize: fileSize.toString(),
        mimeType: 'image/webp',
        resource: 'IMAGE',
        httpMethod: 'POST',
      },
    ])

    const stagedTarget = stagedUploadResult?.stagedTargets?.[0]
    if (!stagedTarget) {
      return json({ success: false, error: 'Failed to create staged upload' }, { status: 500 })
    }

    // 2. Upload file to staged URL
    const uploadFormData = new FormData()
    stagedTarget.parameters.forEach((param: { name: string; value: string }) => {
      uploadFormData.append(param.name, param.value)
    })
    // Create a blob from the buffer and append it
    const blob = new Blob([imageBuffer], { type: 'image/webp' })
    uploadFormData.append('file', blob, filename)

    const uploadResponse = await fetch(stagedTarget.url, {
      method: 'POST',
      body: uploadFormData,
    })

    if (!uploadResponse.ok) {
      return json({ success: false, error: 'Failed to upload file to staged URL' }, { status: 500 })
    }

    // 3. Return the resourceUrl that can be used with createProductMedia
    return json({
      success: true,
      url: stagedTarget.resourceUrl,
    })
  } catch (error) {
    console.error('Error uploading mockup:', error)
    return json({ success: false, error: 'Failed to upload mockup' }, { status: 500 })
  }
})
