import type Konva from 'konva'
import type { NodeConfig } from 'konva/lib/Node'
import type { RefObject } from 'react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Image as KonvaImageComponent } from 'react-konva'

type ImageProps = NodeConfig

interface IKonvaImageProps {
  width: number
  height: number
  src?: string
  alt?: string
  spriteRef?: RefObject<Konva.Image>
}

/**
 * This component renders image into Konva canvas
 * @param props IKonvaImageProps
 * @returns
 */

function KonvaImage(props: ImageProps & IKonvaImageProps) {
  const { src, rotation = 0, spriteRef: imageRef, visible, ...otherProps } = props

  const [img, setImg] = useState<HTMLImageElement | null>(null)

  const imageNode = useRef<Konva.Image>(null)

  const loadImage = useCallback(() => {
    const image = new Image()

    image.onload = () => {
      image.crossOrigin = 'anonymous' // Set the crossOrigin attribute

      setImg(image)

      if (imageRef) {
        const refNode = imageRef.current
        if (refNode) {
          refNode.getLayer()?.batchDraw()
        }
      } else {
        const imageNodeRef = imageNode.current
        if (imageNodeRef) {
          imageNodeRef.getLayer()?.batchDraw()
          // imageNodeRef.cache({ pixelRatio: 0.5 })
        }
      }
    }

    image.src = src ?? ''
  }, [src, imageRef])

  useEffect(() => {
    if (visible || visible === undefined) {
      loadImage()
    }
  }, [visible, loadImage])

  return (
    img && (
      <KonvaImageComponent
        ref={imageRef || imageNode}
        rotation={rotation}
        visible={visible}
        {...otherProps}
        image={img}
      />
    )
  )
}

export default memo(KonvaImage)
