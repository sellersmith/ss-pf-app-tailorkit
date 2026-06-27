/* eslint-disable max-lines */
/**
 * SVG Envelope Distortion Algorithm
 *
 * Text fills a closed shape using segment-based distortion with clipping.
 * Algorithm:
 * 1. Sample the shape path very densely into points
 * 2. Build a lookup table of min/max Y for each X position
 * 3. Divide shape width into segments (one per character)
 * 4. For each character, stretch to fill the shape height at that X
 * 5. Use shape as a clip mask for exact formation
 */

import { parseSvgPath, serializePathCommands, type PathCommand } from './svg-path-utils'
import { isEllipticalShape, isCurvedShape } from './svg-envelope-boundary'

export interface TextMetrics {
  text: string
  fontSize: number
  fontFamily: string
  fontWeight?: string | number
  letterSpacing?: number
  lineHeight?: number
}

export interface WarpedCharacter {
  char: string
  x: number
  y: number
  scaleX: number
  scaleY: number
  fontSize: number
  segmentTopY: number
  segmentBottomY: number
}

export interface WarpedLine {
  y: number
  characters: WarpedCharacter[]
  lineWidth: number
  shapeWidth: number
}

export interface EnvelopeDistortionResult {
  lines: WarpedLine[]
  bounds: {
    minX: number
    maxX: number
    minY: number
    maxY: number
  }
  clipPath: string
}

export interface ShapeBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
  width: number
  height: number
}

interface Point {
  x: number
  y: number
}

interface PolygonVertex {
  x: number
  y: number
}

/**
 * Extract all vertices from a polygon path (works for any N-sided polygon)
 */
function extractPolygonVertices(commands: PathCommand[]): PolygonVertex[] | null {
  const vertices: PolygonVertex[] = []

  for (const cmd of commands) {
    const type = cmd.type.toUpperCase()
    // Include H (horizontal line) and V (vertical line) commands as they also create vertices
    // parseSvgPath normalizes these to have both x and y coordinates
    if (type === 'M' || type === 'L' || type === 'H' || type === 'V') {
      if (isFinite(cmd.x) && isFinite(cmd.y)) {
        vertices.push({ x: cmd.x, y: cmd.y })
      }
    }
  }

  // Need at least 3 vertices for a polygon
  if (vertices.length < 3) return null
  return vertices
}

/**
 * Get the Y bounds at a specific X position within any polygon
 * Uses direct line intersection calculation for accuracy
 */
function getPolygonHeightAtX(vertices: PolygonVertex[], x: number): { topY: number; bottomY: number } | null {
  if (vertices.length < 3) return null

  // Find all Y values where the polygon edges intersect the vertical line at X
  const yIntersections: number[] = []

  // Build edges from vertices (connect each vertex to the next, and last to first)
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i]
    const b = vertices[(i + 1) % vertices.length]

    // Check if X is within this edge's X range
    const minX = Math.min(a.x, b.x)
    const maxX = Math.max(a.x, b.x)

    if (x >= minX && x <= maxX) {
      // Calculate Y at this X using linear interpolation
      if (Math.abs(b.x - a.x) < 0.001) {
        // Vertical edge - X matches exactly, add both Y values
        yIntersections.push(a.y, b.y)
      } else {
        // Non-vertical edge - interpolate
        const t = (x - a.x) / (b.x - a.x)
        const y = a.y + t * (b.y - a.y)
        yIntersections.push(y)
      }
    }
  }

  if (yIntersections.length === 0) return null

  // Return min and max Y (topY is min because Y increases downward in SVG)
  const topY = Math.min(...yIntersections)
  const bottomY = Math.max(...yIntersections)

  return { topY, bottomY }
}

// ============================================================================
// Path Sampling - Very Dense Sampling for All Path Types
// ============================================================================

/**
 * Sample a cubic bezier curve
 */
function sampleCubicBezier(
  x0: number,
  y0: number,
  cp1x: number,
  cp1y: number,
  cp2x: number,
  cp2y: number,
  x: number,
  y: number,
  samples: number
): Point[] {
  const points: Point[] = []
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const mt = 1 - t
    const mt2 = mt * mt
    const mt3 = mt2 * mt
    const t2 = t * t
    const t3 = t2 * t
    points.push({
      x: mt3 * x0 + 3 * mt2 * t * cp1x + 3 * mt * t2 * cp2x + t3 * x,
      y: mt3 * y0 + 3 * mt2 * t * cp1y + 3 * mt * t2 * cp2y + t3 * y,
    })
  }
  return points
}

/**
 * Sample a quadratic bezier curve
 */
function sampleQuadraticBezier(
  x0: number,
  y0: number,
  cpx: number,
  cpy: number,
  x: number,
  y: number,
  samples: number
): Point[] {
  const points: Point[] = []
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const mt = 1 - t
    points.push({
      x: mt * mt * x0 + 2 * mt * t * cpx + t * t * x,
      y: mt * mt * y0 + 2 * mt * t * cpy + t * t * y,
    })
  }
  return points
}

/**
 * Sample a line segment
 */
function sampleLine(x0: number, y0: number, x: number, y: number, samples: number): Point[] {
  const points: Point[] = []
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    points.push({
      x: x0 + t * (x - x0),
      y: y0 + t * (y - y0),
    })
  }
  return points
}

/**
 * Sample an elliptical arc - CRITICAL for circles/ellipses
 * Uses parametric ellipse equation directly instead of endpoint-to-center conversion
 * Based on SVG spec: https://www.w3.org/TR/SVG/implnote.html#ArcImplementationNotes
 */
