/* eslint-disable max-lines */
import Jimp from 'jimp'

export interface PrintableArea {
  x: number
  y: number
  width: number
  height: number
}

interface Rectangle {
  x: number
  y: number
  w: number
  h: number
}

interface Color {
  r: number
  g: number
  b: number
}

/**
 * Optimized largest-inscribed-rectangle using dynamic programming with early termination.
 */
function findLargestRect(mask: boolean[], width: number, height: number, minArea = 0): Rectangle {
  const hist = new Array(width).fill(0)
  let maxArea = minArea
  let bestRect: Rectangle = { x: 0, y: 0, w: 0, h: 0 }

  for (let row = 0; row < height; row++) {
    // Update histogram for this row
    for (let col = 0; col < width; col++) {
      const idx = row * width + col
      hist[col] = mask[idx] ? hist[col] + 1 : 0
    }

    // Find largest rectangle in current histogram
    const rect = largestRectInHistogram(hist, maxArea)
    if (rect.area > maxArea) {
      maxArea = rect.area
      bestRect = {
        x: rect.left,
        y: row - rect.height + 1,
        w: rect.width,
        h: rect.height,
      }
    }
  }

  return bestRect
}

function largestRectInHistogram(
  heights: number[],
  minArea = 0
): { left: number; width: number; height: number; area: number } {
  const stack: number[] = []
  let maxArea = minArea
  let bestRect = { left: 0, width: 0, height: 0, area: maxArea }

  for (let i = 0; i <= heights.length; i++) {
    const h = i === heights.length ? 0 : heights[i]

    while (stack.length > 0 && h < heights[stack[stack.length - 1]]) {
      const height = heights[stack.pop()!]
      const width = stack.length === 0 ? i : i - stack[stack.length - 1] - 1

      // Early termination: skip if this can't beat current best
      if (height * width <= maxArea) continue

      const left = stack.length === 0 ? 0 : stack[stack.length - 1] + 1
      const area = height * width

      if (area > maxArea) {
        maxArea = area
        bestRect = { left, width, height, area }
      }
    }

    stack.push(i)
  }

  return bestRect
}

/**
 * Optimized morphological closing with separable kernel
 */
function morphologicalClosing(mask: boolean[], width: number, height: number, kernelSize: number): boolean[] {
  const halfKernel = Math.floor(kernelSize / 2)

  // Horizontal dilation pass
  const dilatedH = new Array(width * height).fill(false)
  for (let y = 0; y < height; y++) {
    const rowStart = y * width
    for (let x = 0; x < width; x++) {
      const idx = rowStart + x

      // Check horizontal neighborhood
      for (let kx = -halfKernel; kx <= halfKernel; kx++) {
        const nx = x + kx
        if (nx >= 0 && nx < width && mask[rowStart + nx]) {
          dilatedH[idx] = true
          break
        }
      }
    }
  }

  // Vertical dilation pass
  const dilated = new Array(width * height).fill(false)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x

      // Check vertical neighborhood
      for (let ky = -halfKernel; ky <= halfKernel; ky++) {
        const ny = y + ky
        if (ny >= 0 && ny < height && dilatedH[ny * width + x]) {
          dilated[idx] = true
          break
        }
      }
    }
  }

  // Horizontal erosion pass
  const erodedH = new Array(width * height).fill(false)
  for (let y = 0; y < height; y++) {
    const rowStart = y * width
    for (let x = 0; x < width; x++) {
      const idx = rowStart + x

      let allForeground = true
      for (let kx = -halfKernel; kx <= halfKernel; kx++) {
        const nx = x + kx
        if (nx < 0 || nx >= width || !dilated[rowStart + nx]) {
          allForeground = false
          break
        }
      }
      erodedH[idx] = allForeground
    }
  }

  // Vertical erosion pass
  const result = new Array(width * height).fill(false)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x

      let allForeground = true
      for (let ky = -halfKernel; ky <= halfKernel; ky++) {
        const ny = y + ky
        if (ny < 0 || ny >= height || !erodedH[ny * width + x]) {
          allForeground = false
          break
        }
      }
      result[idx] = allForeground
    }
  }

  return result
}

/**
 * Build integral image (summed area table) for fast area-sum queries on boolean mask
 */
