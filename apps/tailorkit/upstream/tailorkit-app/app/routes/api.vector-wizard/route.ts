import { type ActionFunctionArgs } from '@remix-run/node'
import { catchAsync } from '~/utils/catchAsync'
import { authenticate } from '~/shopify/app.server'
import type { ShapeSelection, VectorConversionParameters } from '~/modules/VectorWizard/types'
import { json } from '~/bootstrap/fns/fetch.server'
import { convertRasterToVector } from '~/modules/VectorWizard/fns.server'

export const action = catchAsync(async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request)

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 })
  }

  const formData = await request.formData()
  const imageFile = formData.get('image') as File
  const imageUrl = formData.get('imageUrl') as string
  const shapeSelectionsStr = formData.get('shapeSelections') as string
  const conversionParamsStr = formData.get('conversionParams') as string
  const uploadToShopify = formData.get('uploadToShopify') === 'true'
  const fileName = (formData.get('fileName') as string) || 'vector-conversion'

  // Validate that we have either an image file or URL
  if (!imageFile && !imageUrl) {
    return json({ error: 'No image file or URL provided' }, { status: 400 })
  }

  // Parse shape selections
  let shapeSelections: ShapeSelection[]
  try {
    shapeSelections = shapeSelectionsStr ? JSON.parse(shapeSelectionsStr) : []
  } catch (error) {
    return json({ error: 'Invalid shape selections format' }, { status: 400 })
  }

  if (shapeSelections.length === 0) {
    return json({ error: 'No shapes selected for conversion' }, { status: 400 })
  }

  // Parse conversion parameters
  let conversionParams: VectorConversionParameters
  try {
    conversionParams = conversionParamsStr
      ? JSON.parse(conversionParamsStr)
      : {
          colorMode: 'monochrome',
          colorCount: 16,
          threshold: 128,
          turdSize: 2,
          turnPolicy: 'minority',
          alphaMax: 1.0,
          optCurve: true,
          optTolerance: 0.2,
        }
  } catch (error) {
    return json({ error: 'Invalid conversion parameters format' }, { status: 400 })
  }

  try {
    // Convert image file to buffer
    let imageBuffer: Buffer

    if (imageFile) {
      const arrayBuffer = await imageFile.arrayBuffer()
      imageBuffer = Buffer.from(arrayBuffer)
    } else if (imageUrl) {
      // Fetch image from URL if provided
      const response = await fetch(imageUrl)
      const arrayBuffer = await response.arrayBuffer()
      imageBuffer = Buffer.from(arrayBuffer)
    } else {
      return json({ error: 'No image provided' }, { status: 400 })
    }

    // Prepare Shopify client if uploading
    const shopifyClient = uploadToShopify
      ? {
          api: admin.graphql,
          shopDomain: session.shop,
        }
      : undefined

    // Call VectorWizard server function to convert shapes to SVG
    const results = await convertRasterToVector(
      imageBuffer,
      shapeSelections,
      conversionParams,
      uploadToShopify,
      fileName,
      shopifyClient
    )

    return json({
      success: true,
      results,
    })
  } catch (error) {
    console.error('Error processing vector conversion:', error)
    return json(
      {
        success: false,
        error: `Failed to convert image: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    )
  }
})