function sampleEllipticalArc(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rx: number,
  ry: number,
  xAxisRotation: number,
  largeArcFlag: boolean,
  sweepFlag: boolean,
  samples: number
): Point[] {
  // Handle degenerate case: start and end are the same
  if (Math.abs(x1 - x2) < 0.001 && Math.abs(y1 - y2) < 0.001) {
    return [{ x: x1, y: y1 }]
  }

  // Handle degenerate case: zero or very small radii
  if (rx < 0.001 || ry < 0.001) {
    return sampleLine(x1, y1, x2, y2, samples)
  }

  // Ensure radii are positive
  rx = Math.abs(rx)
  ry = Math.abs(ry)

  // Convert rotation to radians
  const phi = (xAxisRotation * Math.PI) / 180
  const cosPhi = Math.cos(phi)
  const sinPhi = Math.sin(phi)

  // Step 1: Compute (x1', y1') - transformed start point
  const dx = (x1 - x2) / 2
  const dy = (y1 - y2) / 2

  const x1p = cosPhi * dx + sinPhi * dy
  const y1p = -sinPhi * dx + cosPhi * dy

  // Step 2: Correct radii if necessary (ensure arc can reach endpoints)
  const x1pSq = x1p * x1p
  const y1pSq = y1p * y1p
  let rxSq = rx * rx
  let rySq = ry * ry

  const lambda = x1pSq / rxSq + y1pSq / rySq
  if (lambda > 1) {
    const sqrtLambda = Math.sqrt(lambda)
    rx *= sqrtLambda
    ry *= sqrtLambda
    rxSq = rx * rx
    rySq = ry * ry
  }

  // Step 3: Compute center point (cx', cy') in transformed coordinates
  const denominator = rxSq * y1pSq + rySq * x1pSq
  if (denominator < 0.0001) {
    // Degenerate case: fall back to line
    return sampleLine(x1, y1, x2, y2, samples)
  }

  let sq = (rxSq * rySq - rxSq * y1pSq - rySq * x1pSq) / denominator
  if (sq < 0) sq = 0 // Numerical precision fix
  let coef = Math.sqrt(sq)
  if (largeArcFlag === sweepFlag) coef = -coef

  const cxp = coef * ((rx * y1p) / ry)
  const cyp = coef * ((-ry * x1p) / rx)

  // Validate computed values
  if (!isFinite(cxp) || !isFinite(cyp)) {
    return sampleLine(x1, y1, x2, y2, samples)
  }

  // Step 4: Compute center point (cx, cy) in original coordinates
  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2

  // Step 5: Compute start angle (theta1)
  const ux = (x1p - cxp) / rx
  const uy = (y1p - cyp) / ry

  let n = Math.sqrt(ux * ux + uy * uy)
  if (n < 0.0001) n = 0.0001
  let c = ux / n
  c = Math.max(-1, Math.min(1, c)) // Clamp to [-1, 1]
  let theta1 = Math.acos(c)
  if (uy < 0) theta1 = -theta1

  // Step 6: Compute delta angle (dtheta)
  const vx = (-x1p - cxp) / rx
  const vy = (-y1p - cyp) / ry

  n = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy))
  if (n < 0.0001) n = 0.0001
  c = (ux * vx + uy * vy) / n
  c = Math.max(-1, Math.min(1, c)) // Clamp to [-1, 1]
  let dtheta = Math.acos(c)
  if (ux * vy - uy * vx < 0) dtheta = -dtheta

  // Adjust for sweep direction
  if (sweepFlag && dtheta < 0) {
    dtheta += 2 * Math.PI
  } else if (!sweepFlag && dtheta > 0) {
    dtheta -= 2 * Math.PI
  }

  // Validate angles
  if (!isFinite(theta1) || !isFinite(dtheta)) {
    return sampleLine(x1, y1, x2, y2, samples)
  }

  // Step 7: Generate points along the arc
  const points: Point[] = []
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const angle = theta1 + t * dtheta

    // Point on unit circle
    const cosAngle = Math.cos(angle)
    const sinAngle = Math.sin(angle)

    // Scale to ellipse and rotate back
    const xp = rx * cosAngle
    const yp = ry * sinAngle

    // Rotate and translate to final position
    const px = cosPhi * xp - sinPhi * yp + cx
    const py = sinPhi * xp + cosPhi * yp + cy

    // Only add valid points
    if (isFinite(px) && isFinite(py)) {
      points.push({ x: px, y: py })
    }
  }

  // If we got no valid points, fall back to line
  if (points.length === 0) {
    return sampleLine(x1, y1, x2, y2, samples)
  }

  return points
}

/**
 * Sample the entire path into a very dense set of points
 */
