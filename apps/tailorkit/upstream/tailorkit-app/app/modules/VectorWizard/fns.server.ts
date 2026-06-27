import sharp from 'sharp'
import potrace from 'potrace'
import { optimize } from 'svgo'
import { createRequire } from 'module'
import type { ShapeSelection, VectorConversionParameters, VectorResult } from './types'
import { uploadFiles } from '~/shopify/graphql/files/fns.server'
import { removeSolidBackgrounds } from '~/utils/image-processing/core/solid-bg-removal.server'

// Use createRequire for CJS module compatibility
const require = createRequire(import.meta.url)
const quantize = require('quantize')

/**
 * Create an ellipse mask buffer
 * White (opaque) inside ellipse, transparent outside
 */
async function createEllipseMask(width: number, height: number): Promise<Buffer> {
  const cx = width / 2
  const cy = height / 2
  const a = width / 2 // Semi-major axis
  const b = height / 2 // Semi-minor axis

  // Generate SVG ellipse mask
  const ellipseSvg = `
    <svg width="${width}" height="${height}">
      <ellipse cx="${cx}" cy="${cy}" rx="${a}" ry="${b}" fill="white"/>
    </svg>
  `

  // Convert SVG to PNG buffer
  return sharp(Buffer.from(ellipseSvg)).png().toBuffer()
}

/**
 * Crop image to shape bounds with ellipse masking support
 */
async function cropImageToShape(imageBuffer: Buffer, shape: ShapeSelection): Promise<Buffer> {
  const { x, y, width, height, type } = shape

  // First, crop to rectangular bounding box
  let croppedBuffer = await sharp(imageBuffer)
    .extract({
      left: Math.round(x),
      top: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
    })
    .png() // Ensure PNG output for alpha channel support
    .toBuffer()

  // For ellipse shapes, apply ellipse mask
  if (type === 'ellipse') {
    const ellipseMask = await createEllipseMask(Math.round(width), Math.round(height))

    croppedBuffer = await sharp(croppedBuffer)
      .composite([
        {
          input: ellipseMask,
          blend: 'dest-in', // Keep only pixels inside the mask
        },
      ])
      .png()
      .toBuffer()
  }

  return croppedBuffer
}

/**
 * Convert bitmap image to SVG using Potrace
 */
async function bitmapToSvg(imageBuffer: Buffer, params: VectorConversionParameters): Promise<string> {
  return new Promise((resolve, reject) => {
    const potraceOptions = {
      threshold: params.threshold,
      turdSize: params.turdSize,
      turnPolicy: params.turnPolicy,
      alphaMax: params.alphaMax,
      optCurve: params.optCurve,
      optTolerance: params.optTolerance,
    }

    potrace.trace(imageBuffer, potraceOptions, (err, svg) => {
      if (err) {
        reject(new Error(`Potrace conversion failed: ${err.message}`))
      } else {
        resolve(svg)
      }
    })
  })
}

/**
 * Color map result from quantize library
 */
interface ColorMapResult {
  palette: [number, number, number][]
  colorMap: {
    map: (pixel: [number, number, number]) => [number, number, number]
    palette: () => [number, number, number][]
  } | null
}

/**
 * Extract color palette from image using quantize library
 * Returns both the palette and the colorMap for deterministic pixel-to-color mapping
 */
async function extractColorPalette(imageBuffer: Buffer, colorCount: number): Promise<ColorMapResult> {
  // Get raw pixel data from image
  const { data } = await sharp(imageBuffer).raw().ensureAlpha().toBuffer({ resolveWithObject: true })

  // Build pixel array for quantize (skip transparent pixels)
  const pixels: [number, number, number][] = []
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]
    if (alpha > 128) {
      // Only include non-transparent pixels
      pixels.push([data[i], data[i + 1], data[i + 2]])
    }
  }

  if (pixels.length === 0) {
    return { palette: [[0, 0, 0]], colorMap: null } // Fallback to black if no pixels
  }

  // Quantize to get color palette and colorMap
  const colorMap = quantize(pixels, colorCount)
  if (!colorMap) {
    return { palette: [[0, 0, 0]], colorMap: null }
  }

  return { palette: colorMap.palette(), colorMap }
}