function buildIntegralImage(mask: boolean[], width: number, height: number): Uint32Array {
  const integral = new Uint32Array((width + 1) * (height + 1))

  for (let y = 1; y <= height; y++) {
    let rowSum = 0
    const srcRowOffset = (y - 1) * width
    const dstRowOffset = y * (width + 1)
    for (let x = 1; x <= width; x++) {
      rowSum += mask[srcRowOffset + (x - 1)] ? 1 : 0
      const above = integral[dstRowOffset - (width + 1) + x]
      integral[dstRowOffset + x] = rowSum + above
    }
  }

  return integral
}

/**
 * Query sum of 1s inside rectangle using integral image
 */
function sumRegion(integral: Uint32Array, width: number, x: number, y: number, w: number, h: number): number {
  const ix = x
  const iy = y
  const ax = ix
  const ay = iy
  const bx = ix + w
  const by = iy + h
  const stride = width + 1

  const A = integral[ay * stride + ax]
  const B = integral[ay * stride + bx]
  const C = integral[by * stride + ax]
  const D = integral[by * stride + bx]
  return D - B - C + A
}

/**
 * Given a starting rectangle, search nearby positions to maximize foreground density
 * with a soft bias toward the image vertical lower-center to avoid selecting headers/necklaces.
 */
function refineRectPlacement(
  mask: boolean[],
  width: number,
  height: number,
  start: { x: number; y: number; w: number; h: number },
  desiredAspect: number,
  yMinLimit: number = 0,
  yMaxLimit?: number
): { x: number; y: number; w: number; h: number } {
  const integral = buildIntegralImage(mask, width, height)
  const imageCx = width / 2
  const imageCy = height / 2
  const diag = Math.sqrt(imageCx * imageCx + imageCy * imageCy)

  // Allow slight size adjustments to better match aspect
  const w = start.w
  let h = start.h
  const currentAspect = Math.max(0.1, w / Math.max(1, h))
  if (Math.abs(currentAspect - desiredAspect) > desiredAspect * 0.25) {
    // Nudge height to approach desired aspect but keep within bounds
    h = Math.min(height - 2, Math.max(10, Math.round(w / desiredAspect)))
  }

  const step = Math.max(3, Math.round(Math.min(width, height) / 80))
  const xMin = 0
  const yMin = Math.max(0, Math.min(height - h, Math.round(yMinLimit)))
  const xMax = Math.max(0, width - w)
  const yMaxHard = Math.max(0, height - h)
  const yMax = Math.min(yMaxHard, yMaxLimit ?? Math.round(height * 0.68))

  let best = { x: Math.min(start.x, xMax), y: Math.min(start.y, yMax), w, h }
  let bestScore = -1

  // Vertical bias: if limits provided, aim near the middle of the allowed band.
  const vTarget = yMaxLimit !== undefined ? (yMin + yMax) / 2 : 0.6 * height
  const vSigma = yMaxLimit !== undefined ? Math.max(6, 0.35 * (yMax - yMin)) : 0.18 * height

  for (let y = yMin; y <= yMax; y += step) {
    for (let x = xMin; x <= xMax; x += step) {
      const ones = sumRegion(integral, width, x, y, w, h)
      const area = w * h
      const density = ones / area

      // Penalize rectangles whose foreground concentrates in the top band (e.g., mug rim)
      const bandH = Math.max(1, Math.round(h * 0.15))
      const topOnes = sumRegion(integral, width, x, y, w, bandH)
      const topConcentration = topOnes / Math.max(1, ones)
      const topPenalty = Math.exp(-2.0 * topConcentration)

      const cx = x + w / 2
      const cy = y + h / 2

      // Keep a mild central bias
      const centerSigma = 0.28 * diag
      const dist = Math.sqrt((cx - imageCx) ** 2 + (cy - imageCy) ** 2)
      const centerWeight = Math.exp(-(dist * dist) / (2 * centerSigma * centerSigma))

      // Vertical preference toward 60% height (below true center)
      const vDelta = cy - vTarget
      const vWeight = Math.exp(-(vDelta * vDelta) / (2 * vSigma * vSigma))

      const score = (density * 0.5 * centerWeight + density * 0.5 * vWeight) * topPenalty

      if (score > bestScore) {
        bestScore = score
        best = { x, y, w, h }
      }
    }
  }

  return best
}