function samplePath(commands: PathCommand[]): Point[] {
  const points: Point[] = []
  let currentX = 0
  let currentY = 0
  let startX = 0
  let startY = 0

  // Use high sample count for accuracy
  const SAMPLES_PER_SEGMENT = 200

  for (const cmd of commands) {
    const type = cmd.type.toUpperCase()

    // Skip commands with invalid coordinates
    if (type !== 'Z' && (!isFinite(cmd.x) || !isFinite(cmd.y))) {
      continue
    }

    switch (type) {
      case 'M':
        currentX = cmd.x
        currentY = cmd.y
        startX = cmd.x
        startY = cmd.y
        points.push({ x: currentX, y: currentY })
        break

      case 'L':
      case 'H':
      case 'V':
        points.push(...sampleLine(currentX, currentY, cmd.x, cmd.y, SAMPLES_PER_SEGMENT))
        currentX = cmd.x
        currentY = cmd.y
        break

      case 'C':
        if (cmd.cp1 && cmd.cp2) {
          points.push(
            ...sampleCubicBezier(
              currentX,
              currentY,
              cmd.cp1.x,
              cmd.cp1.y,
              cmd.cp2.x,
              cmd.cp2.y,
              cmd.x,
              cmd.y,
              SAMPLES_PER_SEGMENT
            )
          )
        } else {
          // Fallback to line if control points missing
          points.push(...sampleLine(currentX, currentY, cmd.x, cmd.y, SAMPLES_PER_SEGMENT))
        }
        currentX = cmd.x
        currentY = cmd.y
        break

      case 'S':
        if (cmd.cp1 && cmd.cp2) {
          points.push(
            ...sampleCubicBezier(
              currentX,
              currentY,
              cmd.cp1.x,
              cmd.cp1.y,
              cmd.cp2.x,
              cmd.cp2.y,
              cmd.x,
              cmd.y,
              SAMPLES_PER_SEGMENT
            )
          )
        } else if (cmd.cp2) {
          // If only cp2, use current position for cp1
          points.push(
            ...sampleCubicBezier(
              currentX,
              currentY,
              currentX,
              currentY,
              cmd.cp2.x,
              cmd.cp2.y,
              cmd.x,
              cmd.y,
              SAMPLES_PER_SEGMENT
            )
          )
        } else {
          points.push(...sampleLine(currentX, currentY, cmd.x, cmd.y, SAMPLES_PER_SEGMENT))
        }
        currentX = cmd.x
        currentY = cmd.y
        break

      case 'Q':
      case 'T':
        if (cmd.cp) {
          points.push(
            ...sampleQuadraticBezier(currentX, currentY, cmd.cp.x, cmd.cp.y, cmd.x, cmd.y, SAMPLES_PER_SEGMENT)
          )
        } else {
          // Fallback to line if control point missing
          points.push(...sampleLine(currentX, currentY, cmd.x, cmd.y, SAMPLES_PER_SEGMENT))
        }
        currentX = cmd.x
        currentY = cmd.y
        break

      case 'A':
        // Use extra samples for arcs (critical for circles/ellipses)
        {
          const arcPoints = sampleEllipticalArc(
            currentX,
            currentY,
            cmd.x,
            cmd.y,
            cmd.rx || 0,
            cmd.ry || 0,
            cmd.rotation || 0,
            cmd.largeArc || false,
            cmd.sweep || false,
            SAMPLES_PER_SEGMENT * 2
          )
          points.push(...arcPoints)
        }
        currentX = cmd.x
        currentY = cmd.y
        break

      case 'Z':
        if (Math.abs(currentX - startX) > 0.1 || Math.abs(currentY - startY) > 0.1) {
          points.push(...sampleLine(currentX, currentY, startX, startY, SAMPLES_PER_SEGMENT))
        }
        currentX = startX
        currentY = startY
        break
    }
  }

  // Filter out any invalid points
  return points.filter(p => isFinite(p.x) && isFinite(p.y))
}

// ============================================================================
// Shape Lookup Tables
// ============================================================================

interface HeightLookup {
  minX: number
  maxX: number
  minY: number
  maxY: number
  width: number
  height: number
  // Map from X bucket index to {minY, maxY}
  buckets: Map<number, { minY: number; maxY: number }>
  bucketWidth: number
  numBuckets: number // Total number of buckets for proper index clamping
}

/**
 * Build a lookup table for shape height at each X position
 * This is much more robust than ray casting
 */
function buildHeightLookup(points: Point[], numBuckets: number = 500): HeightLookup {
  if (points.length === 0) {
    return {
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
      width: 0,
      height: 0,
      buckets: new Map(),
      bucketWidth: 1,
      numBuckets: 0,
    }
  }

  // Find overall bounds
  let minX = points[0].x
  let maxX = points[0].x
  let minY = points[0].y
  let maxY = points[0].y

  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }

  const width = maxX - minX
  const height = maxY - minY

  if (width < 1 || height < 1) {
    return { minX, maxX, minY, maxY, width, height, buckets: new Map(), bucketWidth: 1, numBuckets: 0 }
  }

  const bucketWidth = width / numBuckets
  const buckets = new Map<number, { minY: number; maxY: number }>()

  // Populate buckets with min/max Y for each X range
  for (const p of points) {
    const bucketIndex = Math.floor((p.x - minX) / bucketWidth)
    const existing = buckets.get(bucketIndex)
    if (existing) {
      existing.minY = Math.min(existing.minY, p.y)
      existing.maxY = Math.max(existing.maxY, p.y)
    } else {
      buckets.set(bucketIndex, { minY: p.y, maxY: p.y })
    }
  }

  // Fill gaps by interpolating from neighbors
  for (let i = 0; i < numBuckets; i++) {
    if (!buckets.has(i)) {
      // Find nearest neighbors
      let leftIdx = i - 1
      let rightIdx = i + 1
      while (leftIdx >= 0 && !buckets.has(leftIdx)) leftIdx--
      while (rightIdx < numBuckets && !buckets.has(rightIdx)) rightIdx++

      const left = leftIdx >= 0 ? buckets.get(leftIdx) : null
      const right = rightIdx < numBuckets ? buckets.get(rightIdx) : null

      if (left && right) {
        // Interpolate
        const t = (i - leftIdx) / (rightIdx - leftIdx)
        buckets.set(i, {
          minY: left.minY + t * (right.minY - left.minY),
          maxY: left.maxY + t * (right.maxY - left.maxY),
        })
      } else if (left) {
        buckets.set(i, { ...left })
      } else if (right) {
        buckets.set(i, { ...right })
      }
    }
  }

  return { minX, maxX, minY, maxY, width, height, buckets, bucketWidth, numBuckets }
}

