/* eslint-disable max-lines */
/**
 * Unified Background Removal Module
 *
 * A comprehensive module for detecting and removing solid color backgrounds
 * including both edge-connected and enclosed areas with memory-safe algorithms.
 * Enhanced with maximum background colors control and coverage-based prioritization.
 *
 * @author TailorKit Team
 * @version 3.1.0 - Added maxBackgroundColors parameter for selective removal
 */

import sharp from 'sharp'
import { applyAntiAliasing } from './anti-aliasing.server'
import { downloadImageFromUrl } from '~/utils/image-tools'

/**
 * Pre-process image for better engraving edge detection
 */
async function preprocessForEngraving(imageBuffer: Buffer): Promise<Buffer> {
  return (
    sharp(imageBuffer)
      // Apply slight blur to reduce noise while preserving main edges
      .blur(0.5)
      // Enhance contrast to improve edge detection
      .modulate({
        brightness: 1.0,
        saturation: 0.8, // Reduce saturation to focus on luminance
        lightness: 1.1, // Slight brightness increase
      })
      // Apply unsharp mask to enhance edges
      // @ts-ignore
      .sharpen({
        sigma: 1.5, // Moderate sharpening
        flat: 0.8, // Preserve flat areas
        jagged: 1.2, // Enhance jagged edges
      })
      .png()
      .toBuffer()
  )
}

/**
 * Calculate the Euclidean distance between two RGB colors
 */
export function colorDistance(color1: any, color2: any): number {
  const r1 = color1.r || color1[0]
  const g1 = color1.g || color1[1]
  const b1 = color1.b || color1[2]
  const r2 = color2.r || color2[0]
  const g2 = color2.g || color2[1]
  const b2 = color2.b || color2[2]

  return Math.sqrt(Math.pow(r1 - r2, 2) + Math.pow(g1 - g2, 2) + Math.pow(b1 - b2, 2))
}

/**
 * Find connected region using iterative flood fill
 */
function findConnectedRegion(
  pixels: Uint8Array,
  width: number,
  height: number,
  startX: number,
  startY: number,
  targetColor: any,
  tolerance: number,
  visited: Uint8Array
): { pixels: number[]; bounds: any; size: number } {
  const regionPixels: number[] = []
  const stack = [{ x: startX, y: startY }]
  const bounds = { minX: startX, maxX: startX, minY: startY, maxY: startY }

  while (stack.length > 0) {
    const { x, y } = stack.pop()!

    if (x < 0 || x >= width || y < 0 || y >= height) continue

    const index = y * width + x
    if (visited[index]) continue

    const pixelIndex = index * 4
    const currentColor = {
      r: pixels[pixelIndex],
      g: pixels[pixelIndex + 1],
      b: pixels[pixelIndex + 2],
    }

    if (colorDistance(currentColor, targetColor) <= tolerance) {
      visited[index] = 1
      regionPixels.push(index)

      // Update bounds
      bounds.minX = Math.min(bounds.minX, x)
      bounds.maxX = Math.max(bounds.maxX, x)
      bounds.minY = Math.min(bounds.minY, y)
      bounds.maxY = Math.max(bounds.maxY, y)

      // Add adjacent pixels (4-connectivity)
      stack.push({ x: x + 1, y: y }, { x: x - 1, y: y }, { x: x, y: y + 1 }, { x: x, y: y - 1 })
    }
  }

  return {
    pixels: regionPixels,
    bounds,
    size: regionPixels.length,
  }
}

/**
 * Detect edge-connected background regions with enhanced target color detection
 */
function detectEdgeConnectedRegions(
  pixels: Uint8Array,
  width: number,
  height: number,
  tolerance: number,
  targetColor: any = null
): { regions: any[]; backgroundColors: any[] } {
  // Use enhanced detection when target color is specified
  if (targetColor) {
    return detectEdgeConnectedRegionsEnhanced(pixels, width, height, tolerance, targetColor)
  }

  // Original logic for general background detection
  const visited = new Uint8Array(width * height)
  const edgeRegions: any[] = []
  const backgroundColors: any[] = []

  // Get all edge pixels
  const edgePixels = []

  // Top and bottom edges
  for (let x = 0; x < width; x++) {
    edgePixels.push([x, 0])
    edgePixels.push([x, height - 1])
  }

  // Left and right edges (excluding corners)
  for (let y = 1; y < height - 1; y++) {
    edgePixels.push([0, y])
    edgePixels.push([width - 1, y])
  }

  // Process each edge pixel
  for (const [startX, startY] of edgePixels) {
    const startIndex = startY * width + startX
    if (visited[startIndex]) continue

    const startPixelIndex = startIndex * 4
    const startColor = {
      r: pixels[startPixelIndex],
      g: pixels[startPixelIndex + 1],
      b: pixels[startPixelIndex + 2],
    }

    // Find connected region from this edge pixel
    const region = findConnectedRegion(pixels, width, height, startX, startY, startColor, tolerance, visited)

    if (region.size > 0) {
      const coverage = region.size / (width * height)

      edgeRegions.push({
        color: startColor,
        size: region.size,
        coverage,
        bounds: region.bounds,
        pixels: region.pixels,
        edgePixel: { x: startX, y: startY },
        dimensions: {
          width: region.bounds.maxX - region.bounds.minX + 1,
          height: region.bounds.maxY - region.bounds.minY + 1,
        },
      })

      // Add to background colors if not already present
      let colorExists = false
      for (const bgColor of backgroundColors) {
        if (colorDistance(startColor, bgColor) <= tolerance) {
          colorExists = true
          break
        }
      }
      if (!colorExists) {
        backgroundColors.push(startColor)
      }
    }
  }

  return { regions: edgeRegions, backgroundColors }
}

