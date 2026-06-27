/**
 * Effect Groups Calculator
 *
 * Calculates which paths are affected by clip/hole paths in SVG-only mode.
 * Extracted from VectorEditor for reuse across modules.
 */

/**
 * Represents a clip or hole effect group
 * A clip/hole path affects all paths below it until the next clip/hole path
 */
export interface SvgEffectGroup {
  /** Type of effect */
  type: 'clip' | 'hole'
  /** Index of the path acting as clip/hole */
  effectPathIndex: number
  /** Indices of paths affected by this clip/hole (between this and next effect path) */
  affectedPathIndices: number[]
  /** Generated ID for the clipPath/mask definition */
  defId: string
}

/**
 * Calculate effect groups from clip/hole path indices
 *
 * Rules:
 * 1. Paths are processed from highest index to lowest (top to bottom in layer stack)
 * 2. Each clip/hole path affects all normal paths below it until the next clip/hole
 * 3. The clip/hole path itself renders normally AND creates the effect
 * 4. A path that is itself a clip/hole is not affected by other clip/holes above it
 *
 * @param pathCount Total number of paths
 * @param clipPathIndices Indices of paths marked as clip
 * @param holePathIndices Indices of paths marked as hole
 * @returns Array of effect groups
 */
export function calculateEffectGroups(
  pathCount: number,
  clipPathIndices: number[],
  holePathIndices: number[]
): SvgEffectGroup[] {
  // Combine and sort clip/hole indices from highest to lowest (top to bottom)
  const effectPaths = [
    ...clipPathIndices.map(index => ({ index, type: 'clip' as const })),
    ...holePathIndices.map(index => ({ index, type: 'hole' as const })),
  ].sort((a, b) => b.index - a.index)

  if (effectPaths.length === 0) {
    return []
  }

  const groups: SvgEffectGroup[] = []
  const effectIndices = new Set([...clipPathIndices, ...holePathIndices])

  for (let i = 0; i < effectPaths.length; i++) {
    const current = effectPaths[i]
    // Next effect path (or -1 if this is the last one)
    const nextEffectIndex = effectPaths[i + 1]?.index ?? -1

    // Collect affected paths: between current (exclusive) and next effect (exclusive)
    // A path is affected if it's below the current effect path and above the next effect path
    const affectedPaths: number[] = []
    for (let j = current.index - 1; j > nextEffectIndex; j--) {
      // Skip paths that are themselves clip/hole paths
      if (!effectIndices.has(j)) {
        affectedPaths.push(j)
      }
    }

    // Only create a group if there are paths to affect
    if (affectedPaths.length > 0) {
      groups.push({
        type: current.type,
        effectPathIndex: current.index,
        affectedPathIndices: affectedPaths,
        defId: `svg-${current.type}-${current.index}`,
      })
    }
  }

  return groups
}

/**
 * Find the effect group that affects a specific path index
 * @param pathIndex The path index to check
 * @param effectGroups The calculated effect groups
 * @returns The affecting group or undefined if not affected
 */
export function findAffectingGroup(pathIndex: number, effectGroups: SvgEffectGroup[]): SvgEffectGroup | undefined {
  return effectGroups.find(group => group.affectedPathIndices.includes(pathIndex))
}
