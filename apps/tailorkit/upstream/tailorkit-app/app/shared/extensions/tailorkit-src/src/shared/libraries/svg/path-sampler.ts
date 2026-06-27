/**
 * Path Sampler Utility
 *
 * Parses SVG path data and samples points with positions and tangent angles.
 * Used for warping images along curved text paths.
 *
 * @module shared/libraries/svg
 */

/**
 * A point on the path with position and tangent angle
 */
export interface PathPoint {
  /** X coordinate */
  x: number
  /** Y coordinate */
  y: number
  /** Tangent angle in radians (direction of path at this point) */
  angle: number
  /** Parameter 0-1 along the path */
  t: number
}

/**
 * SVG path command types we support
 */
type PathCommandType = 'M' | 'L' | 'A' | 'C' | 'Q' | 'Z'

/**
 * Parsed path command
 */
interface PathCommand {
  type: PathCommandType
  params: number[]
}

/**
 * Parse SVG path data string into commands
 *
 * Supports: M (moveto), L (lineto), A (arc), C (cubic bezier), Q (quadratic bezier), Z (close)
 */
export function parsePathData(pathData: string): PathCommand[] {
  const commands: PathCommand[] = []

  // Match command letter followed by numbers (with optional whitespace/commas)
  const regex = /([MLACQZ])\s*([\d\s,.-]*)/gi
  let match: RegExpExecArray | null

  while ((match = regex.exec(pathData)) !== null) {
    const type = match[1].toUpperCase() as PathCommandType
    const paramStr = match[2].trim()

    // Parse numbers from parameter string
    const params: number[] = []
    if (paramStr) {
      // Split on whitespace or comma, handle negative numbers
      const numRegex = /-?[\d.]+/g
      let numMatch: RegExpExecArray | null
      while ((numMatch = numRegex.exec(paramStr)) !== null) {
        params.push(parseFloat(numMatch[0]))
      }
    }

    commands.push({ type, params })
  }

  return commands
}

/**
 * Linear interpolation between two points
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * Calculate angle between two points (in radians)
 */
function angleBetween(x1: number, y1: number, x2: number, y2: number): number {
  return Math.atan2(y2 - y1, x2 - x1)
}

/**
 * Sample a point on an SVG arc
 *
 * Arc parameters: rx, ry, x-axis-rotation, large-arc-flag, sweep-flag, x, y
 */
function sampleArc(
  startX: number,
  startY: number,
  rx: number,
  ry: number,
  xAxisRotation: number,
  largeArcFlag: number,
  sweepFlag: number,
  endX: number,
  endY: number,
  t: number
): { x: number; y: number } {
  // Convert arc to center parameterization
  const phi = (xAxisRotation * Math.PI) / 180
  const cosPhi = Math.cos(phi)
  const sinPhi = Math.sin(phi)

  // Step 1: Compute (x1', y1')
  const dx = (startX - endX) / 2
  const dy = (startY - endY) / 2
  const x1p = cosPhi * dx + sinPhi * dy
  const y1p = -sinPhi * dx + cosPhi * dy

  // Step 2: Compute (cx', cy')
  const rxSq = rx * rx
  const rySq = ry * ry
  const x1pSq = x1p * x1p
  const y1pSq = y1p * y1p

  let radicand = (rxSq * rySq - rxSq * y1pSq - rySq * x1pSq) / (rxSq * y1pSq + rySq * x1pSq)
  radicand = Math.max(0, radicand)
  const root = Math.sqrt(radicand)
  const sign = largeArcFlag !== sweepFlag ? 1 : -1

  const cxp = sign * root * ((rx * y1p) / ry)
  const cyp = sign * root * ((-ry * x1p) / rx)

  // Step 3: Compute (cx, cy) from (cx', cy')
  const cx = cosPhi * cxp - sinPhi * cyp + (startX + endX) / 2
  const cy = sinPhi * cxp + cosPhi * cyp + (startY + endY) / 2

  // Step 4: Compute theta1 and dtheta
  const theta1 = Math.atan2((y1p - cyp) / ry, (x1p - cxp) / rx)
  const theta2 = Math.atan2((-y1p - cyp) / ry, (-x1p - cxp) / rx)

  let dtheta = theta2 - theta1
  if (sweepFlag && dtheta < 0) {
    dtheta += 2 * Math.PI
  } else if (!sweepFlag && dtheta > 0) {
    dtheta -= 2 * Math.PI
  }

  // Sample point at parameter t
  const theta = theta1 + t * dtheta
  const xp = rx * Math.cos(theta)
  const yp = ry * Math.sin(theta)

  return {
    x: cosPhi * xp - sinPhi * yp + cx,
    y: sinPhi * xp + cosPhi * yp + cy,
  }
}