/**
 * Enhanced edge-connected region detection with adaptive target color matching
 */
function detectEdgeConnectedRegionsEnhanced(
  pixels: Uint8Array,
  width: number,
  height: number,
  tolerance: number,
  targetColor: any
): { regions: any[]; backgroundColors: any[] } {
  const visited = new Uint8Array(width * height)
  const edgeRegions: any[] = []
  const backgroundColors: any[] = []

  // Multi-pass detection with different tolerance levels
  const toleranceLevels = [
    { tolerance: tolerance * 0.6, confidence: 1.0 }, // Strict match
    { tolerance: tolerance, confidence: 0.8 }, // Standard match
    { tolerance: tolerance * 1.4, confidence: 0.6 }, // Relaxed match
  ]

  // Analyze target color variance from edge samples
  const edgeColorSamples: { r: number; g: number; b: number }[] = []

  // Sample edge pixels to understand color variance
  const sampleStep = Math.max(1, Math.floor(Math.min(width, height) / 50))
  for (let x = 0; x < width; x += sampleStep) {
    // Top and bottom edges
    ;[0, height - 1].forEach(y => {
      const idx = (y * width + x) * 4
      const color = { r: pixels[idx], g: pixels[idx + 1], b: pixels[idx + 2] }
      if (colorDistance(color, targetColor) <= tolerance * 1.5) {
        edgeColorSamples.push(color)
      }
    })
  }

  for (let y = 0; y < height; y += sampleStep) {
    // Left and right edges
    ;[0, width - 1].forEach(x => {
      const idx = (y * width + x) * 4
      const color = { r: pixels[idx], g: pixels[idx + 1], b: pixels[idx + 2] }
      if (colorDistance(color, targetColor) <= tolerance * 1.5) {
        edgeColorSamples.push(color)
      }
    })
  }

  // Calculate adaptive tolerance based on color variance
  let colorVariance = 0
  if (edgeColorSamples.length > 1) {
    let totalVariance = 0
    for (const sample of edgeColorSamples) {
      totalVariance += colorDistance(sample, targetColor)
    }
    colorVariance = totalVariance / edgeColorSamples.length
  }

  // Adaptive tolerance adjustment
  const varianceBonus = Math.min(30, colorVariance * 0.5)

  // Process with multiple tolerance levels
  for (const level of toleranceLevels) {
    const adaptiveTolerance = level.tolerance + varianceBonus
    const currentVisited = new Uint8Array(visited) // Copy current state

    // Smart edge pixel sampling - prioritize pixels closer to target color
    const edgePixelCandidates: { x: number; y: number; distance: number; confidence: number }[] = []

    // Collect and rank edge pixels
    const edgePixels = []

    // Top and bottom edges
    for (let x = 0; x < width; x++) {
      edgePixels.push([x, 0], [x, height - 1])
    }

    // Left and right edges (excluding corners)
    for (let y = 1; y < height - 1; y++) {
      edgePixels.push([0, y], [width - 1, y])
    }

    // Rank edge pixels by target color similarity
    for (const [x, y] of edgePixels) {
      const index = y * width + x
      if (currentVisited[index]) continue

      const pixelIndex = index * 4
      const edgeColor = {
        r: pixels[pixelIndex],
        g: pixels[pixelIndex + 1],
        b: pixels[pixelIndex + 2],
      }

      const distance = colorDistance(edgeColor, targetColor)
      if (distance <= adaptiveTolerance) {
        edgePixelCandidates.push({
          x,
          y,
          distance,
          confidence: level.confidence * (1 - distance / adaptiveTolerance),
        })
      }
    }

    // Sort by confidence (best matches first)
    edgePixelCandidates.sort((a, b) => b.confidence - a.confidence)

    // Process prioritized edge pixels
    for (const candidate of edgePixelCandidates) {
      const { x: startX, y: startY } = candidate
      const startIndex = startY * width + startX
      if (currentVisited[startIndex]) continue

      const startPixelIndex = startIndex * 4
      const startColor = {
        r: pixels[startPixelIndex],
        g: pixels[startPixelIndex + 1],
        b: pixels[startPixelIndex + 2],
      }

      // Enhanced region finding with adaptive tolerance
      const region = findConnectedRegionEnhanced(
        pixels,
        width,
        height,
        startX,
        startY,
        startColor,
        adaptiveTolerance,
        currentVisited,
        targetColor,
        candidate.confidence
      )

      if (region.size > 0) {
        const coverage = region.size / (width * height)

        // Only add if not overlapping with existing regions
        let isOverlapping = false
        for (const existing of edgeRegions) {
          const overlapCount = region.pixels.filter(p => existing.pixels.includes(p)).length
          if (overlapCount > region.size * 0.3) {
            // 30% overlap threshold
            isOverlapping = true
            break
          }
        }

        if (!isOverlapping) {
          edgeRegions.push({
            color: startColor,
            size: region.size,
            coverage,
            bounds: region.bounds,
            pixels: region.pixels,
            edgePixel: { x: startX, y: startY },
            confidence: candidate.confidence,
            toleranceLevel: level.tolerance,
            dimensions: {
              width: region.bounds.maxX - region.bounds.minX + 1,
              height: region.bounds.maxY - region.bounds.minY + 1,
            },
          })

          // Update main visited array
          for (const pixelIndex of region.pixels) {
            visited[pixelIndex] = 1
          }

          // Add to background colors if not already present
          let colorExists = false
          for (const bgColor of backgroundColors) {
            if (colorDistance(startColor, bgColor) <= tolerance) {
              colorExists = true
              break
            }
          }
          if (!colorExists) {
            backgroundColors.push(startColor)
          }
        }
      }
    }
  }

  return { regions: edgeRegions, backgroundColors }
}

