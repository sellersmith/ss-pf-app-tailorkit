import type Konva from 'konva'

const MAX_ATTEMPTS = 10
const MAX_BACKOFF_MS = 500
const BASE_DELAY_MS = 20
const READY_LAYER_DELAY_MS = 50

/**
 * Validates if a Konva node is valid and attached to the stage
 */
function isValidNode(node: Konva.Node | null): node is Konva.Node {
  if (!node) return false

  try {
    const hasGetStage = typeof (node as any).getStage === 'function'
    const hasStage = hasGetStage && !!(node as any).getStage()
    const isNotDestroyed = typeof (node as any).isDestroyed !== 'function' || !(node as any).isDestroyed()

    return hasStage && isNotDestroyed
  } catch {
    return false
  }
}

/**
 * Calculates exponential backoff delay with a maximum limit
 */
function calculateBackoff(attempt: number, hasLayerChildren: boolean): number {
  if (hasLayerChildren) {
    return READY_LAYER_DELAY_MS
  }
  return Math.min(Math.pow(2, attempt) * BASE_DELAY_MS, MAX_BACKOFF_MS)
}

/**
 * Finds and binds transformer nodes with exponential backoff retry logic.
 * Handles cases where nodes may not be immediately available due to
 * async rendering or font loading.
 *
 * @param layerRef - Konva Layer containing the nodes
 * @param trRef - Konva Transformer to bind nodes to
 * @param selectedIds - Array of node IDs to find and bind
 */
export default function findAndBindTransformerNodes(
  layerRef: Konva.Layer,
  trRef: Konva.Transformer,
  selectedIds: string[]
): void {
  // Early exit if no IDs to find
  if (selectedIds.length === 0) {
    trRef.nodes([])
    return
  }

  let attempts = 0

  const findNodes = (): void => {
    // Find and validate all requested nodes
    const rawNodes = selectedIds.map((id: string) => layerRef.findOne(`#${id}`) as Konva.Node | null)
    const nodes: Konva.Node[] = rawNodes.filter(isValidNode)

    // Success: all nodes found
    if (nodes.length === selectedIds.length) {
      trRef.nodes(nodes)
      return
    }

    // Retry with backoff if we haven't exceeded max attempts
    if (attempts < MAX_ATTEMPTS) {
      const hasLayerChildren = (layerRef.children?.length ?? 0) > 0
      const backoffTime = calculateBackoff(attempts, hasLayerChildren)
      attempts++

      setTimeout(() => requestAnimationFrame(findNodes), backoffTime)
      return
    }

    // Max attempts reached - bind whatever nodes we found
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        `[Transformer] Max attempts (${MAX_ATTEMPTS}) reached. Found ${nodes.length}/${selectedIds.length} nodes.`
      )
    }

    trRef.nodes(nodes)
  }

  // Start finding nodes on next animation frame
  requestAnimationFrame(findNodes)
}