/**
 * Sample points along a cubic bezier curve
 */
function sampleCubicBezier(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  t: number
): { x: number; y: number } {
  const mt = 1 - t
  const mt2 = mt * mt
  const mt3 = mt2 * mt
  const t2 = t * t
  const t3 = t2 * t

  return {
    x: mt3 * x0 + 3 * mt2 * t * x1 + 3 * mt * t2 * x2 + t3 * x3,
    y: mt3 * y0 + 3 * mt2 * t * y1 + 3 * mt * t2 * y2 + t3 * y3,
  }
}

/**
 * Sample points along a quadratic bezier curve
 */
function sampleQuadraticBezier(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  t: number
): { x: number; y: number } {
  const mt = 1 - t
  const mt2 = mt * mt
  const t2 = t * t

  return {
    x: mt2 * x0 + 2 * mt * t * x1 + t2 * x2,
    y: mt2 * y0 + 2 * mt * t * y1 + t2 * y2,
  }
}

/**
 * Estimate total path length for a set of commands
 * Uses simple segment approximation for lines, arcs, and curves.
 * Useful for determining optimal sample count.
 */
export function estimatePathLength(commands: PathCommand[]): number {
  let length = 0
  let currentX = 0
  let currentY = 0

  for (const cmd of commands) {
    const { type, params } = cmd

    switch (type) {
      case 'M':
        currentX = params[0]
        currentY = params[1]
        break

      case 'L': {
        const dx = params[0] - currentX
        const dy = params[1] - currentY
        length += Math.sqrt(dx * dx + dy * dy)
        currentX = params[0]
        currentY = params[1]
        break
      }

      case 'A': {
        // Approximate arc length using multiple samples
        const endX = params[5]
        const endY = params[6]
        const samples = 10
        let prevX = currentX
        let prevY = currentY
        for (let i = 1; i <= samples; i++) {
          const t = i / samples
          const pt = sampleArc(currentX, currentY, params[0], params[1], params[2], params[3], params[4], endX, endY, t)
          const dx = pt.x - prevX
          const dy = pt.y - prevY
          length += Math.sqrt(dx * dx + dy * dy)
          prevX = pt.x
          prevY = pt.y
        }
        currentX = endX
        currentY = endY
        break
      }

      case 'C': {
        // Approximate cubic bezier length
        const samples = 10
        let prevX = currentX
        let prevY = currentY
        for (let i = 1; i <= samples; i++) {
          const t = i / samples
          const pt = sampleCubicBezier(
            currentX,
            currentY,
            params[0],
            params[1],
            params[2],
            params[3],
            params[4],
            params[5],
            t
          )
          const dx = pt.x - prevX
          const dy = pt.y - prevY
          length += Math.sqrt(dx * dx + dy * dy)
          prevX = pt.x
          prevY = pt.y
        }
        currentX = params[4]
        currentY = params[5]
        break
      }

      case 'Q': {
        // Approximate quadratic bezier length
        const samples = 10
        let prevX = currentX
        let prevY = currentY
        for (let i = 1; i <= samples; i++) {
          const t = i / samples
          const pt = sampleQuadraticBezier(currentX, currentY, params[0], params[1], params[2], params[3], t)
          const dx = pt.x - prevX
          const dy = pt.y - prevY
          length += Math.sqrt(dx * dx + dy * dy)
          prevX = pt.x
          prevY = pt.y
        }
        currentX = params[2]
        currentY = params[3]
        break
      }
    }
  }

  return length
}