/**
 * Enhanced connected region finding with confidence-based expansion
 */
function findConnectedRegionEnhanced(
  pixels: Uint8Array,
  width: number,
  height: number,
  startX: number,
  startY: number,
  targetColor: any,
  tolerance: number,
  visited: Uint8Array,
  originalTargetColor: any,
  confidence: number
): { pixels: number[]; bounds: any; size: number } {
  const regionPixels: number[] = []
  const stack = [{ x: startX, y: startY }]
  const bounds = { minX: startX, maxX: startX, minY: startY, maxY: startY }

  // Confidence-based tolerance adjustment
  const confidenceMultiplier = 0.8 + confidence * 0.4
  const adaptiveTolerance = tolerance * confidenceMultiplier

  while (stack.length > 0) {
    const { x, y } = stack.pop()!

    if (x < 0 || x >= width || y < 0 || y >= height) continue

    const index = y * width + x
    if (visited[index]) continue

    const pixelIndex = index * 4
    const currentColor = {
      r: pixels[pixelIndex],
      g: pixels[pixelIndex + 1],
      b: pixels[pixelIndex + 2],
    }

    // Multi-criteria matching: both to region seed and original target
    const distanceToSeed = colorDistance(currentColor, targetColor)
    const distanceToOriginal = colorDistance(currentColor, originalTargetColor)

    const matchesSeed = distanceToSeed <= adaptiveTolerance
    const matchesOriginal = distanceToOriginal <= tolerance * 1.2

    if (matchesSeed || (matchesOriginal && confidence > 0.7)) {
      visited[index] = 1
      regionPixels.push(index)

      // Update bounds
      bounds.minX = Math.min(bounds.minX, x)
      bounds.maxX = Math.max(bounds.maxX, x)
      bounds.minY = Math.min(bounds.minY, y)
      bounds.maxY = Math.max(bounds.maxY, y)

      // Add adjacent pixels (4-connectivity)
      stack.push({ x: x + 1, y: y }, { x: x - 1, y: y }, { x: x, y: y + 1 }, { x: x, y: y - 1 })
    }
  }

  return {
    pixels: regionPixels,
    bounds,
    size: regionPixels.length,
  }
}

/**
 * Check if a region is enclosed (surrounded by different colors)
 */
function isRegionEnclosed(
  pixels: Uint8Array,
  width: number,
  height: number,
  region: any,
  regionColor: any,
  tolerance: number
): boolean {
  const { bounds } = region
  const borderPixels: any[] = []

  // Get border pixels around the region
  for (let y = Math.max(0, bounds.minY - 1); y <= Math.min(height - 1, bounds.maxY + 1); y++) {
    for (let x = Math.max(0, bounds.minX - 1); x <= Math.min(width - 1, bounds.maxX + 1); x++) {
      // Skip if inside the region bounds
      if (x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY) {
        continue
      }

      const index = y * width + x
      const pixelIndex = index * 4
      const borderColor = {
        r: pixels[pixelIndex],
        g: pixels[pixelIndex + 1],
        b: pixels[pixelIndex + 2],
      }

      borderPixels.push(borderColor)
    }
  }

  // Check if border pixels are significantly different from region color
  let differentPixels = 0
  for (const borderColor of borderPixels) {
    if (colorDistance(borderColor, regionColor) > tolerance) {
      differentPixels++
    }
  }

  // Consider enclosed if more than 70% of border pixels are different
  return differentPixels / borderPixels.length > 0.7
}

/**
 * Check if a region touches the image edges
 */
function touchesEdges(bounds: any, width: number, height: number): boolean {
  return bounds.minX === 0 || bounds.maxX === width - 1 || bounds.minY === 0 || bounds.maxY === height - 1
}

/**
 * Find enclosed regions matching background colors with enhanced frame-aware detection
 */