/**
 * Create all color masks using deterministic colorMap.map() assignment
 * Each pixel is mapped to exactly one palette color - no tolerance or overlap issues
 */
async function createAllColorMasks(
  imageBuffer: Buffer,
  colorMapResult: ColorMapResult
): Promise<Map<string, { mask: Buffer; pixelCount: number }>> {
  const { palette, colorMap } = colorMapResult
  const { data, info } = await sharp(imageBuffer).raw().ensureAlpha().toBuffer({ resolveWithObject: true })

  // Create a map to store mask data for each color
  const colorMasks = new Map<string, Uint8Array>()
  const pixelCounts = new Map<string, number>()

  // Initialize mask data for each palette color
  for (const color of palette) {
    const hexColor = rgbToHex(color)
    colorMasks.set(hexColor, new Uint8Array(info.width * info.height * 4))
    pixelCounts.set(hexColor, 0)
  }

  // Assign each pixel to its mapped color using colorMap.map()
  // IMPORTANT: Potrace traces BLACK regions by default (blackOnWhite: true)
  // So we use BLACK for color pixels (to be traced) and WHITE for non-color pixels
  for (let i = 0; i < data.length; i += 4) {
    const pixelIndex = i / 4
    const maskIndex = pixelIndex * 4

    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const alpha = data[i + 3]

    // Skip transparent pixels - set to WHITE (Potrace ignores white)
    if (alpha <= 128) {
      for (const maskData of colorMasks.values()) {
        maskData[maskIndex] = 255 // WHITE - not traced
        maskData[maskIndex + 1] = 255
        maskData[maskIndex + 2] = 255
        maskData[maskIndex + 3] = 255
      }
      continue
    }

    // Use colorMap.map() to get the exact palette color for this pixel
    let mappedColor: [number, number, number]
    if (colorMap) {
      mappedColor = colorMap.map([r, g, b])
    } else {
      // Fallback if colorMap is null - use first palette color
      mappedColor = palette[0]
    }
    const mappedHex = rgbToHex(mappedColor)

    // Set the pixel to BLACK in the matching color's mask (Potrace will trace it)
    // Set to WHITE in all other masks (Potrace will ignore it)
    for (const [hexColor, maskData] of colorMasks.entries()) {
      if (hexColor === mappedHex) {
        maskData[maskIndex] = 0 // BLACK - will be traced by Potrace
        maskData[maskIndex + 1] = 0
        maskData[maskIndex + 2] = 0
        maskData[maskIndex + 3] = 255
        pixelCounts.set(hexColor, (pixelCounts.get(hexColor) || 0) + 1)
      } else {
        maskData[maskIndex] = 255 // WHITE - ignored by Potrace
        maskData[maskIndex + 1] = 255
        maskData[maskIndex + 2] = 255
        maskData[maskIndex + 3] = 255
      }
    }
  }

  // Convert Uint8Arrays to PNG buffers
  const result = new Map<string, { mask: Buffer; pixelCount: number }>()

  for (const [hexColor, maskData] of colorMasks.entries()) {
    const mask = await sharp(Buffer.from(maskData), {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .png()
      .toBuffer()

    result.set(hexColor, {
      mask,
      pixelCount: pixelCounts.get(hexColor) || 0,
    })
  }

  return result
}

/**
 * Convert RGB array to hex color string
 * Clamps values to 0-255 range to handle edge cases from quantize library
 */
function rgbToHex(rgb: [number, number, number]): string {
  return `#${rgb
    .map(c =>
      Math.min(255, Math.max(0, Math.round(c)))
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`
}

/**
 * Path data with attributes
 */
interface PathData {
  d: string
  fillRule?: 'evenodd' | 'nonzero'
}

/**
 * Extract ALL path data from SVG string (multiple paths for distinct enclosed regions)
 * Potrace generates multiple <path> elements for separate contours - this captures all of them
 * Preserves compound paths (paths with holes) by NOT splitting at M commands
 */
function extractAllPathsFromSvg(svgString: string): PathData[] {
  const pathRegex = /<path[^>]*>/gi
  const allPaths: PathData[] = []
  let match

  while ((match = pathRegex.exec(svgString)) !== null) {
    const pathElement = match[0]

    // Extract d attribute
    const dMatch = pathElement.match(/d="([^"]*)"/i)
    const pathData = dMatch?.[1]

    if (pathData && pathData.trim().length > 0) {
      // Extract fill-rule attribute if present
      const fillRuleMatch = pathElement.match(/fill-rule="([^"]*)"/i)
      const fillRule = fillRuleMatch?.[1] as 'evenodd' | 'nonzero' | undefined

      allPaths.push({
        d: pathData,
        fillRule,
      })
    }
  }

  return allPaths
}

