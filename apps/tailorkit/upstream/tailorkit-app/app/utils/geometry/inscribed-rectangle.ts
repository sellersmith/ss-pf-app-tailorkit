/**
 * Largest inscribed rectangle algorithm for vector path shapes.
 *
 * Finds the largest rectangle (of any rotation) that fits inside a polygon
 * defined by PathCommands. Used for template sizing and placement when
 * the print area is a freeform vector path.
 *
 * Algorithm: Rotating Calipers (optimal rotation) + binary search (inscribed fit).
 * Performance: <20ms for typical 50-200 vertex polygons.
 */

import type { PathCommand } from '~/modules/VectorEditor/utils/svg'

export interface InscribedRectangle {
  x: number
  y: number
  width: number
  height: number
  /** Rotation angle in degrees (0-360) */
  rotation: number
  centerX: number
  centerY: number
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Find the largest inscribed rectangle inside a polygon defined by PathCommands.
 * Returns null for degenerate input (< 3 points, zero area).
 *
 * Falls back to axis-aligned bounding box if inscribed rect is too small
 * (< 30% of AABB area), indicating an extremely concave shape where the
 * algorithm struggles.
 */
export function findLargestInscribedRectangle(pathCommands: PathCommand[]): InscribedRectangle | null {
  const polygon = pathCommandsToPolygon(pathCommands)
  if (polygon.length < 3) return null

  // Try rotated inscribed rectangle via minimum enclosing rectangle angle
  const hull = convexHull(polygon)
  if (hull.length < 3) return null

  const enclosing = minimumEnclosingRectangle(hull)
  if (!enclosing) return null

  // Find largest inscribed rectangle at the enclosing rect's rotation angle
  const inscribed = findInscribedAtAngle(polygon, enclosing.rotation)

  if (!inscribed) return null

  // Normalize orientation: ensure width >= height so templates are landscape-oriented.
  // Without this, the rotating calipers may align with the short edge, causing the
  // template to appear rotated 90° (rotation handle on the side instead of top).
  const normalized = normalizeRectOrientation(inscribed)

  // Fallback: if inscribed area < 30% of AABB, the shape is too concave
  // for the algorithm — return axis-aligned AABB instead (current behavior)
  const aabb = getAxisAlignedBounds(polygon)
  const aabbArea = aabb.width * aabb.height
  const inscribedArea = normalized.width * normalized.height

  if (inscribedArea < aabbArea * MIN_INSCRIBED_TO_AABB_RATIO) {
    return {
      x: aabb.minX,
      y: aabb.minY,
      width: aabb.width,
      height: aabb.height,
      rotation: 0,
      centerX: aabb.minX + aabb.width / 2,
      centerY: aabb.minY + aabb.height / 2,
    }
  }

  return normalized
}

// ─── PathCommands → Polygon ──────────────────────────────────────────────────

const BEZIER_SAMPLES = 8

/** If inscribed rect area < this ratio of AABB area, fall back to AABB (shape too concave) */
const MIN_INSCRIBED_TO_AABB_RATIO = 0.3

/** Convert PathCommands to a flat polygon point array, sampling bezier curves. */
export function pathCommandsToPolygon(commands: PathCommand[], samples = BEZIER_SAMPLES): [number, number][] {
  const points: [number, number][] = []
  let curX = 0
  let curY = 0

  for (const cmd of commands) {
    if (cmd.type === 'M' || cmd.type === 'L') {
      points.push([cmd.x, cmd.y])
      curX = cmd.x
      curY = cmd.y
    } else if (cmd.type === 'C' && cmd.cp1 && cmd.cp2) {
      // Sample cubic bezier at regular intervals
      for (let i = 1; i <= samples; i++) {
        const t = i / samples
        const x = cubicBezier(t, curX, cmd.cp1.x, cmd.cp2.x, cmd.x)
        const y = cubicBezier(t, curY, cmd.cp1.y, cmd.cp2.y, cmd.y)
        points.push([x, y])
      }
      curX = cmd.x
      curY = cmd.y
    } else if (cmd.type === 'Q' && cmd.cp) {
      // Sample quadratic bezier
      for (let i = 1; i <= samples; i++) {
        const t = i / samples
        const x = quadBezier(t, curX, cmd.cp.x, cmd.x)
        const y = quadBezier(t, curY, cmd.cp.y, cmd.y)
        points.push([x, y])
      }
      curX = cmd.x
      curY = cmd.y
    } else if (cmd.type === 'H') {
      curX = cmd.x
      points.push([curX, curY])
    } else if (cmd.type === 'V') {
      curY = cmd.y
      points.push([curX, curY])
    }
    // Z (close path) — skip, no new point needed
  }

  return points
}

function cubicBezier(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const t2 = t * t
  const t3 = t2 * t
  const mt = 1 - t
  const mt2 = mt * mt
  const mt3 = mt2 * mt
  return mt3 * p0 + 3 * mt2 * t * p1 + 3 * mt * t2 * p2 + t3 * p3
}

function quadBezier(t: number, p0: number, p1: number, p2: number): number {
  const mt = 1 - t
  return mt * mt * p0 + 2 * mt * t * p1 + t * t * p2
}

// ─── Convex Hull (Graham Scan) ───────────────────────────────────────────────

/** Compute convex hull using Graham Scan. O(n log n). */
export function convexHull(points: [number, number][]): [number, number][] {
  if (points.length <= 2) return [...points]

  // Find the lowest point (then leftmost if tied)
  let start = 0
  for (let i = 1; i < points.length; i++) {
    if (points[i][1] < points[start][1] || (points[i][1] === points[start][1] && points[i][0] < points[start][0])) {
      start = i
    }
  }

  const pivot = points[start]

  // Sort by polar angle relative to pivot
  const sorted = points
    .filter((_, i) => i !== start)
    .sort((a, b) => {
      const cross = crossProduct([a[0] - pivot[0], a[1] - pivot[1]], [b[0] - pivot[0], b[1] - pivot[1]])
      if (cross !== 0) return -cross // counter-clockwise order
      // Collinear: sort by distance
      const da = (a[0] - pivot[0]) ** 2 + (a[1] - pivot[1]) ** 2
      const db = (b[0] - pivot[0]) ** 2 + (b[1] - pivot[1]) ** 2
      return da - db
    })

  const hull: [number, number][] = [pivot]
  for (const p of sorted) {
    while (hull.length > 1) {
      const a = hull[hull.length - 2]
      const b = hull[hull.length - 1]
      if (crossProduct([b[0] - a[0], b[1] - a[1]], [p[0] - a[0], p[1] - a[1]]) > 0) break
      hull.pop()
    }
    hull.push(p)
  }

  return hull
}

function crossProduct(a: [number, number], b: [number, number]): number {
  return a[0] * b[1] - a[1] * b[0]
}

// ─── Minimum Enclosing Rectangle (Rotating Calipers) ─────────────────────────

/** Find minimum area enclosing rectangle. Returns its rotation angle. */
export function minimumEnclosingRectangle(hull: [number, number][]): InscribedRectangle | null {
  if (hull.length < 3) return null

  let minArea = Infinity
  let bestAngle = 0
  let bestRect: { minX: number; minY: number; width: number; height: number } | null = null
  // Track the hull vertex whose edge produced the best enclosing rectangle.
  // Projections (minU, minV) are relative to this vertex, so the center must
  // be computed from the same origin — using hull[0] would displace the center.
  let bestOrigin: [number, number] = hull[0]

  for (let i = 0; i < hull.length; i++) {
    const p1 = hull[i]
    const p2 = hull[(i + 1) % hull.length]

    const edgeX = p2[0] - p1[0]
    const edgeY = p2[1] - p1[1]
    const edgeLen = Math.sqrt(edgeX * edgeX + edgeY * edgeY)
    if (edgeLen === 0) continue

    // Unit vectors along edge and perpendicular
    const ux = edgeX / edgeLen
    const uy = edgeY / edgeLen

    // Project all hull points onto edge axes
    let minU = Infinity,
      maxU = -Infinity
    let minV = Infinity,
      maxV = -Infinity

    for (const pt of hull) {
      const dx = pt[0] - p1[0]
      const dy = pt[1] - p1[1]
      const u = dx * ux + dy * uy
      const v = -dx * uy + dy * ux
      minU = Math.min(minU, u)
      maxU = Math.max(maxU, u)
      minV = Math.min(minV, v)
      maxV = Math.max(maxV, v)
    }

    const w = maxU - minU
    const h = maxV - minV
    const area = w * h

    if (area < minArea) {
      minArea = area
      bestAngle = Math.atan2(uy, ux)
      bestRect = { minX: minU, minY: minV, width: w, height: h }
      bestOrigin = p1
    }
  }

  if (!bestRect) return null

  // Convert angle to degrees (0-360)
  let degrees = bestAngle * (180 / Math.PI)
  if (degrees < 0) degrees += 360

  // Compute center in original space using the correct reference vertex
  const ux = Math.cos(bestAngle)
  const uy = Math.sin(bestAngle)
  const cx = bestOrigin[0] + (bestRect.minX + bestRect.width / 2) * ux - (bestRect.minY + bestRect.height / 2) * uy
  const cy = bestOrigin[1] + (bestRect.minX + bestRect.width / 2) * uy + (bestRect.minY + bestRect.height / 2) * ux

  return {
    x: cx - bestRect.width / 2,
    y: cy - bestRect.height / 2,
    width: bestRect.width,
    height: bestRect.height,
    rotation: degrees,
    centerX: cx,
    centerY: cy,
  }
}

// ─── Inscribed Rectangle at Given Angle ──────────────────────────────────────

/**
 * Find the largest axis-aligned rectangle that fits inside the polygon
 * after rotating it by -angle. Then transform back to original space.
 */
function findInscribedAtAngle(polygon: [number, number][], angleDeg: number): InscribedRectangle | null {
  const angleRad = angleDeg * (Math.PI / 180)

  // Rotate polygon so the target angle becomes axis-aligned
  const rotated = polygon.map(p => rotatePoint(p, -angleRad))

  // Find the axis-aligned inscribed rectangle in rotated space
  const rect = findAxisAlignedInscribed(rotated)
  if (!rect) return null

  // Transform center back to original space
  const center = rotatePoint([rect.cx, rect.cy], angleRad)

  return {
    x: center[0] - rect.width / 2,
    y: center[1] - rect.height / 2,
    width: rect.width,
    height: rect.height,
    rotation: angleDeg,
    centerX: center[0],
    centerY: center[1],
  }
}

/**
 * Find the largest axis-aligned rectangle inscribed in a polygon (rotated space).
 * Uses a grid-based scan centered on the polygon centroid.
 *
 * @param rotatedPoly - polygon in rotated space (for AABB scanning)
 * @param originalPoly - polygon in original space (for containment testing)
 */
function findAxisAlignedInscribed(
  rotatedPoly: [number, number][]
): { cx: number; cy: number; width: number; height: number } | null {
  const bounds = getAxisAlignedBounds(rotatedPoly)
  if (bounds.width <= 0 || bounds.height <= 0) return null

  const cx = bounds.minX + bounds.width / 2
  const cy = bounds.minY + bounds.height / 2

  // First check if full AABB fits (it might for convex shapes)
  if (rectFitsInPolygon(cx, cy, bounds.width, bounds.height, 0, rotatedPoly)) {
    return { cx, cy, width: bounds.width, height: bounds.height }
  }

  // For concave shapes, the centroid may be outside the polygon.
  // Go directly to the grid scan which tries multiple interior centers.
  return optimizeCenter(rotatedPoly, bounds, 0, 0, 0)
}

/**
 * After finding a scale factor, try shifting the center point
 * to find a larger rectangle that still fits.
 */
function optimizeCenter(
  polygon: [number, number][],
  bounds: { minX: number; minY: number; width: number; height: number },
  initW: number,
  initH: number,
  initScale: number
): { cx: number; cy: number; width: number; height: number } {
  let bestArea = initW * initH
  let bestCx = bounds.minX + bounds.width / 2
  let bestCy = bounds.minY + bounds.height / 2
  let bestW = initW
  let bestH = initH

  // Sample center positions across the polygon interior
  const steps = 7
  const stepX = bounds.width / (steps + 1)
  const stepY = bounds.height / (steps + 1)

  for (let ix = 1; ix <= steps; ix++) {
    for (let iy = 1; iy <= steps; iy++) {
      const cx = bounds.minX + ix * stepX
      const cy = bounds.minY + iy * stepY

      // Check if center is inside polygon
      if (!isPointInPolygon([cx, cy], polygon)) continue

      // Binary search for largest scale at this center
      let lo = initScale
      let hi = 1.0

      // Quick check: if we have a prior scale, verify it fits here; otherwise start from zero
      if (lo > 0 && !rectFitsInPolygon(cx, cy, bounds.width * lo, bounds.height * lo, 0, polygon)) continue

      for (let i = 0; i < 15; i++) {
        const mid = (lo + hi) / 2
        if (rectFitsInPolygon(cx, cy, bounds.width * mid, bounds.height * mid, 0, polygon)) {
          lo = mid
        } else {
          hi = mid
        }
      }

      const w = bounds.width * lo
      const h = bounds.height * lo
      const area = w * h

      if (area > bestArea) {
        bestArea = area
        bestCx = cx
        bestCy = cy
        bestW = w
        bestH = h
      }
    }
  }

  return { cx: bestCx, cy: bestCy, width: bestW, height: bestH }
}

/**
 * Normalize rotation to near-horizontal range (-45° to +45°).
 *
 * The rotating calipers may align with the shape's long axis (e.g., 80° for
 * a near-vertical wallet). This causes text templates to render nearly vertical.
 * Normalizing to near-horizontal ensures text reads left-to-right with only a
 * slight tilt matching the product surface angle.
 *
 * When rotation is adjusted by ±90°, width and height are swapped since the
 * rectangle's orientation relative to the image changes.
 */
function normalizeRectOrientation(rect: InscribedRectangle): InscribedRectangle {
  // Normalize to -180..180 range first
  let r = rect.rotation % 360
  if (r > 180) r -= 360
  if (r < -180) r += 360

  let w = rect.width
  let h = rect.height

  // Bring rotation into -45..45 range by subtracting/adding 90° and swapping dims
  if (r > 45) {
    r -= 90
    ;[w, h] = [h, w]
  } else if (r < -45) {
    r += 90
    ;[w, h] = [h, w]
  }

  // If still out of range (e.g., was near ±135°), adjust again
  if (r > 45) {
    r -= 90
    ;[w, h] = [h, w]
  } else if (r < -45) {
    r += 90
    ;[w, h] = [h, w]
  }

  // Convert back to 0-360 range
  if (r < 0) r += 360

  return {
    ...rect,
    // Recalculate x/y from center so they stay consistent after dimension swap
    x: rect.centerX - w / 2,
    y: rect.centerY - h / 2,
    width: w,
    height: h,
    rotation: r,
  }
}

// ─── Geometry Helpers ────────────────────────────────────────────────────────

function rotatePoint(p: [number, number], angleRad: number): [number, number] {
  const cos = Math.cos(angleRad)
  const sin = Math.sin(angleRad)
  return [p[0] * cos - p[1] * sin, p[0] * sin + p[1] * cos]
}

function getAxisAlignedBounds(points: [number, number][]): {
  minX: number
  minY: number
  width: number
  height: number
} {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const [x, y] of points) {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  return { minX, minY, width: maxX - minX, height: maxY - minY }
}

/** Test if all 4 corners of a rectangle are inside the polygon. */
function rectFitsInPolygon(
  cx: number,
  cy: number,
  w: number,
  h: number,
  angleRad: number,
  polygon: [number, number][]
): boolean {
  const hw = w / 2
  const hh = h / 2

  // 4 corners relative to center
  const corners: [number, number][] = [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ]

  const cos = Math.cos(angleRad)
  const sin = Math.sin(angleRad)

  for (const [lx, ly] of corners) {
    const x = cx + lx * cos - ly * sin
    const y = cy + lx * sin + ly * cos
    if (!isPointInPolygon([x, y], polygon)) return false
  }

  return true
}

/** Ray casting point-in-polygon test. */
export function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [px, py] = point
  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]

    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }

  return inside
}