function findEnclosedRegions(
  pixels: Uint8Array,
  width: number,
  height: number,
  backgroundColors: any[],
  tolerance: number,
  edgeVisited: Uint8Array,
  minSize: number = 10,
  maxSize: number = width * height * 0.5,
  targetColor: any = null,
  gridSize: number = 5
): any[] {
  const visited = new Uint8Array(edgeVisited) // Copy edge-visited pixels
  const enclosedRegions: any[] = []

  // If target color is specified, use enhanced frame-aware detection
  if (targetColor) {
    return findEnclosedRegionsWithFrameDetection(
      pixels,
      width,
      height,
      targetColor,
      tolerance,
      visited,
      minSize,
      maxSize,
      gridSize
    )
  }

  // Original logic for when no specific target color is provided
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x
      if (visited[index]) continue

      const pixelIndex = index * 4
      const currentColor = {
        r: pixels[pixelIndex],
        g: pixels[pixelIndex + 1],
        b: pixels[pixelIndex + 2],
      }

      // Check if this pixel matches any background color
      let matchesBackground = false
      for (const bgColor of backgroundColors) {
        if (colorDistance(currentColor, bgColor) <= tolerance) {
          matchesBackground = true
          break
        }
      }

      if (!matchesBackground) continue

      // Find connected region
      const region = findConnectedRegion(pixels, width, height, x, y, currentColor, tolerance, visited)

      // Skip if region is too small, too large, or touches edges
      if (region.size < minSize || region.size > maxSize || touchesEdges(region.bounds, width, height)) {
        continue
      }

      // Check if region is actually enclosed
      if (isRegionEnclosed(pixels, width, height, region, currentColor, tolerance)) {
        enclosedRegions.push({
          color: currentColor,
          size: region.size,
          bounds: region.bounds,
          pixels: region.pixels,
          coverage: region.size / (width * height),
          dimensions: {
            width: region.bounds.maxX - region.bounds.minX + 1,
            height: region.bounds.maxY - region.bounds.minY + 1,
          },
        })
      }
    }
  }

  return enclosedRegions
}

/**
 * Enhanced enclosed region detection using frame-aware algorithm from MockupWizard
 */
function findEnclosedRegionsWithFrameDetection(
  pixels: Uint8Array,
  width: number,
  height: number,
  targetColor: any,
  tolerance: number,
  visited: Uint8Array,
  minSize: number,
  maxSize: number,
  gridSize: number = 5
): any[] {
  const enclosedRegions: any[] = []
  const seedPoints: { x: number; y: number }[] = []

  // Generate seed points by scanning for target color pixels in potential enclosed areas
  for (let y = Math.floor(height * 0.1); y < Math.floor(height * 0.9); y += gridSize) {
    for (let x = Math.floor(width * 0.1); x < Math.floor(width * 0.9); x += gridSize) {
      const index = y * width + x
      if (visited[index]) continue

      const pixelIndex = index * 4
      const currentColor = {
        r: pixels[pixelIndex],
        g: pixels[pixelIndex + 1],
        b: pixels[pixelIndex + 2],
      }

      // Check if this potential seed matches target color
      if (colorDistance(currentColor, targetColor) <= tolerance) {
        // Verify it's not at image edges (we want enclosed areas)
        if (x > 10 && x < width - 10 && y > 10 && y < height - 10) {
          seedPoints.push({ x, y })
        }
      }
    }
  }

  // Process each seed point with simple frame detection
  for (const seedPoint of seedPoints) {
    const { x: seedX, y: seedY } = seedPoint
    const seedIndex = seedY * width + seedX

    if (visited[seedIndex]) continue

    const seedPixelIndex = seedIndex * 4
    const seedColor = {
      r: pixels[seedPixelIndex],
      g: pixels[seedPixelIndex + 1],
      b: pixels[seedPixelIndex + 2],
    }

    // Simple frame detection - find connected region
    const regionVisited = new Set<string>()
    const stack: [number, number][] = [[seedX, seedY]]
    const enclosedArea = new Set<string>()

    while (stack.length > 0 && enclosedArea.size < maxSize) {
      const [x, y] = stack.pop()!
      const key = `${x},${y}`

      if (x < 0 || x >= width || y < 0 || y >= height || regionVisited.has(key)) {
        continue
      }

      // Skip if already processed in main visited array
      const index = y * width + x
      if (visited[index]) continue

      regionVisited.add(key)

      const idx = (y * width + x) * 4
      const r = pixels[idx]
      const g = pixels[idx + 1]
      const b = pixels[idx + 2]

      // Check color similarity to target
      const colorDist = colorDistance({ r, g, b }, targetColor)

      if (colorDist <= tolerance) {
        enclosedArea.add(key)
        visited[index] = 1 // Mark as processed

        // 4-directional expansion
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
      }
    }

    // Validate the detected region
    if (enclosedArea.size >= minSize && enclosedArea.size <= maxSize) {
      // Calculate bounds
      let minX = width,
        maxX = 0,
        minY = height,
        maxY = 0
      const regionPixels: number[] = []

      enclosedArea.forEach(key => {
        const [x, y] = key.split(',').map(Number)
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)
        regionPixels.push(y * width + x)
      })

      const bounds = { minX, maxX, minY, maxY }

      // Ensure it doesn't touch edges (truly enclosed)
      if (!touchesEdges(bounds, width, height)) {
        enclosedRegions.push({
          color: seedColor,
          size: enclosedArea.size,
          bounds,
          pixels: regionPixels,
          coverage: enclosedArea.size / (width * height),
          dimensions: {
            width: bounds.maxX - bounds.minX + 1,
            height: bounds.maxY - bounds.minY + 1,
          },
        })
      }
    }
  }

  return enclosedRegions
}