/**
 * Estimate a top exclusion band when there is a strong horizontal structure near the top
 * (e.g., mug rims, necklace text headers). Returns the Y coordinate below which we should start searching.
 */
function estimateTopExclusion(mask: boolean[], width: number, height: number): number {
  const xStart = Math.floor(width * 0.2)
  const xEnd = Math.ceil(width * 0.8)
  const bandWidth = xEnd - xStart
  if (bandWidth <= 0) return 0

  const maxY = Math.floor(height * 0.5)
  const densities: number[] = new Array(maxY).fill(0)
  for (let y = 0; y < maxY; y++) {
    let cnt = 0
    const rowOffset = y * width
    for (let x = xStart; x < xEnd; x++) {
      if (mask[rowOffset + x]) cnt++
    }
    densities[y] = cnt / bandWidth
  }

  // Smooth (moving average size 5)
  const smoothed: number[] = new Array(maxY).fill(0)
  const win = 5
  for (let y = 0; y < maxY; y++) {
    let sum = 0
    let count = 0
    for (let k = -Math.floor(win / 2); k <= Math.floor(win / 2); k++) {
      const yy = y + k
      if (yy >= 0 && yy < maxY) {
        sum += densities[yy]
        count++
      }
    }
    smoothed[y] = sum / Math.max(1, count)
  }

  // Compute mean and std
  let mean = 0
  for (let y = 0; y < maxY; y++) mean += smoothed[y]
  mean /= Math.max(1, maxY)
  let variance = 0
  for (let y = 0; y < maxY; y++) variance += (smoothed[y] - mean) * (smoothed[y] - mean)
  variance /= Math.max(1, maxY)
  const std = Math.sqrt(variance)

  const threshold = mean + 1.6 * std
  // Find first strong run starting near the top
  let runStart = -1
  for (let y = 0; y < maxY; y++) {
    if (smoothed[y] > threshold) {
      if (runStart === -1) runStart = y
    } else if (runStart !== -1) {
      const runEnd = y - 1
      // Accept if run begins within top 25% height
      if (runStart <= Math.floor(height * 0.33)) {
        const exclusion = Math.min(Math.floor(height * 0.5), runEnd + Math.floor(height * 0.06))
        return exclusion
      }
      runStart = -1
    }
  }

  return 0
}

/**
 * Center-biased rectangle search that prefers dense foreground near image center.
 * Helpful for cases like pendants/lockets where the printable area is a central oval.
 */
function findBestCentralRect(
  mask: boolean[],
  width: number,
  height: number,
  desiredAspect: number
): { x: number; y: number; w: number; h: number } {
  const integral = buildIntegralImage(mask, width, height)

  const imageCx = width / 2
  const imageCy = height / 2
  const diag = Math.sqrt(imageCx * imageCx + imageCy * imageCy)

  let bestScore = -1
  let best = { x: 0, y: 0, w: Math.max(1, Math.round(width * 0.4)), h: Math.max(1, Math.round(height * 0.5)) }

  // Search a range of sizes around common product print areas
  const minH = Math.max(10, Math.round(height * 0.25))
  const maxH = Math.max(minH + 1, Math.round(height * 0.8))
  const stepH = Math.max(6, Math.round((maxH - minH) / 8))
  const stepPos = Math.max(4, Math.round(Math.min(width, height) / 50))

  for (let h = minH; h <= maxH; h += stepH) {
    let w = Math.round(h * desiredAspect)
    if (w < 10) w = 10
    if (w >= width) w = width - 1
    if (h >= height) h = height - 1
    for (let y = 0; y <= height - h; y += stepPos) {
      for (let x = 0; x <= width - w; x += stepPos) {
        const ones = sumRegion(integral, width, x, y, w, h)
        const area = w * h
        const density = ones / area

        // Center bias using Gaussian-like falloff
        const cx = x + w / 2
        const cy = y + h / 2
        const dist = Math.sqrt((cx - imageCx) * (cx - imageCx) + (cy - imageCy) * (cy - imageCy))
        const sigma = 0.28 * diag
        const centerWeight = Math.exp(-(dist * dist) / (2 * sigma * sigma))

        // Prefer tall-ish areas mildly to avoid very wide selections for pendants
        const aspect = w / h
        const aspectPenalty = Math.exp(-Math.pow((aspect - desiredAspect) / (desiredAspect * 0.5), 2))

        const score = density * centerWeight * aspectPenalty

        if (score > bestScore) {
          bestScore = score
          best = { x, y, w, h }
        }
      }
    }
  }

  return best
}

