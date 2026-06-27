import { useEffect, useRef, useState, useMemo } from 'react'
import { Stage, Layer, Image as KonvaImage, Group } from 'react-konva'
import type { ProductRecommendationData } from './fns'

interface ClipartRendererProps {
  productImage: {
    url: string
    alt: string
  }
  clipart?: ProductRecommendationData['clipart']
  onImageLoad?: () => void
  // Optional: clamp the rendered height to a percentage of viewport height
  maxHeightVh?: number
}

/**
 * Konva-based clipart renderer that overlays clip-art on product images.
 *
 * The component stretches to the full width of its parent and automatically
 * calculates its height from the original image aspect ratio, so it never
 * forces a fixed 256 × 256 square that can cause extra scrolling.
 */
export default function ClipartRenderer({ productImage, clipart, onImageLoad, maxHeightVh }: ClipartRendererProps) {
  /* ------------------------------------------------------------------ */
  /*  Refs & state                                                      */
  /* ------------------------------------------------------------------ */
  const containerRef = useRef<HTMLDivElement>(null)
  const productImageRef = useRef<HTMLImageElement>()
  const clipartImageRef = useRef<HTMLImageElement>()

  const [containerWidth, setContainerWidth] = useState<number>(0)
  const [productImageLoaded, setProductImageLoaded] = useState(false)
  const [clipartImageLoaded, setClipartImageLoaded] = useState(false)
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 })
  const [viewportHeight, setViewportHeight] = useState<number>(typeof window !== 'undefined' ? window.innerHeight : 0)

  /* ------------------------------------------------------------------ */
  /*  Observe container size                                            */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!containerRef.current) return

    const observer = new ResizeObserver(entries => {
      if (!entries.length) return
      const { width } = entries[0].contentRect
      setContainerWidth(width)
    })

    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // Track viewport height for maxHeightVh calculations
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onResize = () => setViewportHeight(window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  /* ------------------------------------------------------------------ */
  /*  Load product image                                                */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!productImage.url) return

    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      setImageDimensions({ width: img.width, height: img.height })
      setProductImageLoaded(true)
      onImageLoad?.()
    }
    img.onerror = () => {
      // eslint-disable-next-line no-console
      console.error('Failed to load product image:', productImage.url)
      setProductImageLoaded(false)
    }
    img.src = productImage.url
    productImageRef.current = img

    return () => {
      setProductImageLoaded(false)
      setImageDimensions({ width: 0, height: 0 })
    }
  }, [productImage.url, onImageLoad])

  /* ------------------------------------------------------------------ */
  /*  Load clip-art image (optional)                                    */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!clipart?.url) {
      setClipartImageLoaded(false)
      return
    }

    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => setClipartImageLoaded(true)
    img.onerror = () => {
      // eslint-disable-next-line no-console
      console.error('Failed to load clipart image:', clipart.url)
      setClipartImageLoaded(false)
    }
    img.src = clipart.url
    clipartImageRef.current = img

    return () => setClipartImageLoaded(false)
  }, [clipart?.url])

  /* ------------------------------------------------------------------ */
  /*  Stage dimensions (fit to width)                                   */
  /* ------------------------------------------------------------------ */
  const stageDimensions = useMemo(() => {
    if (!imageDimensions.width || !imageDimensions.height || containerWidth === 0) {
      return { width: 0, height: 0 }
    }

    const aspectRatio = imageDimensions.width / imageDimensions.height
    const naturalHeight = containerWidth / aspectRatio

    if (maxHeightVh && viewportHeight > 0) {
      const maxHeightPx = (viewportHeight * maxHeightVh) / 100
      const clampedHeight = Math.min(naturalHeight, maxHeightPx)
      const clampedWidth = clampedHeight * aspectRatio
      return {
        width: clampedWidth,
        height: clampedHeight,
      }
    }

    return {
      width: containerWidth,
      height: naturalHeight,
    }
  }, [imageDimensions, containerWidth, maxHeightVh, viewportHeight])

  /* ------------------------------------------------------------------ */
  /*  Clip-art transform                                                */
  /* ------------------------------------------------------------------ */
  const clipartProps = useMemo(() => {
    if (!clipart || !clipartImageLoaded || !productImageLoaded) return null

    // Absolute values returned by the server (based on original product image)
    const absX = clipart.position.x
    const absY = clipart.position.y
    const absW = clipart.dimensions.width
    const absH = clipart.dimensions.height

    // Scale factors between original image size and displayed size
    const scaleX = stageDimensions.width / imageDimensions.width
    const scaleY = stageDimensions.height / imageDimensions.height

    const x = absX * scaleX
    const y = absY * scaleY
    const width = absW * scaleX
    const height = absH * scaleY

    return {
      x: x + width / 2,
      y: y + height / 2,
      width,
      height,
      rotation: clipart.rotation,
      offsetX: width / 2,
      offsetY: height / 2,
    }
  }, [clipart, clipartImageLoaded, productImageLoaded, stageDimensions, imageDimensions])

  /* ------------------------------------------------------------------ */
  /*  Render                                                            */
  /* ------------------------------------------------------------------ */
  const isReady
    = productImageLoaded && productImageRef.current && stageDimensions.width > 0 && stageDimensions.height > 0

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f6f6f7',
        borderRadius: '8px',
        maxHeight: maxHeightVh ? `${maxHeightVh}vh` : undefined,
        overflow: maxHeightVh ? 'hidden' : undefined,
      }}
    >
      {!isReady ? (
        <div
          style={{
            width: '100%',
            minHeight: '120px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#666',
          }}
        >
          Loading product image…
        </div>
      ) : (
        <Stage width={stageDimensions.width} height={stageDimensions.height} style={{ display: 'block' }}>
          <Layer>
            {/* Product image */}
            <KonvaImage
              image={productImageRef.current}
              width={stageDimensions.width}
              height={stageDimensions.height}
              alt={productImage.alt}
            />

            {/* Optional clip-art overlay */}
            {clipart && clipartProps && clipartImageRef.current && (
              <Group>
                <KonvaImage
                  image={clipartImageRef.current}
                  x={clipartProps.x}
                  y={clipartProps.y}
                  width={clipartProps.width}
                  height={clipartProps.height}
                  rotation={clipartProps.rotation}
                  offsetX={clipartProps.offsetX}
                  offsetY={clipartProps.offsetY}
                  alt={clipart.alt}
                  opacity={0.9}
                />
              </Group>
            )}
          </Layer>
        </Stage>
      )}
    </div>
  )
}