/**
 * Convert bitmap image to multi-colored SVG using deterministic color mapping
 * Uses quantize library's colorMap.map() for exact pixel-to-color assignment
 */
async function colorBitmapToSvg(imageBuffer: Buffer, params: VectorConversionParameters): Promise<string> {
  const colorCount = Math.min(Math.max(params.colorCount || 16, 2), 256)

  // Step 0: Apply background removal if enabled
  let processedBuffer = imageBuffer
  if (params.removeSolidBackground) {
    processedBuffer = await removeSolidBackgrounds(imageBuffer, {
      tolerance: params.bgRemovalTolerance ?? 30,
      removeEnclosed: params.removeWhiteBackground ? false : true,
      replaceGlobally: params.removeWhiteBackground ? true : false,
      targetColor: params.removeWhiteBackground ? [255, 255, 255] : undefined,
    })
  }

  // Step 1: Extract color palette and colorMap for deterministic mapping
  const colorMapResult = await extractColorPalette(processedBuffer, colorCount)

  if (!colorMapResult.colorMap) {
    return bitmapToSvg(processedBuffer, params)
  }

  // Get image dimensions for final SVG
  const metadata = await sharp(processedBuffer).metadata()
  const width = metadata.width || 100
  const height = metadata.height || 100

  // Step 2: Create all color masks using deterministic colorMap.map()
  const colorMasks = await createAllColorMasks(processedBuffer, colorMapResult)

  // Step 3: Trace each color layer
  const svgPaths: string[] = []

  for (const [hexColor, { mask, pixelCount }] of colorMasks.entries()) {
    if (pixelCount === 0) {
      continue
    }

    try {
      // Trace the mask using Potrace
      const tracedSvg = await bitmapToSvg(mask, {
        ...params,
        threshold: 128, // Binary mask, so use mid threshold
      })

      // Extract ALL paths (Potrace may generate multiple paths for distinct enclosed regions)
      const pathDataArray = extractAllPathsFromSvg(tracedSvg)
      for (const pathData of pathDataArray) {
        const fillRuleAttr = pathData.fillRule ? ` fill-rule="${pathData.fillRule}"` : ''
        svgPaths.push(`<path d="${pathData.d}" fill="${hexColor}"${fillRuleAttr} />`)
      }
    } catch (error) {
      console.error(`  ⚠️  Failed to trace color ${hexColor}:`, error)
    }
  }

  // Step 4: Compose final SVG
  if (svgPaths.length === 0) {
    // Fallback to monochrome if no paths were generated
    return bitmapToSvg(processedBuffer, params)
  }

  const compositeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
${svgPaths.join('\n')}
</svg>`

  return compositeSvg
}

/**
 * Optimize SVG using SVGO
 */
async function optimizeSvg(svgString: string): Promise<string> {
  try {
    const result = optimize(svgString, {
      plugins: [
        {
          name: 'preset-default',
          params: {
            overrides: {
              removeViewBox: false, // Keep viewBox for proper scaling
              removeXMLNS: false, // Keep xmlns - required for data URI rendering
            },
          },
        },
        'removeDimensions', // Remove width/height to make it responsive
      ],
    })
    return result.data
  } catch (error) {
    console.error('SVGO optimization failed, returning original SVG:', error)
    return svgString // Return original if optimization fails
  }
}

/**
 * Convert SVG string to data URI
 */
function svgToDataUri(svgString: string): string {
  const base64 = Buffer.from(svgString).toString('base64')
  return `data:image/svg+xml;base64,${base64}`
}

/**
 * Main function to convert raster image to vector SVG for multiple shapes
 */
export async function convertRasterToVector(
  imageBuffer: Buffer,
  shapeSelections: ShapeSelection[],
  conversionParameters: VectorConversionParameters,
  uploadToShopify: boolean = false,
  fileName: string = 'vector-conversion',
  shopifyClient?: { api: any; shopDomain: string }
): Promise<VectorResult[]> {
  // Process all shapes in parallel
  const results = await Promise.all(
    shapeSelections.map(async (shape, index): Promise<VectorResult> => {
      const shapeId = shape.shapeId || `shape-${index}`

      try {
        // Step 1: Crop image to shape bounds (with ellipse masking if needed)
        const croppedBuffer = await cropImageToShape(imageBuffer, shape)

        // Step 2: Convert to SVG using Potrace (monochrome or color mode)
        let svgString: string
        if (conversionParameters.colorMode === 'color') {
          svgString = await colorBitmapToSvg(croppedBuffer, conversionParameters)
        } else {
          // Monochrome mode: apply background removal first, then trace
          let processedBuffer = croppedBuffer
          if (conversionParameters.removeSolidBackground) {
            processedBuffer = await removeSolidBackgrounds(croppedBuffer, {
              tolerance: conversionParameters.bgRemovalTolerance ?? 30,
              removeEnclosed: conversionParameters.removeWhiteBackground ? false : true,
              replaceGlobally: conversionParameters.removeWhiteBackground ? true : false,
              targetColor: conversionParameters.removeWhiteBackground ? [255, 255, 255] : undefined,
            })
          }
          // Use Potrace output as-is to preserve compound paths
          svgString = await bitmapToSvg(processedBuffer, conversionParameters)
        }

        // Step 3: Optimize SVG
        const optimizedSvg = await optimizeSvg(svgString)

        // Step 4: Generate data URI
        const dataUri = svgToDataUri(optimizedSvg)

        // Step 6: Upload to Shopify if requested
        let shopifyUrl: string | undefined

        if (uploadToShopify && shopifyClient) {
          try {
            const { ShopifyApiClient } = await import('~/shopify/graphql/api.server')
            const svgFileName = `${fileName}-${shapeId}.svg`
            // Create a proper File object for uploadFiles
            const svgFile = new File([optimizedSvg], svgFileName, { type: 'image/svg+xml' })
            // Wrap admin context in ShopifyApiClient for proper API access
            const api = new ShopifyApiClient(shopifyClient.api)

            const uploadResult = await uploadFiles({
              api,
              files: [svgFile],
              shopDomain: shopifyClient.shopDomain,
            })

            // uploadFiles returns { uploadedFiles, errorFiles, errors }
            // URL is in uploadedFiles[].image?.originalSrc
            const uploadedFile = uploadResult?.uploadedFiles?.[0]
            const uploadedUrl = uploadedFile?.image?.originalSrc || uploadedFile?.url
            if (uploadedUrl) {
              shopifyUrl = uploadedUrl
            }
          } catch (uploadError) {
            console.error(`  ⚠️  Shopify upload failed for ${shapeId}:`, uploadError)
            // Don't fail the entire operation if upload fails
          }
        }

        return {
          shapeId,
          svgDataUri: dataUri,
          svgUrl: shopifyUrl,
          bounds: shape,
        }
      } catch (error) {
        console.error(`  ❌ Failed to process shape ${shapeId}:`, error)
        return {
          shapeId,
          bounds: shape,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    })
  )

  return results
}
