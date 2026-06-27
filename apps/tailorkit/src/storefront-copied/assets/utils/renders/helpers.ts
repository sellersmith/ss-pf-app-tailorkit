import type { Layer } from '../../type'

export function getEssentialLayerProps(layer: Layer) {
  const {
    t: layerType,
    i: layerId,
    osl: optionSetList = [],
    s: { textCreatedBy },
    s: settings,
    ss: shapeSettings,
    printAreaId,
  } = layer

  return {
    layerType,
    layerId,
    optionSetList,
    textCreatedBy,
    shapeSettings,
    settings,
    printAreaId,
  }
}