/**
 * Sample evenly-spaced points along an SVG path
 *
 * @param pathData - SVG path string (e.g., "M 0 50 L 100 50 A ...")
 * @param numSamples - Number of points to sample
 * @returns Array of PathPoint with x, y, angle, and t
 */
export function samplePath(pathData: string, numSamples: number): PathPoint[] {
  const commands = parsePathData(pathData)

  if (commands.length === 0 || numSamples < 2) {
    return []
  }

  // Build a list of segments with their approximate lengths
  interface Segment {
    type: PathCommandType
    startX: number
    startY: number
    params: number[]
    length: number
  }

  const segments: Segment[] = []
  let currentX = 0
  let currentY = 0
  let totalLength = 0

  for (const cmd of commands) {
    const { type, params } = cmd

    if (type === 'M') {
      currentX = params[0]
      currentY = params[1]
      continue
    }

    const startX = currentX
    const startY = currentY

    // Calculate segment length
    let segmentLength = 0
    switch (type) {
      case 'L': {
        const dx = params[0] - currentX
        const dy = params[1] - currentY
        segmentLength = Math.sqrt(dx * dx + dy * dy)
        currentX = params[0]
        currentY = params[1]
        break
      }
      case 'A': {
        // Sample arc for length approximation
        const samples = 20
        let prevX = currentX
        let prevY = currentY
        for (let i = 1; i <= samples; i++) {
          const t = i / samples
          const pt = sampleArc(currentX, currentY, params[0], params[1], params[2], params[3], params[4], params[5], params[6], t)
          segmentLength += Math.sqrt((pt.x - prevX) ** 2 + (pt.y - prevY) ** 2)
          prevX = pt.x
          prevY = pt.y
        }
        currentX = params[5]
        currentY = params[6]
        break
      }
      case 'C': {
        const samples = 20
        let prevX = currentX
        let prevY = currentY
        for (let i = 1; i <= samples; i++) {
          const t = i / samples
          const pt = sampleCubicBezier(currentX, currentY, params[0], params[1], params[2], params[3], params[4], params[5], t)
          segmentLength += Math.sqrt((pt.x - prevX) ** 2 + (pt.y - prevY) ** 2)
          prevX = pt.x
          prevY = pt.y
        }
        currentX = params[4]
        currentY = params[5]
        break
      }
      case 'Q': {
        const samples = 20
        let prevX = currentX
        let prevY = currentY
        for (let i = 1; i <= samples; i++) {
          const t = i / samples
          const pt = sampleQuadraticBezier(currentX, currentY, params[0], params[1], params[2], params[3], t)
          segmentLength += Math.sqrt((pt.x - prevX) ** 2 + (pt.y - prevY) ** 2)
          prevX = pt.x
          prevY = pt.y
        }
        currentX = params[2]
        currentY = params[3]
        break
      }
    }

    if (segmentLength > 0) {
      segments.push({
        type,
        startX,
        startY,
        params,
        length: segmentLength,
      })
      totalLength += segmentLength
    }
  }

  if (totalLength === 0 || segments.length === 0) {
    return []
  }

  // Sample points at evenly-spaced distances
  const points: PathPoint[] = []
  const stepDistance = totalLength / (numSamples - 1)

  for (let i = 0; i < numSamples; i++) {
    const targetDistance = i * stepDistance
    const globalT = i / (numSamples - 1)

    // Find the segment containing this distance
    let accumulatedDistance = 0
    let point: { x: number; y: number } | null = null
    let nextPoint: { x: number; y: number } | null = null

    for (const segment of segments) {
      if (accumulatedDistance + segment.length >= targetDistance || segment === segments[segments.length - 1]) {
        // This segment contains our target point
        const localDistance = targetDistance - accumulatedDistance
        const localT = Math.min(1, Math.max(0, localDistance / segment.length))

        // Sample point at localT
        switch (segment.type) {
          case 'L':
            point = {
              x: lerp(segment.startX, segment.params[0], localT),
              y: lerp(segment.startY, segment.params[1], localT),
            }
            // For tangent, sample slightly ahead
            nextPoint = {
              x: lerp(segment.startX, segment.params[0], Math.min(1, localT + 0.01)),
              y: lerp(segment.startY, segment.params[1], Math.min(1, localT + 0.01)),
            }
            break

          case 'A':
            point = sampleArc(
              segment.startX,
              segment.startY,
              segment.params[0],
              segment.params[1],
              segment.params[2],
              segment.params[3],
              segment.params[4],
              segment.params[5],
              segment.params[6],
              localT
            )
            nextPoint = sampleArc(
              segment.startX,
              segment.startY,
              segment.params[0],
              segment.params[1],
              segment.params[2],
              segment.params[3],
              segment.params[4],
              segment.params[5],
              segment.params[6],
              Math.min(1, localT + 0.01)
            )
            break

          case 'C':
            point = sampleCubicBezier(
              segment.startX,
              segment.startY,
              segment.params[0],
              segment.params[1],
              segment.params[2],
              segment.params[3],
              segment.params[4],
              segment.params[5],
              localT
            )
            nextPoint = sampleCubicBezier(
              segment.startX,
              segment.startY,
              segment.params[0],
              segment.params[1],
              segment.params[2],
              segment.params[3],
              segment.params[4],
              segment.params[5],
              Math.min(1, localT + 0.01)
            )
            break

          case 'Q':
            point = sampleQuadraticBezier(
              segment.startX,
              segment.startY,
              segment.params[0],
              segment.params[1],
              segment.params[2],
              segment.params[3],
              localT
            )
            nextPoint = sampleQuadraticBezier(
              segment.startX,
              segment.startY,
              segment.params[0],
              segment.params[1],
              segment.params[2],
              segment.params[3],
              Math.min(1, localT + 0.01)
            )
            break
        }

        break
      }

      accumulatedDistance += segment.length
    }

    if (point && nextPoint) {
      const angle = angleBetween(point.x, point.y, nextPoint.x, nextPoint.y)
      points.push({
        x: point.x,
        y: point.y,
        angle,
        t: globalT,
      })
    }
  }

  return points
}

/**
 * Calculate the bounding box of sampled path points with perpendicular extent
 *
 * @param points - Sampled path points
 * @param height - Height of the perpendicular extent (e.g., image height)
 * @returns Bounding box { minX, minY, maxX, maxY }
 */
export function calculatePathBounds(
  points: PathPoint[],
  height: number
): { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number } {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  const halfHeight = height / 2

  for (const point of points) {
    // Calculate perpendicular offset (90 degrees from tangent)
    const perpAngle = point.angle + Math.PI / 2

    // Check both ends of the perpendicular extent
    const topX = point.x + halfHeight * Math.cos(perpAngle)
    const topY = point.y + halfHeight * Math.sin(perpAngle)
    const bottomX = point.x - halfHeight * Math.cos(perpAngle)
    const bottomY = point.y - halfHeight * Math.sin(perpAngle)

    minX = Math.min(minX, topX, bottomX, point.x)
    minY = Math.min(minY, topY, bottomY, point.y)
    maxX = Math.max(maxX, topX, bottomX, point.x)
    maxY = Math.max(maxY, topY, bottomY, point.y)
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  }
}