/**
 * Fast corner sampling using single pass
 */
function sampleCornerColors(image: Jimp, width: number, height: number): Color[] {
  const cornerSize = 5
  const corners = [
    { x: 0, y: 0 },
    { x: width - cornerSize, y: 0 },
    { x: 0, y: height - cornerSize },
    { x: width - cornerSize, y: height - cornerSize },
  ]

  return corners.map(corner => {
    let r = 0,
      g = 0,
      b = 0,
      count = 0

    for (let dy = 0; dy < cornerSize; dy++) {
      for (let dx = 0; dx < cornerSize; dx++) {
        const x = Math.min(corner.x + dx, width - 1)
        const y = Math.min(corner.y + dy, height - 1)
        const color = Jimp.intToRGBA(image.getPixelColor(x, y))
        r += color.r
        g += color.g
        b += color.b
        count++
      }
    }

    return { r: r / count, g: g / count, b: b / count }
  })
}

/**
 * Estimate the row just below the inner-rim of a cylindrical object (e.g., mug)
 * by analyzing grayscale row averages and their vertical derivatives in the
 * central band of the image. Returns a Y coordinate (in pixels) below which
 * we should prefer placing the rectangle.
 */
function estimateCylindricalRimBoundaryY(image: Jimp, width: number, height: number): number {
  const xStart = Math.floor(width * 0.28)
  const xEnd = Math.ceil(width * 0.72)
  const bandWidth = Math.max(1, xEnd - xStart)
  const maxY = Math.floor(height * 0.6)
  if (maxY <= 3) return 0

  const rowAvg: number[] = new Array(maxY).fill(0)
  for (let y = 0; y < maxY; y++) {
    let sum = 0
    for (let x = xStart; x < xEnd; x++) {
      const c = Jimp.intToRGBA(image.getPixelColor(x, y))
      const gray = Math.round(0.299 * c.r + 0.587 * c.g + 0.114 * c.b)
      sum += gray
    }
    rowAvg[y] = sum / bandWidth
  }

  // Smooth with window size 5
  const smooth: number[] = new Array(maxY).fill(0)
  const win = 5
  const half = Math.floor(win / 2)
  for (let y = 0; y < maxY; y++) {
    let s = 0
    let count = 0
    for (let k = -half; k <= half; k++) {
      const yy = y + k
      if (yy >= 0 && yy < maxY) {
        s += rowAvg[yy]
        count++
      }
    }
    smooth[y] = s / Math.max(1, count)
  }

  // Derivative (positive jump from dark to light)
  let bestY = -1
  let bestVal = 0
  for (let y = 1; y < maxY; y++) {
    const deriv = smooth[y] - smooth[y - 1]
    const wasDark = smooth[Math.max(0, y - 1)] < 130
    if (wasDark && deriv > bestVal) {
      bestVal = deriv
      bestY = y
    }
  }

  if (bestY !== -1) {
    const margin = Math.floor(height * 0.06)
    return Math.min(Math.floor(height * 0.55), bestY + margin)
  }
  return 0
}

/**
 * Estimate neckline boundary for apparel (e.g., t-shirt) using grayscale row transitions
 * within a central band. Returns a Y coordinate below which we should start searching.
 */
