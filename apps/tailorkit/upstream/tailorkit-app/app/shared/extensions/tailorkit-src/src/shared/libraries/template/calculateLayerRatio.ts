/**
 * Calculate the aspect ratio (width/height) of a layer.
 * - Guards against zero/negative/NaN height by clamping denominator to at least 1.
 * - Returns 0 when width is 0 and height > 0.
 *
 * @param layer - Object containing numeric `width` and `height`.
 * @returns The aspect ratio as a finite number (>= 0).
 */
export function calculateLayerRatio(layer: { width: number; height: number }): number {
  const width = Number.isFinite(layer?.width) ? layer.width : 0
  const height = Number.isFinite(layer?.height) ? layer.height : 0
  const safeHeight = Math.max(1, Math.floor(height))
  const safeWidth = Math.max(0, Math.floor(width))
  return safeWidth / safeHeight
}

/**
 * Parse a pixel size entry in forms like "1024px x 768px", "1024x768", or an object { width, height }.
 * Returns a sanitized width/height with non-negative finite numbers.
 */
function parsePxSizeEntry(entry: string | { width: number; height: number }): { width: number; height: number } {
  if (typeof entry !== 'string') {
    const width = Number.isFinite(entry?.width) ? Math.max(0, entry.width) : 0
    const height = Number.isFinite(entry?.height) ? Math.max(0, entry.height) : 0
    return { width, height }
  }

  const normalized = entry
    .trim()
    .toLowerCase()
    .replace(/[^0-9x:\*×]/g, '')
  // Accept separators: 'x', '×', ':', '*'
  const parts = normalized.split(/[x×:\*]/).filter(Boolean)
  const w = Number(parts[0] || 0)
  const h = Number(parts[1] || 0)
  const width = Number.isFinite(w) ? Math.max(0, w) : 0
  const height = Number.isFinite(h) ? Math.max(0, h) : 0
  return { width, height }
}

/**
 * Find the nearest candidate by aspect ratio from a list of pixel sizes.
 * - Candidates can be strings like "1024px x 1024px", "1024x768" or objects { width, height }.
 * - Returns the best match with metadata.
 *
 * @param layer - Layer dimension.
 * @param candidates - List of pixel sizes.
 */
export function findNearestRatioFromPxSizes(
  layer: { width: number; height: number },
  candidates: Array<string | { width: number; height: number }>
): {
  index: number
  candidate: { width: number; height: number }
  candidateLabel: string
  candidateRatio: number
  layerRatio: number
  difference: number
} {
  const layerRatio = calculateLayerRatio(layer)
  let bestIndex = -1
  let bestDiff = Number.POSITIVE_INFINITY
  let bestCandidate: { width: number; height: number } = { width: 0, height: 0 }

  candidates.forEach((c, idx) => {
    const parsed = parsePxSizeEntry(c)
    const ratio = calculateLayerRatio(parsed)
    const diff = Math.abs(ratio - layerRatio)
    if (diff < bestDiff) {
      bestDiff = diff
      bestIndex = idx
      bestCandidate = parsed
    }
  })

  const candidateRatio = calculateLayerRatio(bestCandidate)
  const candidateLabel = `${Math.round(bestCandidate.width)}x${Math.round(bestCandidate.height)}`
  return {
    index: bestIndex,
    candidate: bestCandidate,
    candidateLabel,
    candidateRatio,
    layerRatio,
    difference: bestDiff,
  }
}

/**
 * Parse an aspect ratio string like "1:1", "4:3", "16:9" to a finite non-negative number (w/h).
 */
function parseAspectRatio(ar: string): number {
  const parts = (ar || '').toString().trim().split(':')
  const w = Number(parts[0] || 0)
  const h = Number(parts[1] || 0)
  const width = Number.isFinite(w) ? Math.max(0, w) : 0
  const height = Number.isFinite(h) ? Math.max(1, h) : 1
  return width / height
}

/**
 * Find the nearest aspect ratio label from a list like ["1:1", "4:3", "3:4", "16:9", "9:16"].
 * Returns the best label with numeric ratio and difference.
 *
 * @param layer - Layer dimension.
 * @param aspectRatios - List of aspect ratio labels in form "w:h".
 */
export function findNearestAspectRatio(
  layer: { width: number; height: number },
  aspectRatios: string[]
): {
  index: number
  label: string
  ratio: number
  layerRatio: number
  difference: number
} {
  const layerRatio = calculateLayerRatio(layer)
  let bestIndex = -1
  let bestDiff = Number.POSITIVE_INFINITY
  let bestLabel = ''
  let bestRatio = 0

  aspectRatios.forEach((label, idx) => {
    const r = parseAspectRatio(label)
    if (!Number.isFinite(r) || r < 0) return
    const diff = Math.abs(r - layerRatio)
    if (diff < bestDiff) {
      bestDiff = diff
      bestIndex = idx
      bestLabel = label
      bestRatio = r
    }
  })

  return { index: bestIndex, label: bestLabel, ratio: bestRatio, layerRatio, difference: bestDiff }
}
