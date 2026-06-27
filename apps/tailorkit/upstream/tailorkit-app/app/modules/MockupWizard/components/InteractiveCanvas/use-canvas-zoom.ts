import { useState, useRef, useCallback } from 'react'
import type { ViewPort, Dimension } from '~/types/template'
import { calculateOnZooming, calculateOnInitTemplate } from '~/utils/canvas/zoom'
import { MIN_SCALE } from '~/constants/canvas'

export interface UseCanvasZoomReturn {
  viewport: ViewPort
  setViewport: (v: ViewPort) => void
  dimension: Dimension | null
  setDimension: (d: Dimension | null) => void
  containerDimension: Dimension | null
  setContainerDimension: (d: Dimension | null) => void
  viewportInitializedRef: React.MutableRefObject<boolean>
  viewportRef: React.MutableRefObject<ViewPort>
  isWheeling: boolean
  isWithinBounds: (newViewport: ViewPort) => boolean
  handleWheel: (event: WheelEvent) => void
  handleTouchPan: (deltaX: number, deltaY: number) => void
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
}

export function useCanvasZoom(): UseCanvasZoomReturn {
  const [viewport, setViewport] = useState<ViewPort>({ scale: 1, left: 0, top: 0 })
  const [dimension, setDimension] = useState<Dimension | null>(null)
  const [containerDimension, setContainerDimension] = useState<Dimension | null>(null)
  const [isWheeling, setIsWheeling] = useState(false)

  const viewportInitializedRef = useRef(false)
  const wheelTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const viewportRef = useRef(viewport)
  viewportRef.current = viewport

  const isWithinBounds = useCallback(
    (newViewport: ViewPort): boolean => {
      if (!dimension || !containerDimension) return true

      const { left, top, scale } = newViewport
      const scaledWidth = dimension.width * scale
      const scaledHeight = dimension.height * scale

      const visibleWidth = Math.min(containerDimension.width, scaledWidth + left) - Math.max(0, left)
      const visibleHeight = Math.min(containerDimension.height, scaledHeight + top) - Math.max(0, top)

      const visiblePercentageWidth = (visibleWidth / scaledWidth) * 100
      const visiblePercentageHeight = (visibleHeight / scaledHeight) * 100

      return visiblePercentageWidth >= 5 && visiblePercentageHeight >= 5
    },
    [dimension, containerDimension]
  )

  const handleWheel = useCallback(
    (event: WheelEvent) => {
      const isZooming = event.ctrlKey || event.metaKey
      const { scale, left, top } = viewport

      if (!dimension) return

      if (wheelTimeoutRef.current) {
        clearTimeout(wheelTimeoutRef.current)
      }

      if (!isWheeling) {
        setIsWheeling(true)
      }

      if (isZooming) {
        const newViewport = calculateOnZooming({
          e: event,
          oldScale: scale,
          oldLeft: left,
          oldTop: top,
          speedFactor: 0.8,
        })

        if (newViewport.scale < MIN_SCALE) {
          newViewport.scale = MIN_SCALE
        }

        if (isWithinBounds(newViewport)) {
          setViewport(newViewport)
        }
      } else {
        const panSpeed = 1.0
        const newLeft = left - event.deltaX * panSpeed
        const newTop = top - event.deltaY * panSpeed
        const newViewport = { scale, left: newLeft, top: newTop }

        if (isWithinBounds(newViewport)) {
          setViewport(newViewport)
        }
      }

      wheelTimeoutRef.current = setTimeout(() => {
        setIsWheeling(false)
      }, 100)
    },
    [viewport, dimension, isWheeling, isWithinBounds]
  )

  const handleTouchPan = useCallback(
    (deltaX: number, deltaY: number) => {
      const { scale, left, top } = viewport
      const newViewport = { scale, left: left + deltaX, top: top + deltaY }

      if (isWithinBounds(newViewport)) {
        setViewport(newViewport)
      }
    },
    [viewport, isWithinBounds]
  )

  const zoomIn = useCallback(() => {
    const newScale = Math.min(viewport.scale * 1.25, 5.0)
    if (!containerDimension || !dimension) return

    const centerX = containerDimension.width / 2
    const centerY = containerDimension.height / 2
    const speed = newScale / viewport.scale - 1
    const newLeft = centerX - (centerX - viewport.left) * (1 + speed)
    const newTop = centerY - (centerY - viewport.top) * (1 + speed)

    const newViewport = { scale: newScale, left: newLeft, top: newTop }
    if (isWithinBounds(newViewport)) {
      setViewport(newViewport)
    }
  }, [viewport, containerDimension, dimension, isWithinBounds])

  const zoomOut = useCallback(() => {
    const newScale = Math.max(viewport.scale / 1.25, MIN_SCALE)
    if (!containerDimension || !dimension) return

    const centerX = containerDimension.width / 2
    const centerY = containerDimension.height / 2
    const speed = newScale / viewport.scale - 1
    const newLeft = centerX - (centerX - viewport.left) * (1 + speed)
    const newTop = centerY - (centerY - viewport.top) * (1 + speed)

    const newViewport = { scale: newScale, left: newLeft, top: newTop }
    if (isWithinBounds(newViewport)) {
      setViewport(newViewport)
    }
  }, [viewport, containerDimension, dimension, isWithinBounds])

  const resetZoom = useCallback(() => {
    if (!containerDimension || !dimension) return

    const initialViewport = calculateOnInitTemplate(
      containerDimension.width,
      containerDimension.height,
      { width: dimension.width, height: dimension.height },
      false
    )
    setViewport(initialViewport)
  }, [containerDimension, dimension])

  return {
    viewport,
    setViewport,
    dimension,
    setDimension,
    containerDimension,
    setContainerDimension,
    viewportInitializedRef,
    viewportRef,
    isWheeling,
    isWithinBounds,
    handleWheel,
    handleTouchPan,
    zoomIn,
    zoomOut,
    resetZoom,
  }
}
