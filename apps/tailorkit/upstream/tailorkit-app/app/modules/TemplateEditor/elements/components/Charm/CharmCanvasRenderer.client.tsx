import type { TLayerStore } from '~/stores/modules/layer'

interface CharmCanvasRendererProps {
  layerStore: TLayerStore
}

/**
 * CHARM layers are virtual — they exist for the toolbar/inspector pipeline only.
 * All canvas rendering happens in CharmNodeCanvasRenderer.
 */
export function CharmCanvasRenderer(_props: CharmCanvasRendererProps) {
  return null
}