/**
 * Group regions by color and calculate total coverage for each color
 */
function groupRegionsByColor(
  regions: any[],
  tolerance: number
): Array<{
  color: any
  totalCoverage: number
  totalSize: number
  regions: any[]
}> {
  const colorGroups: Array<{
    color: any
    totalCoverage: number
    totalSize: number
    regions: any[]
  }> = []

  for (const region of regions) {
    // Find existing color group within tolerance
    let colorGroup = colorGroups.find(group => colorDistance(group.color, region.color) <= tolerance)

    if (!colorGroup) {
      // Create new color group
      colorGroup = {
        color: region.color,
        totalCoverage: 0,
        totalSize: 0,
        regions: [],
      }
      colorGroups.push(colorGroup)
    }

    // Add region to the color group
    colorGroup.regions.push(region)
    colorGroup.totalCoverage += region.coverage
    colorGroup.totalSize += region.size
  }

  // Sort by total coverage (highest first)
  colorGroups.sort((a, b) => b.totalCoverage - a.totalCoverage)

  return colorGroups
}

/**
 * Comprehensive background detection
 */
export async function detectBackgrounds(
  imageBuffer: Buffer,
  options: {
    tolerance?: number
    targetColor?: any
    minEnclosedSize?: number
    maxEnclosedSize?: number
    detectEnclosed?: boolean
    resizeForAnalysis?: boolean
    maxBackgroundColors?: number
  } = {}
): Promise<any> {
  const {
    tolerance = 30,
    targetColor = null,
    minEnclosedSize = 300,
    maxEnclosedSize,
    detectEnclosed = false,
    resizeForAnalysis = true,
    maxBackgroundColors = 1,
  } = options

  try {
    // Get image metadata
    const image = sharp(imageBuffer)
    const { width, height } = await image.metadata()
    const totalPixels = width! * height!

    // Optionally resize for analysis
    let analysisBuffer = imageBuffer
    let analysisWidth = width!
    let analysisHeight = height!
    let scaleFactor = 1

    if (resizeForAnalysis && totalPixels > 2000000) {
      scaleFactor = Math.sqrt(2000000 / totalPixels)
      analysisWidth = Math.floor(width! * scaleFactor)
      analysisHeight = Math.floor(height! * scaleFactor)

      analysisBuffer = await sharp(imageBuffer)
        .resize(analysisWidth, analysisHeight, {
          kernel: sharp.kernel.lanczos3,
          withoutEnlargement: true,
        })
        .toBuffer()
    }

    // Convert to RGBA format
    const { data: pixels } = await sharp(analysisBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })

    // Detect edge-connected regions
    const { regions: edgeRegions, backgroundColors } = detectEdgeConnectedRegions(
      pixels,
      analysisWidth,
      analysisHeight,
      tolerance,
      targetColor
    )

    // Detect enclosed regions if requested
    let enclosedRegions: any[] = []
    if (detectEnclosed && backgroundColors.length > 0) {
      // Mark edge-connected pixels as visited
      const edgeVisited = new Uint8Array(analysisWidth * analysisHeight)
      for (const region of edgeRegions) {
        for (const pixelIndex of region.pixels) {
          edgeVisited[pixelIndex] = 1
        }
      }

      enclosedRegions = findEnclosedRegions(
        pixels,
        analysisWidth,
        analysisHeight,
        backgroundColors,
        tolerance,
        edgeVisited,
        Math.max(1, Math.floor(minEnclosedSize * scaleFactor * scaleFactor)),
        maxEnclosedSize
          ? Math.floor(maxEnclosedSize * scaleFactor * scaleFactor)
          : analysisWidth * analysisHeight * 0.5,
        targetColor
      )
    }

    // Group regions by color and apply maxBackgroundColors limit
    let filteredEdgeRegions = edgeRegions
    let filteredEnclosedRegions = enclosedRegions
    let filteredBackgroundColors = backgroundColors

    if (maxBackgroundColors && maxBackgroundColors > 0) {
      // Combine all regions for color grouping
      const allRegions = [...edgeRegions, ...enclosedRegions]
      const colorGroups = groupRegionsByColor(allRegions, tolerance)

      // Limit to top N color groups
      const topColorGroups = colorGroups.slice(0, maxBackgroundColors)

      // Extract allowed colors
      filteredBackgroundColors = topColorGroups.map(group => group.color)

      // Filter regions to only include those matching allowed colors
      filteredEdgeRegions = edgeRegions.filter(region =>
        filteredBackgroundColors.some(color => colorDistance(region.color, color) <= tolerance)
      )

      filteredEnclosedRegions = enclosedRegions.filter(region =>
        filteredBackgroundColors.some(color => colorDistance(region.color, color) <= tolerance)
      )
    }

    // Scale results back to original size
    const scaleResults = (regions: any[]) =>
      regions.map(region => ({
        ...region,
        size: Math.round(region.size / (scaleFactor * scaleFactor)),
        bounds: {
          minX: Math.round(region.bounds.minX / scaleFactor),
          maxX: Math.round(region.bounds.maxX / scaleFactor),
          minY: Math.round(region.bounds.minY / scaleFactor),
          maxY: Math.round(region.bounds.maxY / scaleFactor),
        },
        dimensions: {
          width: Math.round(region.dimensions.width / scaleFactor),
          height: Math.round(region.dimensions.height / scaleFactor),
        },
        coverage: region.size / (scaleFactor * scaleFactor) / totalPixels,
        ...(region.edgePixel && {
          edgePixel: {
            x: Math.round(region.edgePixel.x / scaleFactor),
            y: Math.round(region.edgePixel.y / scaleFactor),
          },
        }),
      }))

    const scaledEdgeRegions = scaleResults(filteredEdgeRegions)
    const scaledEnclosedRegions = scaleResults(filteredEnclosedRegions)

    // Calculate summaries
    const totalEdgePixels = scaledEdgeRegions.reduce((sum, region) => sum + region.size, 0)
    const totalEnclosedPixels = scaledEnclosedRegions.reduce((sum, region) => sum + region.size, 0)
    const totalBackgroundPixels = totalEdgePixels + totalEnclosedPixels

    const largestEdgeRegion
      = scaledEdgeRegions.length > 0
        ? scaledEdgeRegions.reduce((max, region) => (region.size > max.size ? region : max))
        : null

    return {
      imageInfo: { width, height, totalPixels },
      detectionParams: { tolerance, targetColor, minEnclosedSize, detectEnclosed, maxBackgroundColors },
      backgroundColors: filteredBackgroundColors,
      edgeConnected: {
        regionsFound: scaledEdgeRegions.length,
        totalPixels: totalEdgePixels,
        coverage: Math.round((totalEdgePixels / totalPixels) * 10000) / 100,
        regions: scaledEdgeRegions.map((region, index) => ({
          id: index,
          color: region.color,
          size: region.size,
          coveragePercentage: Math.round(region.coverage * 10000) / 100,
          bounds: region.bounds,
          dimensions: region.dimensions,
          edgePixel: region.edgePixel,
          isLargest: largestEdgeRegion && region.size === largestEdgeRegion.size,
        })),
      },
      enclosed: {
        regionsFound: scaledEnclosedRegions.length,
        totalPixels: totalEnclosedPixels,
        coverage: Math.round((totalEnclosedPixels / totalPixels) * 10000) / 100,
        regions: scaledEnclosedRegions.map((region, index) => ({
          id: index,
          color: region.color,
          size: region.size,
          coveragePercentage: Math.round(region.coverage * 10000) / 100,
          bounds: region.bounds,
          dimensions: region.dimensions,
          center: {
            x: Math.round((region.bounds.minX + region.bounds.maxX) / 2),
            y: Math.round((region.bounds.minY + region.bounds.maxY) / 2),
          },
        })),
      },
      summary: {
        hasBackground: scaledEdgeRegions.length > 0 || scaledEnclosedRegions.length > 0,
        totalBackgroundPixels,
        totalBackgroundCoverage: Math.round((totalBackgroundPixels / totalPixels) * 10000) / 100,
        edgeConnectedCoverage: Math.round((totalEdgePixels / totalPixels) * 10000) / 100,
        enclosedCoverage: Math.round((totalEnclosedPixels / totalPixels) * 10000) / 100,
        largestRegionColor: largestEdgeRegion ? largestEdgeRegion.color : null,
        largestRegionSize: largestEdgeRegion ? largestEdgeRegion.size : 0,
        maxBackgroundColorsApplied: maxBackgroundColors || null,
      },
    }
  } catch (error) {
    console.error('Error detecting backgrounds:', error)
    throw error
  }
}

