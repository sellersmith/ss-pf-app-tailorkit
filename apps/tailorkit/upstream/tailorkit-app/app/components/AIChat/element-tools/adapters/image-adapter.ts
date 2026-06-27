/**
 * Image adapter — creates IMAGE layers for buyer photo upload.
 * Creates a blank image placeholder with enableBuyerImage=true.
 * Uses createLayerStore directly (createImageElements needs a mediaFile).
 */

import type { ElementAdapter, EditorContext } from '../types'
import type { TLayerStore } from '~/stores/modules/layer'
import { createLayerStore } from '~/stores/modules/layer'
import { ELayerType } from '~/types/psd'
import { uuid } from '~/utils/uuid'
import type { LayerDocument } from '~/models/Layer.server'

const PLACEHOLDER_IMAGE_SRC
  = 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/placeholder-images-image_large_339ca399-e3a9-4c00-b82f-53279ab385e0.webp?v=1775191193'

export class ImageAdapter implements ElementAdapter {
  createElement(args: Record<string, any>, context: EditorContext): TLayerStore {
    const width = Math.round(context.canvasWidth / 4)
    const height = Math.round(context.canvasHeight / 4)
    const top = Math.round((context.canvasHeight - height) / 2)
    const left = Math.round((context.canvasWidth - width) / 2)

    const layer = {
      _id: uuid(),
      type: ELayerType.IMAGE,
      label: args.label || 'Image',
      visible: true,
      parent: '',
      width,
      height,
      top,
      left,
      rotate: 0,
      shopDomain: context.shopDomain,
      image: {
        _id: uuid(),
        width,
        height,
        src: PLACEHOLDER_IMAGE_SRC,
        originalSrc: PLACEHOLDER_IMAGE_SRC,
        imageName: 'placeholder',
      },
      settings: {
        enableBuyerImage: true,
        enableSellerImage: false,
        imageUploaderOptions: {
          allowCustomerUploadImage: true,
          allowCustomerToEditImage: {
            allowTransform: true,
          },
        },
      },
    } as unknown as LayerDocument

    const store = createLayerStore(layer)
    return store
  }

  removeElement(_layerStore: TLayerStore): void {
    // Handled by pipeline
  }
}
