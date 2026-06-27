import { type LayerDocument } from '~/models/Layer.server'
import { uuid } from '~/utils/uuid'

export const getLayersWithNewIds = (layersDocument: LayerDocument[], newId?: string) => {
  const groupIds: any = {}
  const layers = layersDocument.map((layer: LayerDocument) => {
    if (!groupIds[layer._id]) {
      groupIds[layer._id] = uuid()
    }

    if (layer.parent && !groupIds[layer.parent]) {
      groupIds[layer.parent] = newId || uuid()
    }

    return { ...layer, _id: groupIds[layer._id], parent: (layer.parent && groupIds[layer.parent]) || newId }
  })
  return layers
}
