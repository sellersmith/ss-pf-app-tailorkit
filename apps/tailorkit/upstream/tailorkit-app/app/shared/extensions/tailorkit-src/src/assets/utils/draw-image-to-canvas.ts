/**
 * @description Draw layer image into canvas and preload images if needed
 * @param params
 * @returns
 */

import { getShopifyImageInSpecificWidth } from '../fns/shopify-image-url'

export interface IDrawLayerImageArgs {
  layerImage: string
  context?: CanvasRenderingContext2D
  layerDesign: { t: number; l: number; w: number; h: number; r: number }
  preloadImageOnly?: boolean
  images: { [url: string]: HTMLImageElement }
  canvas?: HTMLCanvasElement
}

export const drawLayerImage = async (args: IDrawLayerImageArgs) => {
  const { canvas, context, layerImage, layerDesign, preloadImageOnly, images } = args

  if (!context && !preloadImageOnly) return

  // Draw the current layer image on the canvas
  await new Promise(resolve => {
    // Extract layer design
    const { t: layerTop, l: layerLeft, w: layerWidth, h: layerHeight, r: layerRotation = 0 } = layerDesign

    // Define a function to draw the image
    const drawImage = () => {
      if (context) {
        // Calculate the root point
        const radians = (layerRotation * Math.PI) / 180

        // Move the root point to the top left position of the layer image on the canvas
        context.translate(layerLeft, layerTop)

        // Rotate the context
        context.rotate(radians)

        // Draw the layer image
        context.drawImage(images[layerImage], 0, 0, layerWidth, layerHeight)

        // Restore context state
        context.rotate(-radians)
        context.translate(-layerLeft, -layerTop)

        resolve(1)
      }
    }

    // Preload image once
    if (!images[layerImage]) {
      images[layerImage] = new Image()

      images[layerImage].src = getShopifyImageInSpecificWidth(
        layerImage,
        canvas ? Math.min((canvas.parentNode as HTMLElement)?.offsetWidth || canvas.width, layerWidth) : layerWidth
      )

      // Only preload the image if no parameter is specified
      if (preloadImageOnly) {
        return resolve(1)
      }

      images[layerImage].onload = drawImage
    } else {
      drawImage()
    }
  })
}