/**
 * Get shape height bounds at a specific X position
 */
function getHeightAtX(lookup: HeightLookup, x: number): { topY: number; bottomY: number } | null {
  if (x < lookup.minX || x > lookup.maxX || lookup.numBuckets === 0) {
    return null
  }

  // Calculate bucket index and clamp to valid range
  let bucketIndex = Math.floor((x - lookup.minX) / lookup.bucketWidth)
  bucketIndex = Math.max(0, Math.min(bucketIndex, lookup.numBuckets - 1))

  const bucket = lookup.buckets.get(bucketIndex)

  if (!bucket) {
    // Fallback: return overall shape bounds
    return { topY: lookup.minY, bottomY: lookup.maxY }
  }

  return { topY: bucket.minY, bottomY: bucket.maxY }
}

// ============================================================================
// Text Measurement
// ============================================================================

/**
 * ENVELOPE FILL STRATEGY:
 *
 * Characters are distributed across the FULL bounding box width, and each character
 * is scaled to fill the bounding box height segment, then CENTERED vertically.
 *
 * This approach ensures ALL characters are rendered for any shape type (convex or non-convex).
 * The text fills the bounding box of the shape, providing consistent character distribution.
 *
 * Why overshoot + centering:
 * - Visual glyphs don't fill the entire em-box (descender/ascender space is often empty)
 * - By scaling larger (overshoot) and centering, the visual glyph fills more of the segment
 * - This creates a visually balanced text fill appearance
 *
 * This approach works with ANY closed shape because characters are distributed
 * based on the bounding box, not the actual shape geometry at each position.
 */

// Overshoot factor: scale text larger than segment for better visual coverage
// This ensures visual glyphs fill the segment even though they don't fill the em-box
// Using 1.2x (20%) overshoot - enough to fill gaps without extreme stretching
const ENVELOPE_VERTICAL_OVERSHOOT = 1.2