function estimateNecklineBoundaryY(image: Jimp, width: number, height: number): number {
  const xStart = Math.floor(width * 0.35)
  const xEnd = Math.ceil(width * 0.65)
  const bandWidth = Math.max(1, xEnd - xStart)
  const searchTop = Math.floor(height * 0.1)
  const searchBottom = Math.floor(height * 0.6)
  if (searchBottom - searchTop <= 3) return 0

  const rowAvg: number[] = new Array(searchBottom - searchTop).fill(0)
  for (let yy = searchTop; yy < searchBottom; yy++) {
    let sum = 0
    for (let x = xStart; x < xEnd; x++) {
      const c = Jimp.intToRGBA(image.getPixelColor(x, yy))
      const gray = Math.round(0.299 * c.r + 0.587 * c.g + 0.114 * c.b)
      sum += gray
    }
    rowAvg[yy - searchTop] = sum / bandWidth
  }

  // Smooth with small window
  const win = 7
  const half = Math.floor(win / 2)
  const smooth: number[] = new Array(rowAvg.length).fill(0)
  for (let i = 0; i < rowAvg.length; i++) {
    let s = 0
    let count = 0
    for (let k = -half; k <= half; k++) {
      const ii = i + k
      if (ii >= 0 && ii < rowAvg.length) {
        s += rowAvg[ii]
        count++
      }
    }
    smooth[i] = s / Math.max(1, count)
  }

  // Look for the strongest derivative (neckline contrast)
  let bestIdx = -1
  let bestDeriv = 0
  for (let i = 1; i < smooth.length; i++) {
    const deriv = Math.abs(smooth[i] - smooth[i - 1])
    if (deriv > bestDeriv) {
      bestDeriv = deriv
      bestIdx = i
    }
  }

  if (bestIdx !== -1) {
    const y = searchTop + bestIdx
    const margin = Math.floor(height * 0.05)
    // Cap so we don't push start too low for apparel
    return Math.min(Math.floor(height * 0.48), y + margin)
  }
  return 0
}

/**
 * Shrink rectangle slightly for cylindrical surfaces so the render stays inside the visible body.
 */
function shrinkRectForCylindrical(
  rect: { x: number; y: number; w: number; h: number },
  width: number,
  height: number,
  yMinLimit: number
): { x: number; y: number; w: number; h: number } {
  const shrinkX = 0.9
  const shrinkY = 0.92
  const newW = Math.max(10, Math.round(rect.w * shrinkX))
  const newH = Math.max(10, Math.round(rect.h * shrinkY))

  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  let x = Math.round(cx - newW / 2)
  let y = Math.round(cy - newH / 2)

  // Respect limits and image bounds
  x = Math.max(0, Math.min(width - newW, x))
  y = Math.max(yMinLimit, Math.min(height - newH, y))

  return { x, y, w: newW, h: newH }
}

/**
 * Calculate color distance squared (avoid sqrt for performance)
 */
function colorDistanceSquared(c1: Color, c2: Color): number {
  return Math.pow(c1.r - c2.r, 2) + Math.pow(c1.g - c2.g, 2) + Math.pow(c1.b - c2.b, 2)
}

/**
 * Optimized edge detection using pre-computed gradients
 */
function detectEdgesOptimized(
  image: Jimp,
  width: number,
  height: number,
  threshold: number
): { mask: boolean[]; foregroundPixels: number } {
  const mask = new Array(width * height).fill(false)
  let foregroundPixels = 0

  // Pre-compute grayscale values for better cache locality
  const grayValues = new Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      const color = Jimp.intToRGBA(image.getPixelColor(x, y))
      grayValues[idx] = Math.round(0.299 * color.r + 0.587 * color.g + 0.114 * color.b)
    }
  }

  // Apply edge detection with pre-computed values
  for (let y = 1; y < height - 1; y++) {
    const rowOffset = y * width
    const prevRowOffset = (y - 1) * width
    const nextRowOffset = (y + 1) * width

    for (let x = 1; x < width - 1; x++) {
      // Sobel operators using pre-computed grayscale
      const tl = grayValues[prevRowOffset + x - 1]
      const tm = grayValues[prevRowOffset + x]
      const tr = grayValues[prevRowOffset + x + 1]
      const ml = grayValues[rowOffset + x - 1]
      const mr = grayValues[rowOffset + x + 1]
      const bl = grayValues[nextRowOffset + x - 1]
      const bm = grayValues[nextRowOffset + x]
      const br = grayValues[nextRowOffset + x + 1]

      const gx = -tl + tr - 2 * ml + 2 * mr - bl + br
      const gy = -tl - 2 * tm - tr + bl + 2 * bm + br
      const magnitude = Math.sqrt(gx * gx + gy * gy)

      const idx = rowOffset + x
      if (magnitude > threshold) {
        mask[idx] = true
        foregroundPixels++
      }
    }
  }

  return { mask, foregroundPixels }
}

/**
 * Create fallback rectangular area
 */
