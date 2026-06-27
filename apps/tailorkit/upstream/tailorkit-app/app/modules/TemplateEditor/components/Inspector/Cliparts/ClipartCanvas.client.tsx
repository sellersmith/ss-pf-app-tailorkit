import { createLayerStore, deleteLayerStoreById, type TLayerStore } from '~/stores/modules/layer'
import { LayerContainer } from '../../Editor/CardCanvas'
import { useEffect, useMemo, useRef, useState } from 'react'
import type Konva from 'konva'
import { Layer, Stage } from 'react-konva'
import { CLIPART_CANVAS_STAGE, CLIPART_CANVAS_EDITOR_LAYER } from './constants'
import type { IBoundingBoxClipartCanvas } from './fns'
import { uuid } from '~/utils/uuid'
import { ELayerType, EOptionSet } from '~/types/psd'

interface IClipartCanvasProps {
  boundingBox: IBoundingBoxClipartCanvas
  layersStore: TLayerStore[]
  stageRef?: React.RefObject<Konva.Stage>
  /** Enable responsive fit-to-container rendering */
  fitToContainer?: boolean
}

/**
 * ClipartCanvas renders the clipart layers into a Konva Stage that automatically
 * fits the width of its container while preserving the original aspect ratio.
 * Content is scaled uniformly so the canvas never exceeds the visible frame.
 */
export const ClipartCanvas = ({ layersStore, stageRef, boundingBox, fitToContainer = false }: IClipartCanvasProps) => {
  const layerRef = useRef<Konva.Layer>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { width: originalWidth, height: originalHeight } = boundingBox

  const [containerWidth, setContainerWidth] = useState<number>(0)

  // Observe container width to compute responsive canvas size
  useEffect(() => {
    if (!fitToContainer || !containerRef.current) return

    const observer = new ResizeObserver(entries => {
      if (!entries.length) return
      const { width } = entries[0].contentRect
      setContainerWidth(width)
    })

    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [fitToContainer])

  const { stageWidth, stageHeight, scaleFactor } = useMemo(() => {
    if (!fitToContainer) {
      return { stageWidth: originalWidth, stageHeight: originalHeight, scaleFactor: 1 }
    }

    if (!originalWidth || !originalHeight) {
      return { stageWidth: 0, stageHeight: 0, scaleFactor: 1 }
    }

    // If container width not measured yet, fall back to original width to avoid NaN
    const targetWidth = containerWidth > 0 ? containerWidth : originalWidth
    const aspectRatio = originalWidth / originalHeight
    const computedHeight = Math.floor(targetWidth / aspectRatio)
    const s = targetWidth / originalWidth

    return { stageWidth: Math.floor(targetWidth), stageHeight: computedHeight, scaleFactor: s }
  }, [containerWidth, originalWidth, originalHeight, fitToContainer])

  const isReady = stageWidth > 0 && stageHeight > 0

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      {!isReady ? (
        <div style={{ width: '100%', minHeight: 120 }} />
      ) : (
        <Stage id={CLIPART_CANVAS_STAGE} ref={stageRef} width={stageWidth} height={stageHeight}>
          {/* Scale the whole layer so its internal coordinates stay in original units when responsive */}
          <Layer
            id={CLIPART_CANVAS_EDITOR_LAYER}
            ref={layerRef}
            {...(fitToContainer ? { scaleX: scaleFactor, scaleY: scaleFactor } : {})}
          >
            {layersStore.map((layerStore: TLayerStore) => (
              <ClipartLayer key={layerStore.getState()._id} layerStore={layerStore} boundingBox={boundingBox} />
            ))}
          </Layer>
        </Stage>
      )}
    </div>
  )
}

const ClipartLayer = ({
  layerStore,
  boundingBox,
}: {
  layerStore: TLayerStore
  boundingBox: IBoundingBoxClipartCanvas
}) => {
  const layerState = layerStore.getState()
  const { top = 0, left = 0 } = layerState
  const layerPosition = {
    top: top - boundingBox.y,
    left: left - boundingBox.x,
  }
  const layerId = useMemo(() => uuid(), [])

  const _layerStore = useMemo(() => {
    let mask
    if (layerState.type === ELayerType.IMAGE) {
      const maskOptionSet = layerState.optionSet?.find((optionSet: any) => optionSet.type === EOptionSet.MASK_OPTION)
      mask = maskOptionSet?.data?.masks?.[0]
    }

    return createLayerStore({
      ...layerState,
      _id: layerId,
      top: layerPosition.top,
      left: layerPosition.left,
      mask,
    })
  }, [layerPosition.left, layerPosition.top, layerState, layerId])

  useEffect(() => {
    return () => {
      deleteLayerStoreById(layerId)
    }
  }, [layerId])

  return <LayerContainer extractedLayerStore={_layerStore} previewMode={true} />
}
