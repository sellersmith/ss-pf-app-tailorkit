import { useEffect, useRef, useState } from 'react'
import { Group, Rect } from 'react-konva'

interface KonvaRemoveBackgroundLoadingProps {
  x: number
  y: number
  width: number
  height: number
  rotation: number
  isVisible: boolean
  progress?: number
}

export function KonvaRemoveBackgroundLoading({
  x,
  y,
  width,
  height,
  rotation,
  isVisible,
}: KonvaRemoveBackgroundLoadingProps) {
  const [shimmerProgress, setShimmerProgress] = useState(0)
  const animationRef = useRef<number>(0)

  // Shimmer animation loop - matches CSS animation duration (1.5s)
  useEffect(() => {
    if (!isVisible) return

    const startTime = Date.now()
    const duration = 1500 // 1.5s like CSS

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = (elapsed % duration) / duration
      setShimmerProgress(progress)
      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isVisible])

  if (!isVisible) return null

  // Calculate shimmer position: from -100% to +100% like CSS translateX
  const shimmerOffset = (shimmerProgress * 2 - 1) * width

  return (
    <Group>
      {/* Main gradient background - matching the CSS gradient */}
      <Rect
        x={x}
        y={y}
        width={width}
        height={height}
        rotation={rotation}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: width, y: height }}
        fillLinearGradientColorStops={[
          0,
          'rgba(160, 203, 255, 0.32)', // #a0cbff52
          0.4,
          'rgba(244, 194, 255, 0.32)', // #f4c2ff52
          0.9,
          'rgba(209, 189, 255, 0.32)', // #d1bdff52
          1,
          'rgba(255, 185, 162, 0.32)', // #ffb9a252
        ]}
        cornerRadius={8}
      />

      {/* Shimmer effect overlay - full width gradient that transforms across */}
      <Rect
        x={x}
        y={y}
        width={width}
        height={height}
        rotation={rotation}
        fillLinearGradientStartPoint={{ x: shimmerOffset, y: 0 }}
        fillLinearGradientEndPoint={{ x: shimmerOffset + width, y: 0 }}
        fillLinearGradientColorStops={[
          0,
          'rgba(255, 255, 255, 0)', // transparent
          0.2,
          'rgba(255, 255, 255, 0.2)', // 20% white
          0.6,
          'rgba(255, 255, 255, 0.5)', // 60% white
          1,
          'rgba(255, 255, 255, 0)', // transparent
        ]}
        cornerRadius={8}
      />
    </Group>
  )
}
