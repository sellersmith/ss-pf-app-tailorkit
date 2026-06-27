import { type ActionFunctionArgs } from '@remix-run/node'
import { catchAsync } from '~/utils/catchAsync'
import { authenticate } from '~/shopify/app.server'
import { json } from '@remix-run/node'
import {
  processMockupMask,
  validateProcessingInput,
  getDefaultProcessingParameters,
} from '~/modules/MockupWizard/fns.server'
import { ShopifyApiClient } from '~/shopify/graphql/api.server'
import type { ShapeSelection, ProcessingResponse, ProcessingParameters } from '~/modules/MockupWizard/types'
import { validateImageUrl } from '~/modules/MockupWizard/utils/urlValidation'
import { getCachedImageOrDownload } from '~/modules/MockupWizard/utils/imageCache.server'
import { calculateProcessingTimeout } from '~/modules/MockupWizard/utils/timeoutCalculator'
import { validateImageDimensions } from '~/modules/MockupWizard/utils/imagePreprocessing'
import { IMAGE_DIMENSIONS, PROCESSING_TIMEOUTS } from '~/modules/MockupWizard/constants'
import sharp from 'sharp'

export const action = catchAsync(async ({ request }: ActionFunctionArgs) => {
  const fs = await import('fs')
  fs.appendFileSync(
    '/tmp/mockup-wizard-debug.log',
    `\n[${new Date().toISOString()}] REQUEST method=${request.method}\n`
  )
  const { admin, session } = await authenticate.admin(request)
  fs.appendFileSync('/tmp/mockup-wizard-debug.log', `[${new Date().toISOString()}] AUTH PASSED\n`)

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 })
  }

  const formData = await request.formData()
  const imageUrl = formData.get('imageUrl') as string
  const imageFile = formData.get('image') as File
  const shapeSelectionsStr = formData.get('shapeSelections') as string
  const processingParametersStr = formData.get('processingParameters') as string
  const uploadToShopify = formData.get('uploadToShopify') === 'true'
  const featherRadiusStr = formData.get('featherRadius') as string

  // TEMPORARY DEBUG
  fs.appendFileSync(
    '/tmp/mockup-wizard-debug.log',
    `imageUrl: ${imageUrl?.substring(0, 100)}\nimageFile: ${!!imageFile}\nshapes: ${shapeSelectionsStr?.substring(0, 300)}\n`
  )

  // Check if either imageUrl or imageFile is provided
  if (!imageUrl && !imageFile) {
    fs.appendFileSync('/tmp/mockup-wizard-debug.log', `REJECTED: no image URL or file\n`)
    return json({ error: 'No image URL or file provided' }, { status: 400 })
  }

  try {
    // Parse input data
    const shapeSelections: ShapeSelection[] = shapeSelectionsStr ? JSON.parse(shapeSelectionsStr) : []

    // Parse processing parameters with fallback to defaults
    let processingParameters: ProcessingParameters
    try {
      processingParameters = processingParametersStr
        ? JSON.parse(processingParametersStr)
        : getDefaultProcessingParameters()
    } catch (paramError) {
      console.warn('Invalid processing parameters, using defaults:', paramError)
      processingParameters = getDefaultProcessingParameters()
    }

    // Validate input
    fs.appendFileSync(
      '/tmp/mockup-wizard-debug.log',
      `parsed shapes: ${JSON.stringify(shapeSelections).substring(0, 300)}\n`
    )
    const validation = validateProcessingInput(shapeSelections)
    if (!validation.isValid) {
      fs.appendFileSync('/tmp/mockup-wizard-debug.log', `VALIDATION FAILED: ${validation.error}\n`)
      return json({ error: validation.error }, { status: 400 })
    }
    fs.appendFileSync('/tmp/mockup-wizard-debug.log', `validation passed, proceeding\n`)

    // Get image buffer from URL or file (hybrid approach)
    let imageBuffer: Buffer

    if (imageUrl) {
      // Validate URL
      const urlValidation = validateImageUrl(imageUrl)
      if (!urlValidation.isValid) {
        return json({ error: urlValidation.error }, { status: 400 })
      }

      // Fetch from cache or download
      try {
        imageBuffer = await getCachedImageOrDownload(imageUrl, PROCESSING_TIMEOUTS.IMAGE_DOWNLOAD)
      } catch (fetchError) {
        console.error('Error fetching image from URL:', fetchError)
        return json(
          {
            error: `Failed to fetch image from URL: ${
              fetchError instanceof Error ? fetchError.message : 'Unknown error'
            }`,
          },
          { status: 400 }
        )
      }
    } else {
      // Fallback: existing binary data approach (backward compatibility)
      imageBuffer = Buffer.from(await imageFile.arrayBuffer())
    }

    // Validate image dimensions
    let imageMetadata
    try {
      imageMetadata = await sharp(imageBuffer).metadata()
    } catch (metadataError) {
      console.error('Error reading image metadata:', metadataError)
      return json({ error: 'Invalid image file or corrupted data' }, { status: 400 })
    }

    if (!imageMetadata.width || !imageMetadata.height) {
      return json({ error: 'Unable to determine image dimensions' }, { status: 400 })
    }

    // Check image dimensions against maximum limits
    const dimensionValidation = validateImageDimensions(imageMetadata.width, imageMetadata.height)
    if (!dimensionValidation.isValid) {
      console.warn(`Image dimensions rejected: ${imageMetadata.width}×${imageMetadata.height}`)
      return json({ error: dimensionValidation.error }, { status: 400 })
    }

    // Calculate dynamic server timeout based on image dimensions
    const serverTimeout = calculateProcessingTimeout(imageMetadata.width, imageMetadata.height, 'server')

    // Parse feather radius with fallback to default
    const featherRadius = featherRadiusStr ? parseInt(featherRadiusStr, 10) : 2

    // Process the image with optional Shopify upload
    // Enable aggressive server-side downscaling for large images
    // For 4000x4000 images, downscale to 1500px for faster processing
    const maxDim = Math.max(imageMetadata.width, imageMetadata.height)
    let maxDimension: number | undefined

    if (maxDim > IMAGE_DIMENSIONS.DOWNSCALE_THRESHOLD) {
      // Large images - downscale for processing
      maxDimension = IMAGE_DIMENSIONS.DOWNSCALE_THRESHOLD
    }

    const options = uploadToShopify
      ? {
          uploadToShopify: true,
          fileName: `mockup-mask-${Date.now()}.png`,
          api: new ShopifyApiClient(admin),
          shopDomain: session.shop,
          featherRadius,
          maxDimension,
        }
      : { featherRadius, maxDimension }

    // Wrap processing in Promise.race() to enforce timeout
    const processingPromise = processMockupMask(imageBuffer, shapeSelections, processingParameters, options)

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            `Server processing timeout after ${Math.ceil(serverTimeout / 1000)} seconds. Image may be too large or complex.`
          )
        )
      }, serverTimeout)
    })

    let processedImageUrl: string
    let transparentCount: number
    let transparentAreas: any[]
    let processedWidth: number | undefined
    let processedHeight: number | undefined
    let originalWidth: number | undefined
    let originalHeight: number | undefined
    let scale: number | undefined

    try {
      const result = await Promise.race([processingPromise, timeoutPromise])
      processedImageUrl = result.processedImageUrl as string
      transparentCount = result.transparentCount
      transparentAreas = result.transparentAreas as any[]
      processedWidth = result.processedWidth
      processedHeight = result.processedHeight
      originalWidth = result.originalWidth
      originalHeight = result.originalHeight
      scale = result.scale
    } catch (timeoutError) {
      console.error('Processing timeout or error:', timeoutError)
      throw timeoutError
    }

    const response: ProcessingResponse = {
      success: true,
      processedImageUrl: processedImageUrl || '',
      transparentCount,
      transparentAreas,
      message: uploadToShopify ? 'Image processed and uploaded successfully' : 'Image processed successfully',
      processedWidth,
      processedHeight,
      originalWidth,
      originalHeight,
      scale,
    }

    return json(response)
  } catch (error) {
    console.error('Error processing mockup mask:', error)
    return json(
      { error: `Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
})
