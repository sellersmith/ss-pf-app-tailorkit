import type { Layer } from '../type'

export function isLayerInsideMultiLayout(layerId: string, layers: Layer[]) {
  const multiLayoutLayers = layers.filter(layer => layer.t === 'multi-layout')

  const layersOfMultiLayout = multiLayoutLayers
    .map(layer => {
      const multiLayoutOptionSet = layer.osl?.find(os => os?.t === 'multi_layout_option')

      const layouts = multiLayoutOptionSet?.ol || []

      const layers = layouts.map(layout => layout.ls).flat()

      return layers
    })
    .flat()

  return layersOfMultiLayout.includes(layerId)
}
