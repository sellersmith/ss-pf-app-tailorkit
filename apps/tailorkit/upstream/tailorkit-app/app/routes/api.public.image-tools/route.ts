/**
 * Shopify App Remix Route: Image Crop and Upload
 *
 * Route: app/routes/api.image.crop.tsx
 *
 * Handles image cropping and uploading to Shopify Files API
 * Supports URL, form data, and base64 inputs
 * Returns Shopify CDN URL of the cropped image
 */

import type { ActionFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import { createOpenAIMask, cropToOpaqueContent } from '~/utils/image-tools'

// Types for request handling
interface EditRequest {
  action?: string
  imageUrl?: string
  imageData?: string
  filename?: string
  options?: {
    // crop options
    padding?: number
    alphaThreshold?: number
    maintainAspectRatio?: boolean
    minSize?: { width: number; height: number }
    maxSize?: { width: number; height: number }
    // Mask options => for creating a mask to use with OpenAI's /images/edits endpoint
    canvasSize?: { width: number; height: number }
    maskSize?: { width: number; height: number }
    maskPosition?: { x: number; y: number }
  }
}

/**
 * Main action handler
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, { status: 405 })
    }

    // Get query params
    const { searchParams } = new URL(request.url)
    const secretToken = searchParams.get('token')

    // Validate secret token
    if (secretToken !== process.env.SECRET_TOKEN) {
      return json({
        success: false,
        message: 'Invalid secret token',
      })
    }

    // Parse the input data
    const input = await parseImageInput(request)

    let { options } = input
    const { action, filename, imageBuffer } = input

    if (action === 'crop' && !imageBuffer) {
      throw new Error('No image file provided')
    }

    // Sanitize options
    options = (function sanitizeOptions(obj: any) {
      for (const key in obj) {
        if (obj[key]?.match?.(/^\d+$/)) {
          obj[key] = Number(obj[key])
        } else if (typeof obj[key] === 'object') {
          obj[key] = sanitizeOptions(obj[key])
        }
      }

      return obj
    })(options)

    switch (action) {
      case 'crop': {
        // Crop the image to opaque content
        const cropped = (await cropToOpaqueContent(imageBuffer!, {
          minSize: options?.minSize,
          maxSize: options?.maxSize,
          padding: options?.padding,
          alphaThreshold: options?.alphaThreshold,
          outputFormat: options?.outputFormat || 'buffer',
          maintainAspectRatio: options?.maintainAspectRatio,
        })) as Buffer

        // Return image with proper headers
        const output = options?.outputFormat === 'base64' ? cropped.toString('base64') : cropped

        return new Response(output, {
          status: 200,
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=3600',
            'Content-Length': output.length.toString(),
            'Content-Disposition': `inline; filename="${filename || 'cropped_image.png'}"`,
          },
        })
      }

      case 'mask': {
        const mask = await createOpenAIMask(
          { width: options?.canvasWidth, height: options?.canvasHeight },
          {
            y: options?.maskTop,
            x: options?.maskLeft,
            width: options?.maskWidth,
            height: options?.maskHeight,
          },
          {
            quality: options?.quality,
            borderRadius: options?.borderRadius,
            featherRadius: options?.featherRadius,
            compressionLevel: options?.compressionLevel,
            outputFormat: options?.outputFormat || 'buffer',
            maskShape: options?.maskShape as 'rectangle' | 'ellipse' | 'rounded-rectangle',
            backgroundColor: {
              r: options?.backgroundColor?.r,
              g: options?.backgroundColor?.g,
              b: options?.backgroundColor?.b,
              a: options?.backgroundColor?.a,
            },
          }
        )

        // Return image with proper headers
        const output = options?.outputFormat === 'base64' ? mask.toString('base64') : mask

        return new Response(output, {
          status: 200,
          headers: {
            'Content-Type': 'image/png',
            'Content-Length': output.length.toString(),
            'Content-Disposition': 'inline; filename="openai_mask.png"',
          },
        })
      }

      default: {
        throw new Error('Invalid action')
      }
    }
  } catch (error) {
    console.error('Error in image crop route:', error)

    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        details: process.env.NODE_ENV === 'development' ? error : undefined,
      },
      { status: 500 }
    )
  }
}

/**
 * Parse input data to extract image buffer and filename
 */
async function parseImageInput(request: Request): Promise<{
  options?: any
  action: string
  filename: string
  imageBuffer: Buffer | null
}> {
  const { searchParams } = new URL(request.url)
  const contentType = request.headers.get('content-type') || ''

  let imageBuffer: Buffer | null = null
  let action = searchParams.get('action') || ''

  if (contentType.includes('multipart/form-data')) {
    // Handle form data (binary upload)
    const formData = await request.formData()
    const imageFile = formData.get('image') as File
    const optionsStr = formData.get('options') as string
    action = action || (formData.get('action') as string) || ''

    if (action === 'crop' && !imageFile) {
      throw new Error('No image file provided in form data')
    }

    const arrayBuffer = await imageFile.arrayBuffer()
    imageBuffer = Buffer.from(arrayBuffer)
    const filename = imageFile.name || 'uploaded-image.png'

    let options
    try {
      options = optionsStr ? JSON.parse(optionsStr) : undefined
    } catch {
      options = undefined
    }

    return { imageBuffer, filename, options, action }
  }

  // Handle JSON data (URL or base64)
  const requestData: EditRequest = await request.json()

  let filename = requestData.filename || 'image.png'
  action = action || (requestData.action as string) || ''

  if (requestData.imageUrl) {
    // Download from URL
    const response = await fetch(requestData.imageUrl)
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    imageBuffer = Buffer.from(arrayBuffer)

    // Extract filename from URL if not provided
    if (!requestData.filename) {
      try {
        const url = new URL(requestData.imageUrl)
        const pathSegments = url.pathname.split('/')
        const urlFilename = pathSegments[pathSegments.length - 1]
        if (urlFilename && urlFilename.includes('.')) {
          filename = urlFilename
        }
      } catch {
        // Keep default filename
      }
    }
  } else if (requestData.imageData) {
    // Handle base64 data
    let base64Data = requestData.imageData

    // Remove data URL prefix if present
    if (base64Data.startsWith('data:')) {
      const base64Index = base64Data.indexOf(',')
      if (base64Index !== -1) {
        base64Data = base64Data.substring(base64Index + 1)
      }
    }

    imageBuffer = Buffer.from(base64Data, 'base64')
  } else if (action === 'crop') {
    throw new Error('No image URL or image data provided')
  }

  return {
    action,
    filename,
    imageBuffer,
    options: requestData.options,
  }
}
