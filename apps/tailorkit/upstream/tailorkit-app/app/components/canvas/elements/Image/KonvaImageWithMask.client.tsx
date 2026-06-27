import type Konva from 'konva'
import type { NodeConfig } from 'konva/lib/Node'
import type { RefObject } from 'react'
import { memo, useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { Image as KonvaImageComponent, Group } from 'react-konva'
import { ClipGroupRenderer } from './ClipGroupRenderer'
import { useClipGroup } from './hooks/useClipGroup'
import type { ClipGroupTransformData } from './hooks/useClipGroup'
import type { NodeImage } from '~/types/psd'
import { DEFAULT_MASK_RENDER_CONFIG, IMAGE_SIZE_THRESHOLDS } from '~/utils/canvas/mask-constants'
import { createBrowserCapabilitiesCache } from '~/utils/canvas/browser-capabilities'
import { getOrCreateCanvas, getOrCreateHDPICanvas, setupCanvasContext } from '~/utils/canvas/canvas-utils'
import { processMaskImage } from '~/utils/canvas/image-processing-utils'
import { isSvgImage } from '~/utils/file-types'

type ImageProps = NodeConfig

interface LayerProps extends NodeConfig {
  id: string
  name: string
  onDblClick?: () => void
  x: number
  y: number
}

// Create browser capabilities cache
const getBrowserCapabilities = createBrowserCapabilitiesCache()

export interface IMaskConfig {
  src: string
  invert?: boolean
  globalCompositeOperation?: 'destination-in' | 'source-in' | 'destination-out' | 'source-out'
}

interface IKonvaImageProps {
  width: number
  height: number
  src?: string
  spriteRef?: RefObject<Konva.Image>
  mask?: IMaskConfig
  /**
   * Optional clip group state to render and edit the image inside a fixed container.
   * Coordinates are top-left based for x,y and absoluteWidth/Height for size.
   */
  clipGroup: NodeImage['clipGroup']
  /** When true, we expose the inner image node for transformer and allow dragging/resizing it */
  editInnerImage?: boolean
  /** Callback to report inner image transform in canvas pixel coordinates */
  onInnerTransform?: (state: ClipGroupTransformData) => void
}

function KonvaImageWithMask(props: ImageProps & IKonvaImageProps) {
  const {
    src,
    mask,
    rotation = 0,
    spriteRef: imageRef,
    visible,
    width,
    height,
    clipGroup,
    editInnerImage,
    onInnerTransform,
    ...otherProps
  } = props

  const { src: maskSrc, globalCompositeOperation } = mask || {}
  const { smoothEdges, smoothingStrength, useDevicePixelRatio } = DEFAULT_MASK_RENDER_CONFIG
  const devicePixelRatio = useDevicePixelRatio ? window.devicePixelRatio || 1 : 1

  // Component state
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [maskImg, setMaskImg] = useState<HTMLImageElement | null>(null)
  const [maskedImage, setMaskedImage] = useState<HTMLImageElement | null>(null)

  // Refs for Konva node and canvas management
  const imageNode = useRef<Konva.Image>(null)
  const innerImageNodeRef = useRef<Konva.Image>(null)
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null)

  // Resource cleanup refs
  const abortControllerRef = useRef<AbortController | null>(null)
  const blobUrlsRef = useRef<Set<string>>(new Set())
  const isUnmountedRef = useRef(false)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const maskGenerationRef = useRef<AbortController | null>(null)
  const maskGenerationIdRef = useRef(0)

  // Track which image the maskedImage was created from to detect stale masks
  const maskedImageSourceRef = useRef<HTMLImageElement | null>(null)

  // Browser capabilities (cached)
  const browserCapabilities = getBrowserCapabilities()

  /**
   * Cleanup function to dispose of resources and prevent memory leaks
   */
  const cleanup = useCallback(() => {
    // Cancel pending operations
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    // Cancel mask generation
    if (maskGenerationRef.current) {
      maskGenerationRef.current.abort()
      maskGenerationRef.current = null
    }

    // Clean up blob URLs
    blobUrlsRef.current.forEach(url => {
      try {
        URL.revokeObjectURL(url)
      } catch (error) {
        console.warn('Failed to revoke blob URL:', error)
      }
    })
    blobUrlsRef.current.clear()

    // Clear timers
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }

    // Clear canvas contexts
    if (tempCanvasRef.current) {
      const ctx = tempCanvasRef.current.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, tempCanvasRef.current.width, tempCanvasRef.current.height)
      }
    }

    if (maskCanvasRef.current) {
      const ctx = maskCanvasRef.current.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height)
      }
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isUnmountedRef.current = true
      cleanup()
    }
  }, [cleanup])

  /**
   * Debounce function with immediate execution option
   */
  const debounce = useCallback((fn: () => void, delay: number = 100, immediate = false) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    if (immediate || delay === 0) {
      fn()
      return
    }

    debounceTimerRef.current = setTimeout(() => {
      if (!isUnmountedRef.current) {
        fn()
      }
    }, delay)
  }, [])

  /**
   * Process mask image with size-based optimizations using extracted utilities
   */
  const getProcessedMask = useMemo(() => {
    if (!maskImg || !mask || isUnmountedRef.current) return null

    const maskCanvas = getOrCreateCanvas(maskCanvasRef, width, height)
    if (!maskCanvas) return null

    const maskCtx = maskCanvas.getContext('2d')
    if (!maskCtx) return null

    return processMaskImage(maskCtx, maskImg, width, height, mask, browserCapabilities, smoothEdges, smoothingStrength)
  }, [maskImg, mask, width, height, smoothEdges, smoothingStrength, browserCapabilities])

  /**
   * Load main image and optional mask image with abort controller support
   */
  const loadImage = useCallback(async () => {
    if (!src || isUnmountedRef.current) {
      setImg(null)
      setMaskImg(null)
      return
    }

    // Cancel previous operation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()
    const { signal } = abortControllerRef.current

    // Helper to load an image with abort/error handling
    const loadHtmlImage = (url: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const imgElement = new Image()
        imgElement.crossOrigin = 'anonymous'

        const cleanupListeners = () => {
          imgElement.onload = null
          imgElement.onerror = null
        }

        const handleAbort = () => {
          cleanupListeners()
          reject(new Error('Operation aborted'))
        }

        const handleLoad = () => {
          if (signal.aborted) return handleAbort()
          cleanupListeners()
          resolve(imgElement)
        }

        const handleError = () => {
          if (signal.aborted) return handleAbort()
          cleanupListeners()
          reject(new Error(`Failed to load image: ${url}`))
        }

        imgElement.onload = handleLoad
        imgElement.onerror = handleError

        signal.addEventListener('abort', handleAbort, { once: true })

        imgElement.src = url
      })
    }

    try {
      // Start loading both images in parallel (if maskSrc exists)
      const mainImagePromise = loadHtmlImage(src)
      const maskImagePromise = maskSrc
        ? loadHtmlImage(maskSrc).catch(err => {
            // Capture mask load failure but don't reject whole chain
            if (!signal.aborted) console.error('Mask loading failed:', err)
            return null
          })
        : Promise.resolve(null)

      const [loadedImage, loadedMask] = await Promise.all([mainImagePromise, maskImagePromise])

      if (signal.aborted || isUnmountedRef.current) return

      setImg(loadedImage)
      setMaskImg(loadedMask)

      // Trigger immediate redraw for small images, debounced for large ones
      const refNode = imageRef?.current || imageNode.current
      if (refNode) {
        refNode.getLayer()?.batchDraw()
      }
    } catch (error) {
      if (!signal.aborted) {
        console.error('Failed to load image:', error)
        setImg(null)
        setMaskImg(null)
      }
    }
  }, [src, maskSrc, imageRef])

  /**
   * Create final masked image by combining main image with processed mask
   */
  const createMaskedImage = useCallback(async (): Promise<HTMLImageElement | null> => {
    if (!img || !maskSrc || !maskImg || isUnmountedRef.current) return null
    try {
      const canvas = useDevicePixelRatio
        ? getOrCreateHDPICanvas(tempCanvasRef, width, height, devicePixelRatio)
        : getOrCreateCanvas(tempCanvasRef, width, height)

      if (!canvas) return null

      const ctx = canvas.getContext('2d')
      if (!ctx) return null

      // Clear canvas
      ctx.clearRect(0, 0, width, height)

      // Draw main image
      ctx.save()
      setupCanvasContext(ctx, smoothEdges, smoothingStrength > 0.5 ? 'high' : 'medium')
      ctx.drawImage(img, 0, 0, width, height)
      ctx.restore()

      // Apply processed mask
      if (getProcessedMask) {
        ctx.save()
        ctx.globalCompositeOperation = globalCompositeOperation ?? 'destination-in'
        setupCanvasContext(ctx, smoothEdges, smoothingStrength > 0.5 ? 'high' : 'medium')
        ctx.drawImage(getProcessedMask, 0, 0)
        ctx.restore()
      }

      // Convert to HTMLImageElement
      return new Promise(resolve => {
        canvas.toBlob(blob => {
          if (!blob || isUnmountedRef.current) {
            resolve(null)
            return
          }

          const url = URL.createObjectURL(blob)
          blobUrlsRef.current.add(url)

          const maskedImg = new Image()
          maskedImg.crossOrigin = 'anonymous'
          maskedImg.onload = () => {
            if (!isUnmountedRef.current) {
              resolve(maskedImg)
            } else {
              URL.revokeObjectURL(url)
              resolve(null)
            }
          }
          maskedImg.onerror = () => {
            URL.revokeObjectURL(url)
            blobUrlsRef.current.delete(url)
            resolve(null)
          }
          maskedImg.src = url
        }, 'image/png')
      })
    } catch (error) {
      console.error('Error creating masked image:', error)
      return null
    }
  }, [
    img,
    maskSrc,
    maskImg,
    width,
    height,
    getProcessedMask,
    globalCompositeOperation,
    smoothEdges,
    smoothingStrength,
    useDevicePixelRatio,
    devicePixelRatio,
  ])

  // Create masked image when images are ready
  useEffect(() => {
    // Cancel any pending mask generation
    if (maskGenerationRef.current) {
      maskGenerationRef.current.abort()
      maskGenerationRef.current = null
    }

    // Clear stale maskedImage when img changes to prevent showing old masked image
    if (img && maskedImageSourceRef.current !== img) {
      setMaskedImage(null)
      maskedImageSourceRef.current = null
    }

    if (img && maskSrc && maskImg) {
      const imageSize = width * height

      // Smart debouncing based on image size - prevents UI lag during resize
      let debounceDelay = 0
      if (imageSize > IMAGE_SIZE_THRESHOLDS.VERY_LARGE) {
        debounceDelay = 1000 // 1 second delay for 50MP+ images (like 7943×6377)
      } else if (imageSize > IMAGE_SIZE_THRESHOLDS.LARGE) {
        debounceDelay = 500 // 500ms for 20-50MP images
      } else if (imageSize > IMAGE_SIZE_THRESHOLDS.MEDIUM) {
        debounceDelay = 200 // 200ms for 5-20MP images
      } else if (imageSize > IMAGE_SIZE_THRESHOLDS.SMALL) {
        debounceDelay = 100 // 100ms for 1-5MP images
      }
      // Small images (<1MP) get 0ms delay for immediate response

      // Increment generation ID to track the latest request
      maskGenerationIdRef.current += 1
      const currentGenerationId = maskGenerationIdRef.current

      // Create new abort controller for this mask generation
      maskGenerationRef.current = new AbortController()
      const { signal } = maskGenerationRef.current

      debounce(async () => {
        if (isUnmountedRef.current || signal.aborted) return

        // Check if this is still the latest generation request
        if (currentGenerationId !== maskGenerationIdRef.current) {
          return
        }

        try {
          const maskedImg = await createMaskedImage()

          // Double-check this is still the latest generation after async operation
          if (!isUnmountedRef.current && !signal.aborted && currentGenerationId === maskGenerationIdRef.current) {
            setMaskedImage(maskedImg)
            // Track which img this maskedImage was created from
            maskedImageSourceRef.current = img

            const refNode = imageRef?.current || imageNode.current
            if (refNode) {
              // Immediate redraw for small images, debounced for large
              if (imageSize > IMAGE_SIZE_THRESHOLDS.SMALL) {
                debounce(() => {
                  if (!signal.aborted && currentGenerationId === maskGenerationIdRef.current) {
                    refNode.getLayer()?.batchDraw()
                  }
                }, 16) // Next frame
              } else {
                refNode.getLayer()?.batchDraw()
              }
            }
          }
        } catch (error) {
          if (!signal.aborted && currentGenerationId === maskGenerationIdRef.current) {
            console.error('Error generating masked image:', error)
          }
        }
      }, debounceDelay)
    } else if (!maskSrc) {
      // Only clear masked image when mask is completely removed
      maskGenerationIdRef.current += 1
      setMaskedImage(null)
      maskedImageSourceRef.current = null
    }
    // Don't clear maskedImage when maskImg is still loading to prevent flicker

    // Cleanup function
    return () => {
      if (maskGenerationRef.current) {
        maskGenerationRef.current.abort()
        maskGenerationRef.current = null
      }
    }
  }, [img, maskImg, createMaskedImage, imageRef, maskSrc, debounce, width, height])

  // Load images when component mounts or visibility changes
  useEffect(() => {
    if (visible || visible === undefined) {
      loadImage()
    }
  }, [visible, loadImage])

  const imageToRender = useMemo(() => {
    if (!img) return null

    // If a mask is provided and we have a masked image, use it
    // Otherwise fall back to the original image to prevent flicker
    if (mask && maskedImage) {
      return maskedImage
    }

    // No mask or masked image not ready yet – render the original image
    return img
  }, [img, mask, maskedImage])

  // ClipGroup hooks for inner image interactions
  const { handleInnerDragEnd, createHandleInnerTransformEnd } = useClipGroup({ onInnerTransform })
  const handleInnerTransformEnd = createHandleInnerTransformEnd(imageRef || innerImageNodeRef, innerImageNodeRef)

  // Calculate SVG dimensions with aspect ratio preservation for the default render path
  // This mirrors the logic in ClipGroupRenderer for consistency
  const svgDimensions = useMemo(() => {
    const isSvg = isSvgImage(src)
    if (!isSvg || !img) {
      return { renderWidth: width, renderHeight: height, offsetX: 0, offsetY: 0, needsClipping: false }
    }

    const naturalWidth = img.naturalWidth > 0 ? img.naturalWidth : width
    const naturalHeight = img.naturalHeight > 0 ? img.naturalHeight : height
    const imgAspect = naturalWidth / naturalHeight
    const containerAspect = width / height

    // Only apply if aspect ratios differ significantly
    if (Math.abs(imgAspect - containerAspect) <= 0.01) {
      return { renderWidth: width, renderHeight: height, offsetX: 0, offsetY: 0, needsClipping: false }
    }

    let renderWidth: number
    let renderHeight: number
    let offsetX = 0
    let offsetY = 0

    if (imgAspect > containerAspect) {
      // Image is wider than container - fit to width
      renderWidth = width
      renderHeight = width / imgAspect
      offsetY = (height - renderHeight) / 2
    } else {
      // Image is taller than container - fit to height
      renderHeight = height
      renderWidth = height * imgAspect
      offsetX = (width - renderWidth) / 2
    }

    return { renderWidth, renderHeight, offsetX, offsetY, needsClipping: true }
  }, [src, img, width, height])

  // Render paths
  if (!imageToRender) return null

  // Render clipGroup: container group that clips the inner image and applies mask overlay
  if (clipGroup) {
    return (
      <ClipGroupRenderer
        clipGroup={clipGroup}
        editInnerImage={editInnerImage || false}
        width={width}
        height={height}
        rotation={rotation}
        visible={visible || false}
        img={img!} // Use original image, mask will be applied as overlay
        src={src} // Pass source URL for SVG detection
        mask={mask}
        getProcessedMask={getProcessedMask}
        otherProps={otherProps as LayerProps}
        imageRef={imageRef}
        innerImageNodeRef={innerImageNodeRef}
        imageNode={imageNode}
        handleInnerDragEnd={handleInnerDragEnd}
        handleInnerTransformEnd={handleInnerTransformEnd}
      />
    )
  }

  // Default path: render the single image (masked if provided already baked)
  // For SVG images, preserve aspect ratio and center within container bounds
  const { renderWidth, renderHeight, offsetX, offsetY, needsClipping } = svgDimensions

  if (needsClipping) {
    // SVG with different aspect ratio - use Group with clipping to contain the image
    const { x, y, ...restProps } = otherProps as LayerProps
    return (
      <Group
        x={x}
        y={y}
        width={width}
        height={height}
        rotation={rotation}
        clipFunc={(ctx: CanvasRenderingContext2D) => {
          ctx.rect(0, 0, width, height)
        }}
      >
        <KonvaImageComponent
          ref={imageRef || imageNode}
          x={offsetX}
          y={offsetY}
          visible={visible}
          width={renderWidth}
          height={renderHeight}
          {...restProps}
          image={imageToRender}
        />
      </Group>
    )
  }

  // Raster image or SVG with matching aspect ratio - render normally
  return (
    <KonvaImageComponent
      ref={imageRef || imageNode}
      rotation={rotation}
      visible={visible}
      width={width}
      height={height}
      {...otherProps}
      image={imageToRender}
    />
  )
}

export default memo(KonvaImageWithMask)