/**
 * Calculate adaptive tolerance based on local contrast
 */
function calculateAdaptiveTolerance(
  pixels: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  baseTolerance: number,
  windowSize: number = 5
): number {
  const halfWindow = Math.floor(windowSize / 2)
  let minDistance = Infinity
  let maxDistance = 0

  const centerIndex = (y * width + x) * 4
  const centerColor = {
    r: pixels[centerIndex],
    g: pixels[centerIndex + 1],
    b: pixels[centerIndex + 2],
  }

  // Analyze local neighborhood
  for (let dy = -halfWindow; dy <= halfWindow; dy++) {
    for (let dx = -halfWindow; dx <= halfWindow; dx++) {
      const nx = x + dx
      const ny = y + dy

      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const neighborIndex = (ny * width + nx) * 4
        const neighborColor = {
          r: pixels[neighborIndex],
          g: pixels[neighborIndex + 1],
          b: pixels[neighborIndex + 2],
        }

        const distance = colorDistance(centerColor, neighborColor)
        minDistance = Math.min(minDistance, distance)
        maxDistance = Math.max(maxDistance, distance)
      }
    }
  }

  // Calculate local contrast
  const localContrast = maxDistance - minDistance

  // Adapt tolerance based on local contrast
  // High contrast areas get lower tolerance for precision
  // Low contrast areas get higher tolerance for smooth blending
  const contrastFactor = Math.max(0.5, Math.min(1.5, 1.0 - localContrast / 100))

  return baseTolerance * contrastFactor
}

