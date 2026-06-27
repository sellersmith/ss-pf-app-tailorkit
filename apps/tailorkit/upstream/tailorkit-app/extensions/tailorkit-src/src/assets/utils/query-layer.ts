import type { Layer, LayerIntegration, OptionSet, ProductPersonalizerElementType } from '../type'

/** Interface for components that provide product personalizer data */
interface ProductPersonalizerProvider {
  productPersonalizer: ProductPersonalizerElementType
}

export const getLayerByFieldset = (instance: ProductPersonalizerProvider, fieldset: HTMLFieldSetElement) => {
  if (!fieldset) {
    return {
      optionSet: undefined,
      layer: undefined,
      layerIntegration: undefined,
    }
  }

  const printAreaId = fieldset.dataset.printAreaId
  const layerId = fieldset.dataset.layerId
  const optionSetId = fieldset.dataset.id

  // Find the target option set in the product personalizer data
  let optionSet: OptionSet | undefined
  let layer: Layer | undefined
  let layerIntegration: LayerIntegration | undefined

  const productPersonalizerData = instance.productPersonalizer

  if (productPersonalizerData && productPersonalizerData.lis) {
    layerIntegration = productPersonalizerData.lis.find((li: LayerIntegration) => li.data?.printAreaId === printAreaId)
    if (layerIntegration && layerIntegration.data?.ls) {
      layer = layerIntegration.data.ls.find((l: Layer) => l.i === layerId)
      if (layer && layer.osl) {
        optionSet = layer.osl.find((os: OptionSet) => os.i === optionSetId)
      }
    }
  }

  return {
    optionSet,
    layer,
    layerIntegration,
  }
}