function createFallbackArea(width: number, height: number): boolean[] {
  const mask = new Array(width * height).fill(false)

  const centerW = Math.round(width * 0.4)
  const centerH = Math.round(height * 0.5)
  const centerX = Math.round((width - centerW) / 2)
  const centerY = Math.round((height - centerH) / 2)

  for (let y = centerY; y < centerY + centerH; y++) {
    const rowOffset = y * width
    for (let x = centerX; x < centerX + centerW; x++) {
      mask[rowOffset + x] = true
    }
  }

  return mask
}

/**
 * Optimized printable area detection
 */
export async function detectPrintableArea(
  imgBuf: Buffer,
  desiredAspect = 4 / 5,
  opts?: { debug?: boolean }
): Promise<PrintableArea> {
  try {
    const image = await Jimp.read(imgBuf)
    const { width, height } = image.bitmap

    // Adaptive sizing based on image size
    const maxSize = width * height > 1000000 ? 300 : 400 // Smaller analysis size for large images
    const scale = Math.min(maxSize / width, maxSize / height)
    const analyzeW = Math.round(width * scale)
    const analyzeH = Math.round(height * scale)

    const resized = image.resize(analyzeW, analyzeH)

    // Fast corner color sampling
    const cornerColors = sampleCornerColors(resized, analyzeW, analyzeH)

    // Calculate average corner color
    const avgCorner = cornerColors.reduce(
      (acc, color) => ({
        r: acc.r + color.r / cornerColors.length,
        g: acc.g + color.g / cornerColors.length,
        b: acc.b + color.b / cornerColors.length,
      }),
      { r: 0, g: 0, b: 0 }
    )

    // Check background uniformity using squared distances
    const threshold = 50 * 50 // Square the threshold to avoid sqrt
    const isUniformBackground = cornerColors.every(color => colorDistanceSquared(color, avgCorner) < threshold)

    let mask: boolean[]

    let usedGeometricDetection = false

    if (isUniformBackground) {
      // Background detection mode

      const bgThresholdSq = 40 * 40 // Squared threshold
      mask = new Array(analyzeW * analyzeH).fill(false)

      for (let y = 0; y < analyzeH; y++) {
        const rowOffset = y * analyzeW
        for (let x = 0; x < analyzeW; x++) {
          const color = Jimp.intToRGBA(resized.getPixelColor(x, y))
          const distSq = colorDistanceSquared(color, avgCorner)

          const idx = rowOffset + x
          if (distSq > bgThresholdSq) {
            mask[idx] = true
          }
        }
      }

      // Light morphological closing to fill gaps and create solid regions
      mask = morphologicalClosing(mask, analyzeW, analyzeH, 3)
    } else {
      // Multi-threshold edge detection

      const thresholds = [15, 25, 35] // Reduced number of thresholds
      let bestMask: boolean[] = []
      let bestArea = 0

      for (const edgeThreshold of thresholds) {
        const { mask: tempMask } = detectEdgesOptimized(resized, analyzeW, analyzeH, edgeThreshold)

        // Apply morphological closing
        const closedMask = morphologicalClosing(tempMask, analyzeW, analyzeH, 3)

        // Find largest rectangle
        const tempRect = findLargestRect(closedMask, analyzeW, analyzeH, bestArea)
        const tempArea = tempRect.w * tempRect.h

        if (tempArea > bestArea) {
          bestArea = tempArea
          bestMask = closedMask
        }
      }

      // Fallback to geometric detection if needed
      if (bestArea < analyzeW * analyzeH * 0.05) {
        mask = createFallbackArea(analyzeW, analyzeH)
        usedGeometricDetection = true
      } else {
        mask = bestMask
      }
    }

    // Find the printable rectangle
    let rect: Rectangle
    if (usedGeometricDetection) {
      // Find bounds of the geometric area
      let minX = analyzeW,
        maxX = 0,
        minY = analyzeH,
        maxY = 0
      for (let y = 0; y < analyzeH; y++) {
        const rowOffset = y * analyzeW
        for (let x = 0; x < analyzeW; x++) {
          if (mask[rowOffset + x]) {
            minX = Math.min(minX, x)
            maxX = Math.max(maxX, x)
            minY = Math.min(minY, y)
            maxY = Math.max(maxY, y)
          }
        }
      }
      rect = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
    } else {
      const originalRect = findLargestRect(mask, analyzeW, analyzeH)

      // Smart correction for thin rectangles
      const heightPercent = originalRect.h / analyzeH
      const aspectRatio = originalRect.h / Math.max(1, originalRect.w)

      let corrected = originalRect
      if (heightPercent < 0.2 || aspectRatio < 0.3) {
        const targetW = Math.max(1, originalRect.w)
        const targetH = Math.min(Math.round(targetW * 1.3), Math.round(analyzeH * 0.6))

        // Find optimal Y position
        let bestY = originalRect.y
        let maxPixelsInRange = 0

        for (let testY = 0; testY <= analyzeH - targetH; testY++) {
          let pixelCount = 0
          for (let y = testY; y < testY + targetH; y++) {
            const rowOffset = y * analyzeW
            for (let x = originalRect.x; x < originalRect.x + targetW && x < analyzeW; x++) {
              if (mask[rowOffset + x]) pixelCount++
            }
          }

          if (pixelCount > maxPixelsInRange) {
            maxPixelsInRange = pixelCount
            bestY = testY
          }
        }

        corrected = { x: originalRect.x, y: bestY, w: targetW, h: targetH }
      }

      // If the rectangle is too small or too off-center (common failure case on jewelry)
      const areaFrac = (corrected.w * corrected.h) / (analyzeW * analyzeH)
      const cx = corrected.x + corrected.w / 2
      const cy = corrected.y + corrected.h / 2
      const imageCx = analyzeW / 2
      const imageCy = analyzeH / 2
      const distCenter = Math.hypot(cx - imageCx, cy - imageCy) / Math.hypot(imageCx, imageCy)

      if (areaFrac < 0.03 || distCenter > 0.35) {
        const bestCentral = findBestCentralRect(mask, analyzeW, analyzeH, desiredAspect)
        const centralArea = bestCentral.w * bestCentral.h
        if (centralArea > corrected.w * corrected.h * 0.8) {
          rect = bestCentral
        } else {
          rect = corrected
        }
      } else {
        rect = corrected
      }
    }

    // Additional refinement to avoid selecting rims/headers. Estimate a top exclusion and bias lower.
    const topExclusionMask = estimateTopExclusion(mask, analyzeW, analyzeH)
    const topExclusionRim = estimateCylindricalRimBoundaryY(resized, analyzeW, analyzeH)
    const topExclusionNeckline = estimateNecklineBoundaryY(resized, analyzeW, analyzeH)
    // Use conservative caps so exclusions don't force us too low
    const topExclusion = Math.max(
      topExclusionMask,
      Math.round(Math.min(topExclusionRim, Math.round(analyzeH * 0.52))),
      Math.round(Math.min(topExclusionNeckline, Math.round(analyzeH * 0.48)))
    )
    const yMaxLimit = Math.round(analyzeH * 0.68)
    let refined = refineRectPlacement(mask, analyzeW, analyzeH, rect, desiredAspect, topExclusion, yMaxLimit)

    // If we detected a rim, assume cylindrical and shrink slightly to avoid oversize
    if (topExclusionRim > 0) {
      refined = shrinkRectForCylindrical(refined, analyzeW, analyzeH, topExclusion)
    }

    if (opts?.debug) {
      // Log key diagnostics to tune heuristics
      console.debug('[PrintableArea] analyze', { width, height, analyzeW, analyzeH, isUniformBackground })
      console.debug('[PrintableArea] rects', { rectInitial: rect })
      console.debug('[PrintableArea] exclusions', {
        topExclusionMask,
        topExclusionRim,
        topExclusionNeckline,
        topExclusion,
        yMaxLimit,
      })
      console.debug('[PrintableArea] refined', { refined })
    }

    // Scale back to original coordinates
    const scaleX = width / analyzeW
    const scaleY = height / analyzeH

    const result: PrintableArea = {
      x: Math.round(refined.x * scaleX),
      y: Math.round(refined.y * scaleY),
      width: Math.round(refined.w * scaleX),
      height: Math.round(refined.h * scaleY),
    }

    if (opts?.debug) {
      console.debug('[PrintableArea] result', result)
    }

    return result
  } catch (error) {
    console.error('Error in detectPrintableArea:', error)
    throw new Error(`Failed to detect printable area: ${error instanceof Error ? error.message : String(error)}`)
  }
}