/**
 * Replace colors globally across the entire image with transparency and anti-aliasing
 */
function replaceColorsGlobally(
  pixels: Uint8Array,
  width: number,
  height: number,
  targetColor: any,
  tolerance: number,
  featherRadius: number,
  smoothnessLevel: string = 'moderate',
  multiPass: boolean = false,
  edgePreservation: number = 0.7,
  blendingCurve: string = 'smoothstep',
  adaptiveRadius: boolean = true,
  onProgress?: (message: string, progress: number) => void
): Uint8Array {
  if (onProgress) onProgress('Creating adaptive color replacement mask...', 70)

  // Create mask for pixels to replace with adaptive tolerance
  const replacementMask = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelIndex = (y * width + x) * 4
      const currentColor = {
        r: pixels[pixelIndex],
        g: pixels[pixelIndex + 1],
        b: pixels[pixelIndex + 2],
      }

      // Use adaptive tolerance based on local contrast
      const adaptiveTolerance = calculateAdaptiveTolerance(pixels, width, height, x, y, tolerance)

      if (colorDistance(currentColor, targetColor) <= adaptiveTolerance) {
        replacementMask[y * width + x] = 1
      }
    }
  }

  if (onProgress) onProgress('Applying global replacement with anti-aliasing...', 80)

  // Use universal anti-aliasing with configurable smoothness
  return applyAntiAliasing(pixels, replacementMask, width, height, {
    smoothnessLevel: smoothnessLevel as any,
    featherRadius,
    blendingCurve: blendingCurve as any,
    edgePreservation,
    multiPass,
    adaptiveRadius,
    onProgress,
  })
}

/**
 * Main function: Remove seamless solid color backgrounds connected to edges with optional enclosed area removal
 */