function estimateCharWidth(char: string, fontSize: number): number {
  if (char === ' ') return fontSize * 0.3
  if (/[mwMW@%]/.test(char)) return fontSize * 0.9
  if (/[iljI!'|.,;:()]/.test(char)) return fontSize * 0.35
  if (/[frt]/.test(char)) return fontSize * 0.45
  if (/[A-Z]/.test(char)) return fontSize * 0.75
  return fontSize * 0.55
}

export function estimateTextWidth(text: string, fontSize: number, letterSpacing: number = 0): number {
  let width = 0
  for (const char of text) {
    width += estimateCharWidth(char, fontSize) + letterSpacing
  }
  return Math.max(0, width - letterSpacing)
}

function splitTextIntoLines(text: string): string[] {
  const lines = text.split('\n').filter(line => line.length > 0)
  return lines.length > 0 ? lines : [text]
}

// ============================================================================
// Main Distortion Algorithm
// ============================================================================

export interface EnvelopeDistortionOptions {
  /**
   * Vertical offset as percentage (-50 to +50)
   * Positive values move text down, negative move text up
   * @default 0
   */
  verticalOffset?: number
  /**
   * Vertical scale factor (0.5 to 2.0)
   * Values > 1.0 stretch characters taller, < 1.0 compress them
   * @default 1.0
   */
  verticalScale?: number
  /**
   * Horizontal offset as percentage (-50 to +50)
   * Positive values move text right, negative move text left
   * @default 0
   */
  horizontalOffset?: number
  /**
   * Horizontal scale factor (0.5 to 2.0)
   * Values > 1.0 stretch characters wider, < 1.0 compress them
   * @default 1.0
   */
  horizontalScale?: number
  /**
   * Character spacing adjustment (-50 to +50)
   * Negative values bring characters closer together, positive values spread them apart
   * @default 0
   */
  characterSpacing?: number
}

export function calculateEnvelopeDistortion(
  lines: string[],
  metrics: TextMetrics,
  pathData: string,
  options: EnvelopeDistortionOptions = {}
): EnvelopeDistortionResult {
  const {
    verticalOffset = 0,
    verticalScale = 1.0,
    horizontalOffset = 0,
    horizontalScale = 1.0,
    characterSpacing = 0,
  } = options

  const commands = parseSvgPath(pathData)

  // Handle empty or invalid path
  if (commands.length === 0) {
    return {
      lines: [],
      bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
      clipPath: pathData,
    }
  }

  const pathPoints = samplePath(commands)

  // Handle case where sampling failed
  if (pathPoints.length < 3) {
    return {
      lines: [],
      bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
      clipPath: pathData,
    }
  }

  const heightLookup = buildHeightLookup(pathPoints)

  // Need at least 1 pixel in each dimension and valid buckets
  if (
    heightLookup.width < 1
    || heightLookup.height < 1
    || heightLookup.numBuckets === 0
    || heightLookup.buckets.size === 0
  ) {
    return {
      lines: [],
      bounds: { minX: heightLookup.minX, maxX: heightLookup.maxX, minY: heightLookup.minY, maxY: heightLookup.maxY },
      clipPath: pathData,
    }
  }

  // Use bounding box dimensions for reference
  const {
    minX: boxMinX,
    maxX: boxMaxX,
    minY: boxMinY,
    maxY: boxMaxY,
    width: boxWidth,
    height: boxHeight,
  } = heightLookup

  const warpedLines: WarpedLine[] = []
  const numLines = lines.length

  // Apply vertical offset (percentage of shape height)
  // Range: -50 to +50 → -0.5 to +0.5 of shape height
  const normalizedVerticalOffset = Math.max(-50, Math.min(50, verticalOffset)) / 100

  // Apply vertical scale (factor for character height)
  // Range: 0.5 to 2.0
  const normalizedVerticalScale = Math.max(0.5, Math.min(2.0, verticalScale))

  // Apply horizontal offset (percentage of shape width)
  // Range: -50 to +50 → -0.5 to +0.5 of shape width
  const normalizedHorizontalOffset = Math.max(-50, Math.min(50, horizontalOffset)) / 100

  // Apply horizontal scale (factor for character width)
  // Range: 0.5 to 2.0
  const normalizedHorizontalScale = Math.max(0.5, Math.min(2.0, horizontalScale))

  // Apply character spacing adjustment
  // Range: -50 to +50 → multiplier from 0.5 to 1.5
  // -50 = 0.5 (characters 50% closer)
  // 0 = 1.0 (no change)
  // +50 = 1.5 (characters 50% further apart)
  const normalizedCharacterSpacing = 1.0 + Math.max(-50, Math.min(50, characterSpacing)) / 100

  for (let lineIndex = 0; lineIndex < numLines; lineIndex++) {
    const lineText = lines[lineIndex]
    if (!lineText || lineText.trim() === '') {
      warpedLines.push({ y: 0, characters: [], lineWidth: 0, shapeWidth: boxWidth })
      continue
    }

    // PROPORTIONAL WIDTH ALLOCATION:
    // Instead of equal segments, allocate space based on each character's natural width.
    // This ensures all characters get appropriate space to render properly.

    // First pass: Calculate total natural width of all non-space characters
    let totalNaturalWidth = 0
    const charWidths: { char: string; width: number; index: number }[] = []

    for (let i = 0; i < lineText.length; i++) {
      const char = lineText[i]
      if (char === ' ') continue // Skip spaces
      const width = estimateCharWidth(char, metrics.fontSize)
      totalNaturalWidth += width
      charWidths.push({ char, width, index: i })
    }

    // If no visible characters, skip this line
    if (charWidths.length === 0 || totalNaturalWidth === 0) {
      warpedLines.push({ y: 0, characters: [], lineWidth: 0, shapeWidth: boxWidth })
      continue
    }

    // Use a base font size for width calculations
    const baseFontSize = metrics.fontSize

    // Position each character and calculate its vertical distortion
    const characters: WarpedCharacter[] = []

    // Detect shape type for optimized rendering
    // Simplified to 3 branches: ellipse, curves, everything else (polygon fallback)
    const isElliptical = isEllipticalShape(pathData)
    const hasCurves = isCurvedShape(pathData)

    if (isElliptical) {
      // ELLIPTICAL SHAPE OPTIMIZED ENVELOPE DISTORTION:
      // For circles and ellipses, we want characters to follow the curvature:
      // - Characters in the middle are taller (where ellipse has maximum height)
      // - Characters at edges are shorter (where ellipse has minimum height)
      //
      // Strategy:
      // 1. Distribute characters across the FULL bounding box width with small padding
      // 2. Query the ACTUAL shape height at each character's X position
      // 3. Scale each character to fill that specific height segment
      // 4. Use minimum height fallback for edge characters to ensure they render
      //
      // This creates the "text forming an ellipse/circle" visual effect.

      // Use full bounding box with small edge padding (5%) to keep characters inside shape
      const edgePaddingRatio = 0.05
      const baseLeftX = boxMinX + boxWidth * edgePaddingRatio
      const baseRightX = boxMaxX - boxWidth * edgePaddingRatio
      const usableWidth = baseRightX - baseLeftX

      // Apply horizontal offset (shifts text left/right as percentage of usable width)
      const horizontalOffsetAmount = usableWidth * normalizedHorizontalOffset
      const usableLeftX = baseLeftX + horizontalOffsetAmount

      // Calculate how much to scale character widths to fit the usable width
      const widthMultiplier = totalNaturalWidth > 0 ? usableWidth / totalNaturalWidth : 1.0

      // Minimum height threshold: characters at edges should have at least this height
      // to prevent them from disappearing or becoming too small
      const minCharHeightRatio = 0.15 // At least 15% of max height for edge characters

      let cumulativeX = usableLeftX

      for (const { char, width } of charWidths) {
        // Character's allocated segment width (with horizontal scale applied)
        const baseSegmentWidth = width * widthMultiplier
        const segmentWidth = baseSegmentWidth * normalizedHorizontalScale

        // HEIGHT SAMPLING STRATEGY FOR ELLIPTICAL SHAPES:
        // Query the actual shape height at this character's X position.
        // For circles/ellipses, this gives varying heights (max at center, min at edges).
        // This creates the visual effect of text following the shape curvature.
        const charCenterX = cumulativeX + segmentWidth / 2

        // Get height at character's center position
        const heightAtCenter = getHeightAtX(heightLookup, charCenterX)

        let segmentTopY = boxMinY
        let segmentBottomY = boxMaxY
        let actualShapeHeight = boxHeight

        if (heightAtCenter) {
          segmentTopY = heightAtCenter.topY
          segmentBottomY = heightAtCenter.bottomY
          actualShapeHeight = segmentBottomY - segmentTopY
        }

        // MINIMUM HEIGHT FALLBACK:
        // For edge characters where shape height is very small (near edges of ellipse),
        // use a minimum height to ensure the character is still visible.
        // This prevents characters from disappearing at shape edges.
        const minCharHeight = boxHeight * minCharHeightRatio
        if (actualShapeHeight < minCharHeight) {
          // Center the minimum height segment within the shape's vertical bounds
          const centerY = (boxMinY + boxMaxY) / 2
          segmentTopY = centerY - minCharHeight / 2
          segmentBottomY = centerY + minCharHeight / 2
          actualShapeHeight = minCharHeight
        }

        // Apply small internal padding (3%) to prevent characters from touching shape boundary
        const internalPadding = actualShapeHeight * 0.03
        segmentTopY += internalPadding
        segmentBottomY -= internalPadding

        // Calculate segment height at this X position
        const rawSegmentHeight = segmentBottomY - segmentTopY

        // Apply vertical offset (shifts the text band up or down within the segment)
        const vOffsetAmount = rawSegmentHeight * normalizedVerticalOffset
        segmentTopY += vOffsetAmount
        segmentBottomY += vOffsetAmount

        // Calculate the height the character needs to fill
        const segmentHeight = Math.max(1, segmentBottomY - segmentTopY)

        // Apply vertical scale factor from user settings
        const targetHeight = segmentHeight * normalizedVerticalScale

        // Calculate scaleY to stretch the character to fill the segment height
        const scaleY = targetHeight / baseFontSize

        // VERTICAL CENTERING:
        // When the rendered character height is less than the segment height (due to verticalScale < 1.0),
        // center the character vertically within the segment instead of anchoring at top
        const renderedHeight = targetHeight
        const verticalPadding = Math.max(0, (segmentHeight - renderedHeight) / 2)
        const charY = segmentTopY + verticalPadding

        // Validate all values
        const finalFontSize = Math.max(10, Math.min(500, baseFontSize))
        const finalScaleX = Math.max(0.1, Math.min(10, normalizedHorizontalScale))
        const finalScaleY = Math.max(0.1, Math.min(20, scaleY))
        const finalX = isFinite(cumulativeX) ? cumulativeX : usableLeftX
        const finalY = isFinite(charY) ? charY : segmentTopY

        characters.push({
          char,
          x: finalX,
          y: finalY,
          scaleX: finalScaleX,
          scaleY: finalScaleY,
          fontSize: finalFontSize,
          segmentTopY,
          segmentBottomY,
        })

        // Move to next position (with character spacing adjustment)
        cumulativeX += segmentWidth * normalizedCharacterSpacing
      }
    } else if (hasCurves) {
      // CURVED SHAPE ENVELOPE DISTORTION:
      // For shapes with bezier curves (hearts, teardrops, waves, etc.), the bucket-based
      // height lookup can have gaps or discontinuities. We use the actual path points
      // directly to build a robust height profile.
      //
      // Algorithm:
      // 1. Sort path points by X coordinate
      // 2. Build height slices by grouping points within X tolerance
      // 3. For each slice, find min Y (top) and max Y (bottom)
      // 4. Interpolate between slices for any X position

      // Use full bounding box with small edge padding
      const edgePaddingRatio = 0.03
      const curveBaseLeftX = boxMinX + boxWidth * edgePaddingRatio
      const curveBaseRightX = boxMaxX - boxWidth * edgePaddingRatio
      const usableWidth = curveBaseRightX - curveBaseLeftX

      // Apply horizontal offset
      const horizontalOffsetAmount = usableWidth * normalizedHorizontalOffset
      const usableLeftX = curveBaseLeftX + horizontalOffsetAmount

      // Calculate width multiplier to fit characters
      const widthMultiplier = totalNaturalWidth > 0 ? usableWidth / totalNaturalWidth : 1.0

      // Build height profile directly from path points
      // Group points into X slices and find min/max Y for each slice
      const numSlices = Math.max(100, charWidths.length * 10)
      const sliceWidth = boxWidth / numSlices
      const heightSlices: Array<{ x: number; topY: number; bottomY: number }> = []

      // For each slice, collect all path points within that X range
      for (let i = 0; i < numSlices; i++) {
        const sliceMinX = boxMinX + i * sliceWidth
        const sliceMaxX = sliceMinX + sliceWidth
        const sliceCenterX = (sliceMinX + sliceMaxX) / 2

        // Find all path points in this X slice
        const pointsInSlice = pathPoints.filter(p => p.x >= sliceMinX && p.x < sliceMaxX)

        if (pointsInSlice.length > 0) {
          // Find the actual top (min Y) and bottom (max Y) in this slice
          let minY = Infinity
          let maxY = -Infinity
          for (const p of pointsInSlice) {
            if (p.y < minY) minY = p.y
            if (p.y > maxY) maxY = p.y
          }
          heightSlices.push({ x: sliceCenterX, topY: minY, bottomY: maxY })
        }
      }

      // Fill gaps in slices by interpolating from neighbors
      // This handles areas where the curve doesn't have enough sampled points
      const filledSlices: Array<{ x: number; topY: number; bottomY: number }> = []
      for (let i = 0; i < numSlices; i++) {
        const sliceCenterX = boxMinX + (i + 0.5) * sliceWidth
        const existing = heightSlices.find(s => Math.abs(s.x - sliceCenterX) < sliceWidth)

        if (existing) {
          filledSlices.push(existing)
        } else {
          // Find nearest slices on left and right for interpolation
          let leftSlice: { x: number; topY: number; bottomY: number } | null = null
          let rightSlice: { x: number; topY: number; bottomY: number } | null = null

          for (const slice of heightSlices) {
            if (slice.x < sliceCenterX) {
              if (!leftSlice || slice.x > leftSlice.x) leftSlice = slice
            } else {
              if (!rightSlice || slice.x < rightSlice.x) rightSlice = slice
            }
          }

          if (leftSlice && rightSlice) {
            // Interpolate between neighbors
            const t = (sliceCenterX - leftSlice.x) / (rightSlice.x - leftSlice.x)
            filledSlices.push({
              x: sliceCenterX,
              topY: leftSlice.topY + t * (rightSlice.topY - leftSlice.topY),
              bottomY: leftSlice.bottomY + t * (rightSlice.bottomY - leftSlice.bottomY),
            })
          } else if (leftSlice) {
            filledSlices.push({ x: sliceCenterX, topY: leftSlice.topY, bottomY: leftSlice.bottomY })
          } else if (rightSlice) {
            filledSlices.push({ x: sliceCenterX, topY: rightSlice.topY, bottomY: rightSlice.bottomY })
          } else {
            // Fallback to bounding box
            filledSlices.push({ x: sliceCenterX, topY: boxMinY, bottomY: boxMaxY })
          }
        }
      }

      // Apply smoothing to eliminate any remaining discontinuities
      const smoothingWindow = Math.max(3, Math.floor(numSlices / 20))
      const smoothedSlices: Array<{ x: number; topY: number; bottomY: number }> = []

      for (let i = 0; i < filledSlices.length; i++) {
        let sumTopY = 0
        let sumBottomY = 0
        let count = 0

        for (
          let j = Math.max(0, i - smoothingWindow);
          j <= Math.min(filledSlices.length - 1, i + smoothingWindow);
          j++
        ) {
          sumTopY += filledSlices[j].topY
          sumBottomY += filledSlices[j].bottomY
          count++
        }

        smoothedSlices.push({
          x: filledSlices[i].x,
          topY: sumTopY / count,
          bottomY: sumBottomY / count,
        })
      }

      // Helper function to get height at any X position via interpolation
      const getCurveHeightAtX = (x: number): { topY: number; bottomY: number } => {
        if (smoothedSlices.length === 0) {
          return { topY: boxMinY, bottomY: boxMaxY }
        }

        // Find bracketing slices
        let leftIdx = 0
        let rightIdx = smoothedSlices.length - 1

        for (let i = 0; i < smoothedSlices.length - 1; i++) {
          if (smoothedSlices[i].x <= x && smoothedSlices[i + 1].x >= x) {
            leftIdx = i
            rightIdx = i + 1
            break
          }
        }

        // Handle edge cases
        if (x <= smoothedSlices[0].x) {
          return { topY: smoothedSlices[0].topY, bottomY: smoothedSlices[0].bottomY }
        }
        if (x >= smoothedSlices[smoothedSlices.length - 1].x) {
          const last = smoothedSlices[smoothedSlices.length - 1]
          return { topY: last.topY, bottomY: last.bottomY }
        }

        // Linear interpolation
        const left = smoothedSlices[leftIdx]
        const right = smoothedSlices[rightIdx]
        const t = (x - left.x) / (right.x - left.x)

        return {
          topY: left.topY + t * (right.topY - left.topY),
          bottomY: left.bottomY + t * (right.bottomY - left.bottomY),
        }
      }

      // Minimum height threshold
      const minCharHeightRatio = 0.1

      let cumulativeX = usableLeftX

      for (const { char, width } of charWidths) {
        const baseSegmentWidth = width * widthMultiplier
        const segmentWidth = baseSegmentWidth * normalizedHorizontalScale

        // Get height at character's center X position
        const charCenterX = cumulativeX + segmentWidth / 2
        const heightData = getCurveHeightAtX(charCenterX)

        let segmentTopY = heightData.topY
        let segmentBottomY = heightData.bottomY
        let actualShapeHeight = segmentBottomY - segmentTopY

        // Apply minimum height fallback
        const minCharHeight = boxHeight * minCharHeightRatio
        if (actualShapeHeight < minCharHeight) {
          const centerY = (segmentTopY + segmentBottomY) / 2
          segmentTopY = centerY - minCharHeight / 2
          segmentBottomY = centerY + minCharHeight / 2
          actualShapeHeight = minCharHeight
        }

        // Apply internal padding
        const internalPadding = actualShapeHeight * 0.02
        segmentTopY += internalPadding
        segmentBottomY -= internalPadding

        // Calculate segment height
        const rawSegmentHeight = segmentBottomY - segmentTopY

        // Apply vertical offset
        const vOffsetAmount = rawSegmentHeight * normalizedVerticalOffset
        segmentTopY += vOffsetAmount
        segmentBottomY += vOffsetAmount

        const segmentHeight = Math.max(1, segmentBottomY - segmentTopY)

        // Apply vertical scale with overshoot
        const targetHeight = segmentHeight * normalizedVerticalScale * ENVELOPE_VERTICAL_OVERSHOOT
        const scaleY = targetHeight / baseFontSize

        // Center the oversized character
        const overshootExtra = targetHeight - segmentHeight * normalizedVerticalScale
        const charY = segmentTopY - overshootExtra / 2

        // Validate values
        const finalFontSize = Math.max(10, Math.min(500, baseFontSize))
        const finalScaleX = Math.max(0.1, Math.min(10, normalizedHorizontalScale))
        const finalScaleY = Math.max(0.1, Math.min(20, scaleY))
        const finalX = isFinite(cumulativeX) ? cumulativeX : usableLeftX
        const finalY = isFinite(charY) ? charY : segmentTopY

        characters.push({
          char,
          x: finalX,
          y: finalY,
          scaleX: finalScaleX,
          scaleY: finalScaleY,
          fontSize: finalFontSize,
          segmentTopY,
          segmentBottomY,
        })

        cumulativeX += segmentWidth * normalizedCharacterSpacing
      }
    } else {
      // POLYGON ENVELOPE DISTORTION (DEFAULT FALLBACK):
      // For all other shapes (triangles, parallelograms, trapezoids, pentagons, hexagons, etc.),
      // use direct vertex-based height calculation when possible for precise edge following.
      // Falls back to bucket-based lookup for shapes where vertex extraction fails.

      // Try to extract polygon vertices for direct height calculation
      const polygonVertices = extractPolygonVertices(commands)

      // Use full bounding box with small edge padding
      const edgePaddingRatio = 0.02
      const polyBaseLeftX = boxMinX + boxWidth * edgePaddingRatio
      const polyBaseRightX = boxMaxX - boxWidth * edgePaddingRatio
      const usableWidth = polyBaseRightX - polyBaseLeftX

      // Apply horizontal offset
      const horizontalOffsetAmount = usableWidth * normalizedHorizontalOffset
      const usableLeftX = polyBaseLeftX + horizontalOffsetAmount

      // Calculate width multiplier to fit characters
      const widthMultiplier = totalNaturalWidth > 0 ? usableWidth / totalNaturalWidth : 1.0

      // Minimum height threshold to prevent characters from disappearing at narrow points
      const minCharHeightRatio = 0.08

      let cumulativeX = usableLeftX

      for (const { char, width } of charWidths) {
        const baseSegmentWidth = width * widthMultiplier
        const segmentWidth = baseSegmentWidth * normalizedHorizontalScale

        // Get shape bounds at character's center X position
        // Use direct polygon calculation if vertices available, fallback to bucket lookup
        const charCenterX = cumulativeX + segmentWidth / 2
        const heightAtCenter = polygonVertices
          ? getPolygonHeightAtX(polygonVertices, charCenterX)
          : getHeightAtX(heightLookup, charCenterX)

        let segmentTopY = boxMinY
        let segmentBottomY = boxMaxY
        let actualShapeHeight = boxHeight

        if (heightAtCenter) {
          segmentTopY = heightAtCenter.topY
          segmentBottomY = heightAtCenter.bottomY
          actualShapeHeight = segmentBottomY - segmentTopY
        }

        // Apply minimum height fallback for narrow sections
        const minCharHeight = boxHeight * minCharHeightRatio
        if (actualShapeHeight < minCharHeight) {
          const centerY = (segmentTopY + segmentBottomY) / 2
          segmentTopY = centerY - minCharHeight / 2
          segmentBottomY = centerY + minCharHeight / 2
          actualShapeHeight = minCharHeight
        }

        // Apply small internal padding (2%) to prevent characters from touching shape boundary
        const internalPadding = actualShapeHeight * 0.02
        segmentTopY += internalPadding
        segmentBottomY -= internalPadding

        // Calculate segment height at this X position
        const rawSegmentHeight = segmentBottomY - segmentTopY

        // Apply vertical offset (shifts the text band up or down within the segment)
        const vOffsetAmount = rawSegmentHeight * normalizedVerticalOffset
        segmentTopY += vOffsetAmount
        segmentBottomY += vOffsetAmount

        const segmentHeight = Math.max(1, segmentBottomY - segmentTopY)

        // Apply vertical scale with overshoot to ensure visual glyph fills segment
        const targetHeight = segmentHeight * normalizedVerticalScale * ENVELOPE_VERTICAL_OVERSHOOT
        const scaleY = targetHeight / baseFontSize

        // Center the oversized character within the segment
        const overshootExtra = targetHeight - segmentHeight * normalizedVerticalScale
        const charY = segmentTopY - overshootExtra / 2

        // Validate all values
        const finalFontSize = Math.max(10, Math.min(500, baseFontSize))
        const finalScaleX = Math.max(0.1, Math.min(10, normalizedHorizontalScale))
        const finalScaleY = Math.max(0.1, Math.min(20, scaleY))
        const finalX = isFinite(cumulativeX) ? cumulativeX : usableLeftX
        const finalY = isFinite(charY) ? charY : segmentTopY

        characters.push({
          char,
          x: finalX,
          y: finalY,
          scaleX: finalScaleX,
          scaleY: finalScaleY,
          fontSize: finalFontSize,
          segmentTopY,
          segmentBottomY,
        })

        // Move to next position
        cumulativeX += segmentWidth * normalizedCharacterSpacing
      }
    }

    warpedLines.push({
      y: 0,
      characters,
      lineWidth: estimateTextWidth(lineText, metrics.fontSize, metrics.letterSpacing),
      shapeWidth: boxWidth,
    })
  }

  return {
    lines: warpedLines,
    bounds: { minX: boxMinX, maxX: boxMaxX, minY: boxMinY, maxY: boxMaxY },
    clipPath: serializePathCommands(commands),
  }
}

export function processEnvelopeText(
  text: string,
  metrics: TextMetrics,
  pathData: string,
  options?: EnvelopeDistortionOptions
): EnvelopeDistortionResult {
  const lines = splitTextIntoLines(text)
  return calculateEnvelopeDistortion(lines, metrics, pathData, options)
}
