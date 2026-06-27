import type { MockupView, VariantIntegration } from '~/types/integration'

/**
 * Gets the selected view ID from a variant's mockup.
 * Falls back to the first view's ID if no view is selected, or empty string if no views exist.
 */
export function getSelectedViewId(variant: VariantIntegration | null | undefined): string {
  if (!variant?.mockup) return ''
  return variant.mockup.selectedViewId || variant.mockup.views?.[0]?._id || ''
}

type LayerLike = {
  _id: string
  x?: number
  y?: number
  width?: number
  height?: number
  rotation?: number
  visible?: boolean
  getState?: () => LayerLike
}

/**
 * Returns ordered, merged layer objects for rendering a specific view.
 * - Order is taken from view.layers
 * - Transform fields (x,y,width,height,rotation) are merged with overrides if present
 */
export function buildViewRenderLayers(args: {
  view: Pick<MockupView, 'layers' | 'overrides'>
  layerStores: LayerLike[]
}): LayerLike[] {
  const { view, layerStores } = args

  // Map layerId -> base layer state for O(1) lookup
  const idToLayer: Record<string, LayerLike> = {}
  for (const store of layerStores) {
    const base = typeof store.getState === 'function' ? store.getState() : store
    if (base?._id) idToLayer[base._id] = base
  }

  // Build ordered list using view.layers, skipping missing layers safely
  const ordered: LayerLike[] = []
  for (const item of (view.layers as any[]) || []) {
    const layerId = typeof item === 'string' ? item : item?._id || item?.getState?.()?._id
    if (!layerId) continue
    const base = idToLayer[layerId]
    if (!base) continue

    const ov = (view.overrides || ({} as any))[layerId] || {}

    const isFalseLike = (v: unknown) => v === false || v === 0 || v === '0' || v === 'false'
    const asNumber = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : undefined)

    // Respect per-view visibility; default visible when undefined
    if (isFalseLike(ov.visible)) {
      continue
    }

    // Also respect base layer visibility when not explicitly overridden in the view
    if (isFalseLike((base as any)?.visible) && ov.visible === undefined) {
      continue
    }

    ordered.push({
      ...base,
      ...(asNumber(ov.x) !== undefined ? { x: asNumber(ov.x) } : {}),
      ...(asNumber(ov.y) !== undefined ? { y: asNumber(ov.y) } : {}),
      ...(asNumber(ov.width) !== undefined ? { width: asNumber(ov.width) } : {}),
      ...(asNumber(ov.height) !== undefined ? { height: asNumber(ov.height) } : {}),
      ...(asNumber(ov.rotation) !== undefined ? { rotation: asNumber(ov.rotation) } : {}),
    })
  }

  return ordered
}