export async function removeSolidBackgrounds(
  imageBuffer: Buffer,
  options: {
    tolerance?: number
    targetColor?: any
    removeEnclosed?: boolean
    minEnclosedSize?: number
    maxEnclosedSize?: number
    maxPixels?: number
    maxBackgroundColors?: number
    gridSize?: number
    featherRadius?: number
    replaceGlobally?: boolean
    smoothnessLevel?: string
    multiPass?: boolean
    edgePreservation?: number
    blendingCurve?: string
    adaptiveRadius?: boolean
    onProgress?: (message: string, progress: number) => void
  } = {}
): Promise<Buffer> {
  const {
    tolerance = 25,
    targetColor = null,
    removeEnclosed = false,
    minEnclosedSize = 16,
    maxEnclosedSize = 128,
    maxPixels = 20000000,
    maxBackgroundColors = 1,
    gridSize = 5,
    featherRadius = 3,
    replaceGlobally = false,
    smoothnessLevel = 'maximum',
    multiPass = true,
    edgePreservation = 0.6,
    blendingCurve = 'gaussian',
    adaptiveRadius = true,
    onProgress,
  } = options

  try {
    if (onProgress) onProgress('Starting background removal...', 0)

    // Validate global replacement mode
    if (replaceGlobally && !targetColor) {
      throw new Error('targetColor must be specified when replaceGlobally is true')
    }

    // Pre-process for engraving if using global replacement (engraving mode)
    let workingBuffer = imageBuffer
    if (replaceGlobally && targetColor) {
      if (onProgress) onProgress('Pre-processing for engraving...', 5)
      workingBuffer = await preprocessForEngraving(imageBuffer)
    }

    // Get image metadata
    const image = sharp(workingBuffer)
    const { width, height } = await image.metadata()
    const totalPixels = width! * height!

    // Auto-resize if image is too large
    let processBuffer = workingBuffer
    let processWidth = width!
    let processHeight = height!
    let needsResize = false

    if (totalPixels > maxPixels) {
      if (onProgress) onProgress('Resizing large image...', 5)

      needsResize = true
      const scale = Math.sqrt(maxPixels / totalPixels)
      processWidth = Math.floor(width! * scale)
      processHeight = Math.floor(height! * scale)

      processBuffer = await sharp(imageBuffer)
        .resize(processWidth, processHeight, {
          kernel: sharp.kernel.lanczos3,
          withoutEnlargement: true,
        })
        .toBuffer()
    }

    // Convert to RGBA format
    if (onProgress) onProgress('Loading image data...', 10)
    const { data: pixels } = await sharp(processBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })

    let processedPixels: Uint8Array

    // Handle global replacement mode (bypass all detection algorithms)
    if (replaceGlobally) {
      if (onProgress) onProgress('Starting global color replacement...', 30)
      processedPixels = replaceColorsGlobally(
        pixels,
        processWidth,
        processHeight,
        targetColor,
        tolerance,
        featherRadius,
        smoothnessLevel,
        multiPass,
        edgePreservation,
        blendingCurve,
        adaptiveRadius,
        onProgress
      )
    } else {
      // Original logic: edge-connected and enclosed region detection
      processedPixels = new Uint8Array(pixels)

      // Step 1: Remove edge-connected backgrounds
      if (onProgress) onProgress('Detecting edge-connected backgrounds...', 30)

      const { regions: edgeRegions, backgroundColors } = detectEdgeConnectedRegions(
        pixels,
        processWidth,
        processHeight,
        tolerance,
        targetColor
      )

      // Step 2: Remove enclosed backgrounds if requested (detect first to get all regions)
      let enclosedRegions: any[] = []
      if (removeEnclosed && backgroundColors.length > 0) {
        if (onProgress) onProgress('Detecting enclosed backgrounds...', 40)

        // Mark edge-connected pixels as visited
        const edgeVisited = new Uint8Array(processWidth * processHeight)
        for (const region of edgeRegions) {
          for (const pixelIndex of region.pixels) {
            edgeVisited[pixelIndex] = 1
          }
        }

        enclosedRegions = findEnclosedRegions(
          pixels,
          processWidth,
          processHeight,
          backgroundColors,
          tolerance,
          edgeVisited,
          Math.max(1, Math.floor((minEnclosedSize * (processWidth * processHeight)) / (width! * height!))),
          maxEnclosedSize
            ? Math.floor((maxEnclosedSize * (processWidth * processHeight)) / (width! * height!))
            : processWidth * processHeight * 0.5,
          targetColor,
          gridSize
        )
      }

      // Step 3: Apply maxBackgroundColors limit if specified
      let regionsToRemove = [...edgeRegions, ...enclosedRegions]

      if (maxBackgroundColors && maxBackgroundColors > 0) {
        if (onProgress) onProgress(`Selecting top ${maxBackgroundColors} background colors...`, 45)

        // Group regions by color and get top N colors by coverage
        const colorGroups = groupRegionsByColor(regionsToRemove, tolerance)
        const topColorGroups = colorGroups.slice(0, maxBackgroundColors)
        const allowedColors = topColorGroups.map(group => group.color)

        // Filter regions to only include those matching allowed colors
        regionsToRemove = regionsToRemove.filter(region =>
          allowedColors.some(color => colorDistance(region.color, color) <= tolerance)
        )
      }

      // Step 4: Remove selected background pixels with anti-aliasing
      if (onProgress) onProgress('Removing background pixels with anti-aliasing...', 60)

      // Create mask for background regions
      const backgroundMask = new Uint8Array(processWidth * processHeight)
      for (const region of regionsToRemove) {
        for (const pixelIndex of region.pixels) {
          backgroundMask[pixelIndex] = 1
        }
      }

      // Use universal anti-aliasing with configurable settings
      processedPixels = applyAntiAliasing(pixels, backgroundMask, processWidth, processHeight, {
        smoothnessLevel: smoothnessLevel as any,
        featherRadius,
        blendingCurve: blendingCurve as any,
        edgePreservation,
        multiPass,
        adaptiveRadius,
        onProgress,
      })
    }

    // Create output image
    if (onProgress) onProgress('Creating output image...', 90)
    let outputBuffer = await sharp(processedPixels, {
      raw: {
        width: processWidth,
        height: processHeight,
        channels: 4,
      },
    })
      .png()
      .toBuffer()

    // Scale back to original size if needed
    if (needsResize) {
      if (onProgress) onProgress('Scaling to original size...', 95)

      outputBuffer = await sharp(outputBuffer)
        .resize(width, height, {
          kernel: sharp.kernel.lanczos3,
        })
        .png()
        .toBuffer()
    }

    if (onProgress) onProgress('Completed!', 100)

    return outputBuffer
  } catch (error) {
    console.error('Error removing backgrounds:', error)
    throw error
  }
}

// URL-based functions
export async function detectBackgroundsFromUrl(url: string, options: any = {}) {
  const imageBuffer = await downloadImageFromUrl(url)
  return detectBackgrounds(imageBuffer, options)
}

export async function removeSolidBackgroundsFromUrl(url: string, options: any = {}) {
  const imageBuffer = await downloadImageFromUrl(url)
  return removeSolidBackgrounds(imageBuffer, options)
}

// Legacy compatibility functions
export async function detectBackgroundFromBuffer(imageBuffer: Buffer, options: any = {}) {
  return detectBackgrounds(imageBuffer, options)
}

export async function removeBackgroundFromBuffer(imageBuffer: Buffer, options: any = {}) {
  return removeSolidBackgrounds(imageBuffer, options)
}

export async function detectBackgroundFromUrl(url: string, options: any = {}) {
  return detectBackgroundsFromUrl(url, options)
}

export async function removeBackgroundFromUrl(url: string, options: any = {}) {
  return removeSolidBackgroundsFromUrl(url, options)
}
