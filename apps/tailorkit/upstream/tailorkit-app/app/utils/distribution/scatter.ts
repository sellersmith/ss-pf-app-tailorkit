/**
 * Scatter Distribution Utilities
 *
 * Algorithms for distributing pattern elements across an area.
 * Extracted from VectorEditor for reuse across modules.
 */

import type { PatternConfig, ScatterPoint } from '~/types/pattern'
import { DEFAULT_PATTERN_CONFIG } from '~/types/pattern'
import type { SeededRandom } from '~/utils/random'
import { createSeededRandom } from '~/utils/random'

/**
 * Generate scatter points with random distribution
 */
export function scatterRandom(
  cx: number,
  cy: number,
  width: number,
  height: number,
  config: PatternConfig,
  rng: SeededRandom
): ScatterPoint[] {
  const count = config.count ?? DEFAULT_PATTERN_CONFIG.count
  const rotation = config.rotation ?? DEFAULT_PATTERN_CONFIG.rotation
  const scale = config.scale ?? DEFAULT_PATTERN_CONFIG.scale
  const colors = config.colors ?? []

  const points: ScatterPoint[] = []
  const halfW = width / 2
  const halfH = height / 2

  for (let i = 0; i < count; i++) {
    points.push({
      x: cx + rng.range(-halfW, halfW),
      y: cy + rng.range(-halfH, halfH),
      rotation: rng.range(rotation.min, rotation.max),
      scale: rng.range(scale.min, scale.max),
      colorIndex: colors.length > 0 ? rng.int(0, colors.length - 1) : 0,
    })
  }

  return points
}

/**
 * Generate scatter points in a grid pattern with some randomness
 */
export function scatterGrid(
  cx: number,
  cy: number,
  width: number,
  height: number,
  config: PatternConfig,
  rng: SeededRandom
): ScatterPoint[] {
  const count = config.count ?? DEFAULT_PATTERN_CONFIG.count
  const rotation = config.rotation ?? DEFAULT_PATTERN_CONFIG.rotation
  const scale = config.scale ?? DEFAULT_PATTERN_CONFIG.scale
  const density = config.density ?? DEFAULT_PATTERN_CONFIG.density
  const colors = config.colors ?? []

  const points: ScatterPoint[] = []

  // Calculate grid dimensions
  const cols = Math.ceil(Math.sqrt(count * (width / height)))
  const rows = Math.ceil(count / cols)
  const cellW = width / cols
  const cellH = height / rows
  const jitter = Math.min(cellW, cellH) * 0.3 * density

  const startX = cx - width / 2 + cellW / 2
  const startY = cy - height / 2 + cellH / 2

  let placed = 0
  for (let row = 0; row < rows && placed < count; row++) {
    for (let col = 0; col < cols && placed < count; col++) {
      points.push({
        x: startX + col * cellW + rng.range(-jitter, jitter),
        y: startY + row * cellH + rng.range(-jitter, jitter),
        rotation: rng.range(rotation.min, rotation.max),
        scale: rng.range(scale.min, scale.max),
        colorIndex: colors.length > 0 ? rng.int(0, colors.length - 1) : 0,
      })
      placed++
    }
  }

  return points
}

/**
 * Generate scatter points in a radial pattern from center
 */
export function scatterRadial(
  cx: number,
  cy: number,
  width: number,
  height: number,
  config: PatternConfig,
  rng: SeededRandom
): ScatterPoint[] {
  const count = config.count ?? DEFAULT_PATTERN_CONFIG.count
  const rotation = config.rotation ?? DEFAULT_PATTERN_CONFIG.rotation
  const scale = config.scale ?? DEFAULT_PATTERN_CONFIG.scale
  const colors = config.colors ?? []

  const points: ScatterPoint[] = []
  const maxRadius = Math.min(width, height) / 2

  // Distribute in rings
  const rings = Math.ceil(Math.sqrt(count))
  const ringSpacing = maxRadius / rings

  let placed = 0
  for (let ring = 0; ring < rings && placed < count; ring++) {
    const radius = ringSpacing * (ring + 0.5)
    const circumference = 2 * Math.PI * radius
    const pointsInRing = Math.min(Math.ceil((circumference / ringSpacing) * (config.density ?? 0.5)), count - placed)
    const angleStep = (2 * Math.PI) / pointsInRing

    for (let i = 0; i < pointsInRing && placed < count; i++) {
      const angle = angleStep * i + rng.range(-0.2, 0.2)
      const r = radius + rng.range(-ringSpacing * 0.2, ringSpacing * 0.2)

      points.push({
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        rotation: rng.range(rotation.min, rotation.max),
        scale: rng.range(scale.min, scale.max),
        colorIndex: colors.length > 0 ? rng.int(0, colors.length - 1) : 0,
      })
      placed++
    }
  }

  return points
}

/**
 * Generate scatter points in a spiral pattern
 */
export function scatterSpiral(
  cx: number,
  cy: number,
  width: number,
  height: number,
  config: PatternConfig,
  rng: SeededRandom
): ScatterPoint[] {
  const count = config.count ?? DEFAULT_PATTERN_CONFIG.count
  const rotation = config.rotation ?? DEFAULT_PATTERN_CONFIG.rotation
  const scale = config.scale ?? DEFAULT_PATTERN_CONFIG.scale
  const colors = config.colors ?? []

  const points: ScatterPoint[] = []
  const maxRadius = Math.min(width, height) / 2
  const goldenAngle = Math.PI * (3 - Math.sqrt(5)) // ~137.5 degrees

  for (let i = 0; i < count; i++) {
    const t = i / count
    const angle = i * goldenAngle
    const radius = Math.sqrt(t) * maxRadius

    points.push({
      x: cx + Math.cos(angle) * radius + rng.range(-5, 5),
      y: cy + Math.sin(angle) * radius + rng.range(-5, 5),
      rotation: rng.range(rotation.min, rotation.max),
      scale: rng.range(scale.min, scale.max) * (0.5 + t * 0.5), // Grow towards edge
      colorIndex: colors.length > 0 ? rng.int(0, colors.length - 1) : 0,
    })
  }

  return points
}

/**
 * Main scatter function - dispatches to appropriate distribution algorithm
 */
export function scatter(
  cx: number,
  cy: number,
  width: number,
  height: number,
  config: PatternConfig = {}
): ScatterPoint[] {
  const seed = config.seed ?? DEFAULT_PATTERN_CONFIG.seed
  const rng = createSeededRandom(seed)
  const distribution = config.distribution ?? DEFAULT_PATTERN_CONFIG.distribution

  switch (distribution) {
    case 'grid':
      return scatterGrid(cx, cy, width, height, config, rng)
    case 'radial':
      return scatterRadial(cx, cy, width, height, config, rng)
    case 'spiral':
      return scatterSpiral(cx, cy, width, height, config, rng)
    case 'random':
    default:
      return scatterRandom(cx, cy, width, height, config, rng)
  }
}

/**
 * Apply transform to a point
 */
export function transformPoint(x: number, y: number, point: ScatterPoint): { x: number; y: number } {
  const rad = (point.rotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)

  // Scale then rotate around point center
  const sx = x * point.scale
  const sy = y * point.scale
  const rx = sx * cos - sy * sin
  const ry = sx * sin + sy * cos

  return {
    x: rx + point.x,
    y: ry + point.y,
  }
}
