import { useEffect, useRef, useState } from 'react'
import { Group, Rect } from 'react-konva'

interface KonvaShimmerLoadingProps {
  x: number
  y: number
  width: number
  height: number
  rotation: number
  isVisible: boolean
}

/**
 * A subtle gray shimmer placeholder for loading images on Konva canvas.
 * It shows a light-gray gradient that sweeps across the rect, similar to skeleton loaders.
 */
export function KonvaShimmerLoading({ x, y, width, height, rotation, isVisible }: KonvaShimmerLoadingProps) {
  const [progress, setProgress] = useState(0)
  const animRef = useRef<number>()

  useEffect(() => {
    if (!isVisible) return

    const duration = 1500 // ms for full cycle
    const start = Date.now()

    const loop = () => {
      const elapsed = Date.now() - start
      setProgress((elapsed % duration) / duration)
      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [isVisible])

  if (!isVisible) return null

  // shimmer sweeps from left to right across width
  const offset = (progress * 2 - 1) * width // -width .. width

  return (
    <Group listening={false}>
      {/* base gray background */}
      <Rect x={x} y={y} width={width} height={height} rotation={rotation} fill={'#F0F0F0'} cornerRadius={4} />

      {/* shimmer gradient overlay */}
      <Rect
        x={x}
        y={y}
        width={width}
        height={height}
        rotation={rotation}
        fillLinearGradientStartPoint={{ x: offset, y: 0 }}
        fillLinearGradientEndPoint={{ x: offset + width, y: 0 }}
        fillLinearGradientColorStops={[
          0,
          'rgba(255,255,255,0)',
          0.3,
          'rgba(255,255,255,0.6)',
          0.7,
          'rgba(255,255,255,0)',
        ]}
        cornerRadius={4}
        opacity={0.9}
      />
    </Group>
  )
}
