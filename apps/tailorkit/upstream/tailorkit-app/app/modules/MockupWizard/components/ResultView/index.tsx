/* eslint-disable max-len */
/* eslint-disable max-lines */
import type { TFunction } from 'i18next'
import type { ProcessingParameters, ShapeSelection, TemplatePosition } from '../../types'
import styles from '../../styles.module.css'
import ParameterControls from '../ParameterControls'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Trans } from 'react-i18next'
import { useTemplateComposition } from '../../hooks/useTemplateComposition'
import {
  BlockStack,
  Button,
  ButtonGroup,
  InlineGrid,
  InlineStack,
  Spinner,
  Text,
  Banner,
  Tooltip,
} from '@shopify/polaris'
import { PlusIcon, MinusIcon, EditIcon, SearchIcon } from '@shopify/polaris-icons'
import useScreenBreakpoints from '~/utils/hooks/use-screen-breakpoints'
import TemplateManipulator from './TemplateManipulator'
import { UI_TIMINGS } from '../../constants'
import { calculateOnZooming, calculateOnInitTemplate } from '~/utils/canvas/zoom'
import { MIN_SCALE } from '~/constants/canvas'
import { useTouchGestures } from '../../hooks/useTouchGestures'

const ZOOM_FACTOR = 1.25 // Multiplicative zoom — matches InteractiveCanvas
const ZOOM_MIN = 0.25
const ZOOM_MAX = 4

interface ResultViewProps {
  // Image data
  originalImage: HTMLImageElement | null
  processedImageUrl: string | null | undefined
  transparentAreas: any[]

  // Template data
  templateImages: string[]
  templatePositioningMode: 'fit' | 'fill'

  // Processing parameters
  processingParameters: ProcessingParameters
  shapeSelections: ShapeSelection[]
  showAdvancedSettings: boolean

  // State
  isReprocessing: boolean

  // Processed dimensions for scaling (when image was downscaled during processing)
  processedDimensions?: { width: number; height: number; scale: number } | null

  /** Hide the settings panel, banner, and zoom controls. Canvas renders full-width. */
  hideSettings?: boolean
  /** Show floating zoom overlay at bottom-left instead of below-canvas controls (modal mode). */
  floatingZoomOnDesktop?: boolean
  /** Pass compositeOnlyMode to ParameterControls — skip tabs, show only Composite controls. */
  compositeOnlyMode?: boolean
  /** Custom content to render in the right column when hideSettings is true */
  sideContent?: React.ReactNode
  /** Fixed height for the result view container (e.g. 'calc(80vh - 280px)') */
  containerHeight?: string

  /** Pre-computed positions to seed the composite on first render (from stored mockupResult).
   *  Used as positionOverrides when transparentAreas is empty (direct advance without re-processing). */
  initialTemplatePositions?: TemplatePosition[]
  /** Whether initialTemplatePositions are already computed (fitted/manipulated) vs raw area bounds.
   *  When true, positions are used directly (no fit/fill recalculation). */
  initialPositionsAreComputed?: boolean

  // Actions
  updateParameter: (key: keyof ProcessingParameters, value: any) => void
  onTemplatePositioningModeChange: (mode: 'fit' | 'fill') => void
  updateTemplatePositions: (positions: TemplatePosition[]) => void

  /** When true, template is drawn on top of full product image (no mask layer) */
  noMask?: boolean

  // Translation
  t: TFunction
}

export default function ResultView({
  originalImage,
  processedImageUrl,
  transparentAreas,
  templateImages,
  templatePositioningMode,
  processingParameters,
  shapeSelections,
  showAdvancedSettings,
  isReprocessing,
  processedDimensions,
  hideSettings = false,
  floatingZoomOnDesktop = false,
  compositeOnlyMode = false,
  sideContent,
  containerHeight,
  initialTemplatePositions,
  initialPositionsAreComputed,
  updateParameter,
  onTemplatePositioningModeChange,
  updateTemplatePositions,
  noMask = false,
  t,
}: ResultViewProps) {
  const { isMobileView } = useScreenBreakpoints()
  const { compositCanvasRef, processedImageLoaded, drawComposite, setProcessedImageLoaded }
    = useTemplateComposition(templateImages)

  // Template manipulator (interactive resize/rotate/move overlay)
  const [showManipulator, setShowManipulator] = useState(true)
  const [templatePositions, setTemplatePositions] = useState<TemplatePosition[]>([])
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 })
  // Track whether the user has manipulated template positions (via the edit overlay).
  // When true, template image changes preserve the manipulated position/size/rotation.
  const hasManipulatedRef = useRef(false)
  const editButtonWrapperRef = useRef<HTMLDivElement>(null)
  // Track whether positions come from initial seed (area bounds) vs actual user manipulation.
  // Initial seed positions need fit/fill calculation; user-manipulated positions are used directly.
  const isInitialSeedRef = useRef(false)

  // Seed template positions from stored mockupResult (direct advance without re-processing).
  // Only mark as initial seed (fit/fill needed) when positions are raw area bounds from step 3.
  // Computed positions (from prior drawComposite or user manipulation) are used directly.
  useEffect(() => {
    if (initialTemplatePositions && initialTemplatePositions.length > 0 && templatePositions.length === 0) {
      setTemplatePositions(initialTemplatePositions)
      if (noMask) {
        // No-mask: no transparentAreas to fall through to, so force positionOverrides usage.
        // isInitialSeedRef=true when positions are raw bounds so fit/fill is applied.
        hasManipulatedRef.current = true
        isInitialSeedRef.current = !initialPositionsAreComputed
      } else {
        // Normal masked flow: for raw area bounds, leave hasManipulatedRef=false
        // so the draw effect falls through to the transparentAreas branch which has
        // sourceShapeDimensions for correct fitting of rotated/freeform shapes.
        hasManipulatedRef.current = !!initialPositionsAreComputed
        isInitialSeedRef.current = false
      }
    }
  }, [initialTemplatePositions]) // eslint-disable-line react-hooks/exhaustive-deps

  // Store draw params in refs so manipulator handler can trigger recomposite
  const drawParamsRef = useRef<{
    originalImage: HTMLImageElement | null
    transparentAreas: any[]
    processedImageUrl: string | null | undefined
    templatePositioningMode: 'fit' | 'fill'
    isMobileView: boolean
    processedDimensions?: { width: number; height: number; scale: number } | null
  }>({ originalImage, transparentAreas, processedImageUrl, templatePositioningMode, isMobileView, processedDimensions })
  drawParamsRef.current = {
    originalImage,
    transparentAreas,
    processedImageUrl,
    templatePositioningMode,
    isMobileView,
    processedDimensions,
  }

  // Handle manipulator changes — redraw composite with the new positions in real-time.
  // Sets hasManipulatedRef so subsequent template image changes preserve the user's adjustments.
  // Clears isInitialSeedRef since these are actual user-chosen positions (draw directly, no fit).
  const handleManipulatorChange = useCallback(
    (index: number, newPos: TemplatePosition) => {
      hasManipulatedRef.current = true
      isInitialSeedRef.current = false
      setTemplatePositions(prev => {
        const updated = [...prev]
        updated[index] = newPos

        // Redraw composite with position overrides so template moves on-canvas
        const p = drawParamsRef.current
        if (p.originalImage && (processedImageLoaded || noMask)) {
          drawComposite(
            p.originalImage,
            p.transparentAreas,
            p.processedImageUrl,
            p.templatePositioningMode,
            undefined, // don't update positions from this draw
            p.isMobileView,
            p.processedDimensions ?? undefined,
            updated, // position overrides
            false,
            noMask
          )
          // Trigger display canvas redraw to show updated composite
          setDrawVersion(v => v + 1)
        }

        // Defer parent state update to avoid setState-during-render warning
        // (updateTemplatePositions sets state on MockupWizard via useImageProcessing)
        queueMicrotask(() => updateTemplatePositions(updated))

        return updated
      })
    },
    [updateTemplatePositions, drawComposite, processedImageLoaded, noMask]
  )

  // ============================================================================
  // Viewport — IDENTICAL to InteractiveCanvas architecture:
  // - Display canvas pixel buffer = container dimensions (width:100%, height:100%)
  // - Viewport applied via ctx.translate + ctx.scale (zero CSS transforms)
  // - onWheel on the display canvas → calculateOnZooming (e.offsetX/Y)
  // - Initial fit via calculateOnInitTemplate
  // ============================================================================
  const [viewport, setViewport] = useState({ scale: 1, left: 0, top: 0 })
  const viewportRef = useRef(viewport)
  viewportRef.current = viewport
  const imageWrapperRef = useRef<HTMLDivElement>(null)
  const displayCanvasRef = useRef<HTMLCanvasElement>(null)
  const wheelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isWheeling, setIsWheeling] = useState(false)
  const redrawRequestRef = useRef<number>(0)
  const [drawVersion, setDrawVersion] = useState(0)
  const viewportInitializedRef = useRef(false)

  const zoom = viewport.scale

  const handleZoomIn = useCallback(() => {
    setViewport(v => ({ ...v, scale: Math.min(v.scale * ZOOM_FACTOR, ZOOM_MAX) }))
  }, [])
  const handleZoomOut = useCallback(() => {
    setViewport(v => ({ ...v, scale: Math.max(v.scale / ZOOM_FACTOR, ZOOM_MIN) }))
  }, [])
  const handleMobileZoomIn = useCallback(() => {
    setViewport(v => ({ ...v, scale: Math.min(v.scale * 1.25, ZOOM_MAX) }))
  }, [])
  const handleMobileZoomOut = useCallback(() => {
    setViewport(v => ({ ...v, scale: Math.max(v.scale / 1.25, ZOOM_MIN) }))
  }, [])

  const handleZoomReset = useCallback(() => {
    const display = displayCanvasRef.current
    if (!display || !canvasDimensions.width) return
    const vp = calculateOnInitTemplate(
      display.offsetWidth,
      display.offsetHeight,
      { width: canvasDimensions.width, height: canvasDimensions.height },
      false
    )
    setViewport(vp)
  }, [canvasDimensions])

  // Wheel handler — onWheel is on the display canvas so e.offsetX/Y is correct
  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLCanvasElement>) => {
      if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current)
      if (!isWheeling) setIsWheeling(true)

      const isZooming = event.ctrlKey || event.metaKey
      if (isZooming) {
        const newVp = calculateOnZooming({
          e: event.nativeEvent,
          oldScale: viewport.scale,
          oldLeft: viewport.left,
          oldTop: viewport.top,
          speedFactor: 0.8,
        })
        newVp.scale = Math.max(MIN_SCALE, Math.min(newVp.scale, ZOOM_MAX))
        setViewport(newVp)
      } else {
        setViewport(v => ({ ...v, left: v.left - event.deltaX, top: v.top - event.deltaY }))
      }

      wheelTimeoutRef.current = setTimeout(() => setIsWheeling(false), 100)
    },
    [isWheeling, viewport]
  )

  // Prevent all wheel events from scrolling parent containers.
  // The canvas uses wheel for panning (non-modifier) and zooming (ctrl/meta).
  useEffect(() => {
    const wrapper = imageWrapperRef.current
    if (!wrapper) return
    const preventZoom = (e: WheelEvent) => {
      e.preventDefault()
    }
    const preventGesture = (e: Event) => e.preventDefault()
    wrapper.addEventListener('wheel', preventZoom, { passive: false })
    wrapper.addEventListener('gesturestart', preventGesture, { passive: false })
    wrapper.addEventListener('gesturechange', preventGesture, { passive: false })
    return () => {
      wrapper.removeEventListener('wheel', preventZoom)
      wrapper.removeEventListener('gesturestart', preventGesture)
      wrapper.removeEventListener('gesturechange', preventGesture)
      if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current)
    }
  }, [])

  // Resize display canvas to match container + apply viewport via ctx transforms
  // Same pattern as InteractiveCanvas: canvas.width = container.offsetWidth, then ctx.translate + ctx.scale
  const canvasWrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    cancelAnimationFrame(redrawRequestRef.current)
    redrawRequestRef.current = requestAnimationFrame(() => {
      const displayCanvas = displayCanvasRef.current
      const srcCanvas = compositCanvasRef.current
      if (!displayCanvas) return

      // Size display canvas pixel buffer to its CSS-resolved dimensions.
      const cw = displayCanvas.offsetWidth
      const ch = displayCanvas.offsetHeight
      if (!cw || !ch) return
      if (displayCanvas.width !== cw || displayCanvas.height !== ch) {
        displayCanvas.width = cw
        displayCanvas.height = ch
      }

      // Initial fit — only after drawComposite has set real canvas dimensions
      // (canvasDimensions is set in the drawComposite callback, NOT the default 300x150)
      if (!viewportInitializedRef.current && canvasDimensions.width > 0 && canvasDimensions.height > 0) {
        viewportInitializedRef.current = true
        const vp = calculateOnInitTemplate(
          cw,
          ch,
          { width: canvasDimensions.width, height: canvasDimensions.height },
          false
        )
        setViewport(vp)
        return
      }

      // Draw composite canvas onto display canvas with viewport transforms
      const ctx = displayCanvas.getContext('2d')
      if (!ctx) return

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, cw, ch)
      ctx.translate(viewport.left, viewport.top)
      ctx.scale(viewport.scale, viewport.scale)

      if (srcCanvas && srcCanvas.width > 0 && srcCanvas.height > 0) {
        ctx.drawImage(srcCanvas, 0, 0)
      }
    })
    return () => cancelAnimationFrame(redrawRequestRef.current)
  }, [viewport, compositCanvasRef, drawVersion, processedImageLoaded, canvasDimensions])

  // Touch single-finger pan (mobile)
  // Uses the same useTouchGestures hook as InteractiveCanvas for consistent behavior.
  // manipulatorDraggingRef is set true while a TemplateManipulator drag is active so
  // that pan is suppressed when the user is moving/resizing/rotating the template,
  // but still works when touching outside the template feedback rectangle in edit mode.
  const manipulatorDraggingRef = useRef(false)
  const handleTouchPan = useCallback((deltaX: number, deltaY: number) => {
    if (manipulatorDraggingRef.current) return
    setViewport(v => ({
      ...v,
      left: v.left + deltaX,
      top: v.top + deltaY,
    }))
  }, [])

  useTouchGestures(
    imageWrapperRef as React.RefObject<HTMLCanvasElement>,
    {
      onPinchZoom: undefined, // Disabled — zoom only via buttons
      onPan: handleTouchPan,
    },
    {
      enabled: isMobileView,
      panThreshold: 8,
    }
  )

  // Use ref to hold latest callback to avoid infinite loop
  // This prevents updateTemplatePositions from being a dependency that triggers re-renders
  const updateTemplatePositionsRef = useRef(updateTemplatePositions)
  useEffect(() => {
    updateTemplatePositionsRef.current = updateTemplatePositions
  }, [updateTemplatePositions])

  // Prevent stale async callbacks (e.g. maskImg.onload) from calling updateTemplatePositions
  // after this ResultView unmounts. Without this, a product tab switch in bulk mode could
  // let the old ResultView's pending draw callback reach the new product's handler via the ref.
  const unmountedRef = useRef(false)
  useEffect(() => {
    return () => {
      unmountedRef.current = true
    }
  }, [])

  // Guard to prevent redundant draws - track the last drawn state
  const lastDrawnStateRef = useRef<string>('')
  const isDrawingRef = useRef(false)
  const templatePositionsRef = useRef<TemplatePosition[]>(templatePositions)
  templatePositionsRef.current = templatePositions

  // Invalidate draw cache when drawComposite changes (loadedTemplateImages updated).
  // Without this, a template URL swap that produces the same stateSignature
  // (same URL lengths) would skip the redraw even though the loaded image data changed.
  const drawCompositeVersionRef = useRef(0)
  const prevDrawCompositeRef = useRef(drawComposite)
  if (prevDrawCompositeRef.current !== drawComposite) {
    prevDrawCompositeRef.current = drawComposite
    drawCompositeVersionRef.current += 1
    lastDrawnStateRef.current = ''
  }

  // Redraw composite when processed image loads or parameters change
  useEffect(() => {
    if (!originalImage) return
    if (!processedImageLoaded && !noMask) return

    // Create a state signature to detect if we actually need to redraw
    // Use URL length + first/last chars instead of full URL to avoid huge string comparisons
    const safeUrl = processedImageUrl ?? ''
    const urlSignature
      = safeUrl.length > 100 ? `${safeUrl.length}-${safeUrl.slice(0, 50)}-${safeUrl.slice(-50)}` : safeUrl
    // Include template image identity — use length as a simple differentiator for data URIs
    const templateSignature = templateImages.map(url => url.length).join(',')
    const stateSignature = `${urlSignature}-${templatePositioningMode}-${transparentAreas.length}-${isMobileView}-${templateImages.length}-${templateSignature}-v${drawCompositeVersionRef.current}`

    // Skip if we've already drawn with this exact state
    if (lastDrawnStateRef.current === stateSignature) {
      return
    }

    // Skip if a draw is already in progress (prevents race conditions)
    if (isDrawingRef.current) {
      return
    }

    // Debounce composite drawing to prevent memory pressure from rapid parameter changes
    const debounceDelay = UI_TIMINGS.CANVAS_REDRAW_DEBOUNCE

    // If user has manipulated positions, preserve them when only the template image changed.
    // fitOverrides: true when positions are raw area bounds from initial seed (need fit/fill),
    // false when user has explicitly set position/size via the manipulator.
    const positionOverrides
      = hasManipulatedRef.current && templatePositionsRef.current.length > 0 ? templatePositionsRef.current : undefined
    const fitOverrides = isInitialSeedRef.current

    const timeoutId = setTimeout(() => {
      // Double-check we haven't already drawn this state (race condition protection)
      if (lastDrawnStateRef.current === stateSignature || isDrawingRef.current) {
        return
      }

      // Mark as drawing to prevent concurrent draws
      isDrawingRef.current = true
      lastDrawnStateRef.current = stateSignature

      // After the first fit draw, clear the seed flag so subsequent draws
      // (template switches after initial fit) use the computed positions directly.
      if (isInitialSeedRef.current) {
        isInitialSeedRef.current = false
      }

      // Clear composite canvas before redrawing to free memory
      const canvas = compositCanvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
        }
      }

      drawComposite(
        originalImage,
        transparentAreas,
        processedImageUrl,
        templatePositioningMode,
        positions => {
          // Reset drawing flag when positions callback is called (mask loaded or noMask)
          isDrawingRef.current = false
          // Guard: skip state updates if this ResultView has unmounted (product tab switch).
          // The maskImg.onload in drawCompositeImage is async — it can fire after unmount,
          // and the updateTemplatePositionsRef could dispatch positions to the wrong product.
          if (unmountedRef.current) return
          // Only update positions when the draw actually produced results.
          // If template images haven't loaded yet, drawCompositeImage returns []
          // and we must NOT overwrite the seeded positions from initialTemplatePositions.
          if (positions.length > 0) {
            updateTemplatePositionsRef.current(positions)
            setTemplatePositions(positions)
          }
          const c = compositCanvasRef.current
          if (c) setCanvasDimensions({ width: c.width, height: c.height })
          // Signal viewport effect to re-apply CSS sizing now that canvas has correct dimensions
          setDrawVersion(v => v + 1)
        },
        isMobileView,
        processedDimensions ?? undefined,
        positionOverrides,
        fitOverrides,
        noMask
      )

      // Trigger immediate display canvas redraw (template is drawn synchronously,
      // mask overlay loads async and triggers another redraw via the callback above)
      setDrawVersion(v => v + 1)

      // Reset drawing flag after a longer delay as a fallback
      // This handles the case where mask image fails to load and callback is never called
      setTimeout(() => {
        isDrawingRef.current = false
      }, 5000) // 5 seconds should be enough for any image load
    }, debounceDelay)

    // Cleanup: cancel pending draw if parameters change again
    return () => {
      clearTimeout(timeoutId)
    }
  }, [
    processedImageLoaded,
    originalImage,
    transparentAreas,
    processedImageUrl,
    templateImages,
    templatePositioningMode,
    drawComposite,
    isMobileView,
    compositCanvasRef,
    processedDimensions,
    noMask,
  ])

  // Cleanup: Dispose canvas when component unmounts
  useEffect(() => {
    // Capture current canvas ref value at effect execution time
    const canvas = compositCanvasRef.current

    return () => {
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
        }
        // Free canvas buffer memory
        canvas.width = 0
        canvas.height = 0
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Ref is stable, captured value ensures cleanup uses correct canvas

  // Mobile layout — simplified onboarding: two-panel split (sticky canvas top + sideContent bottom)
  if (isMobileView && hideSettings && sideContent) {
    return (
      <div className={styles.mobileResultContainer}>
        {/* Sticky canvas preview with floating edit button and zoom controls */}
        <div style={{ position: 'sticky', top: 0, zIndex: 50 }}>
          {processedImageLoaded && (
            <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 100 }}>
              <Button
                icon={EditIcon}
                pressed={showManipulator}
                onClick={() => setShowManipulator(v => !v)}
                size="slim"
                accessibilityLabel={t('toggle-template-adjustment')}
              />
            </div>
          )}
          <div
            className={styles.mobileResultPreview}
            ref={imageWrapperRef}
            style={{ height: '38vh', maxHeight: '38vh' }}
          >
            {!processedImageLoaded ? (
              <div className={styles.imageLoading}>
                <Spinner size="large" />
                <Text variant="bodyMd" as="p">
                  {t('loading-processed-image')}
                </Text>
              </div>
            ) : (
              <>
                <canvas ref={compositCanvasRef} style={{ display: 'none' }} />
                <canvas
                  ref={displayCanvasRef}
                  className={styles.canvas}
                  onWheel={handleWheel}
                  style={{ display: 'block', cursor: 'default' }}
                />
                <div
                  ref={canvasWrapperRef}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                  }}
                >
                  {showManipulator
                    && canvasDimensions.width > 0
                    && templatePositions.map((pos, i) => (
                      <TemplateManipulator
                        key={i}
                        position={pos}
                        canvasWidth={canvasDimensions.width}
                        canvasHeight={canvasDimensions.height}
                        zoom={viewport.scale}
                        viewport={viewport}
                        onChange={newPos => handleManipulatorChange(i, newPos)}
                        onDragStart={() => {
                          manipulatorDraggingRef.current = true
                        }}
                        onDragEnd={() => {
                          manipulatorDraggingRef.current = false
                        }}
                      />
                    ))}
                </div>
              </>
            )}
            {isReprocessing && (
              <div className={styles.reprocessImage}>
                <Spinner size="large" />
              </div>
            )}
            <img
              src={processedImageUrl ?? undefined}
              alt="Processed mask"
              style={{ display: 'none' }}
              onLoad={() => setProcessedImageLoaded(true)}
              onError={() => console.error('Failed to load processed image')}
            />
          </div>
          {/* Floating zoom controls — bottom-left of canvas container */}
          {processedImageLoaded && (
            <div className={styles.floatingZoomControls}>
              <ButtonGroup variant="segmented">
                <Button
                  size="slim"
                  icon={MinusIcon}
                  onClick={handleMobileZoomOut}
                  disabled={zoom <= ZOOM_MIN}
                  accessibilityLabel="Zoom out"
                />
                <Button size="slim" icon={SearchIcon} onClick={handleZoomReset} accessibilityLabel="Reset zoom" />
                <Button
                  size="slim"
                  icon={PlusIcon}
                  onClick={handleMobileZoomIn}
                  disabled={zoom >= ZOOM_MAX}
                  accessibilityLabel="Zoom in"
                />
              </ButtonGroup>
            </div>
          )}
        </div>
        {/* Scrollable side content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>{sideContent}</div>
      </div>
    )
  }

  // Mobile layout with sticky preview (standard, non-onboarding)
  if (isMobileView) {
    return (
      <div className={styles.mobileResultContainer}>
        {/* Sticky Preview at top — wrapper for floating button + scrollable canvas */}
        <div style={{ position: 'sticky', top: 0, zIndex: 50 }}>
          {/* Floating edit button — outside scroll container */}
          {processedImageLoaded && (
            <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 100 }}>
              <Button
                icon={EditIcon}
                pressed={showManipulator}
                onClick={() => setShowManipulator(v => !v)}
                size="slim"
                accessibilityLabel={t('toggle-template-adjustment')}
              />
            </div>
          )}
          <div className={styles.mobileResultPreview} ref={imageWrapperRef}>
            {!processedImageLoaded ? (
              <div className={styles.imageLoading}>
                <Spinner size="large" />
                <Text variant="bodyMd" as="p">
                  {t('loading-processed-image')}
                </Text>
              </div>
            ) : (
              <>
                <canvas ref={compositCanvasRef} style={{ display: 'none' }} />
                <canvas
                  ref={displayCanvasRef}
                  className={styles.canvas}
                  onWheel={handleWheel}
                  style={{ display: 'block', cursor: 'default' }}
                />
                <div
                  ref={canvasWrapperRef}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                  }}
                >
                  {/* Template manipulator overlay (mobile) */}
                  {showManipulator
                    && canvasDimensions.width > 0
                    && templatePositions.map((pos, i) => (
                      <TemplateManipulator
                        key={i}
                        position={pos}
                        canvasWidth={canvasDimensions.width}
                        canvasHeight={canvasDimensions.height}
                        zoom={viewport.scale}
                        viewport={viewport}
                        onChange={newPos => handleManipulatorChange(i, newPos)}
                        onDragStart={() => {
                          manipulatorDraggingRef.current = true
                        }}
                        onDragEnd={() => {
                          manipulatorDraggingRef.current = false
                        }}
                      />
                    ))}
                </div>
              </>
            )}
            {isReprocessing && (
              <div className={styles.reprocessImage}>
                <Spinner size="large" />
              </div>
            )}
          </div>
          {/* Floating zoom controls — bottom-left of canvas container */}
          {processedImageLoaded && (
            <div className={styles.floatingZoomControls}>
              <ButtonGroup variant="segmented">
                <Button
                  size="slim"
                  icon={MinusIcon}
                  onClick={handleMobileZoomOut}
                  disabled={zoom <= ZOOM_MIN}
                  accessibilityLabel="Zoom out"
                />
                <Button size="slim" icon={SearchIcon} onClick={handleZoomReset} accessibilityLabel="Reset zoom" />
                <Button
                  size="slim"
                  icon={PlusIcon}
                  onClick={handleMobileZoomIn}
                  disabled={zoom >= ZOOM_MAX}
                  accessibilityLabel="Zoom in"
                />
              </ButtonGroup>
            </div>
          )}
        </div>

        {/* Scrollable controls — hidden when settings are suppressed (e.g. quick setup flow) */}
        {!hideSettings && (
          <div className={styles.mobileResultControls}>
            <BlockStack gap="400">
              <Banner tone="success">{t('image-processed-review-and-adjust')}</Banner>

              <ParameterControls
                processingParameters={processingParameters}
                shapeSelections={shapeSelections}
                templatePositioningMode={templatePositioningMode}
                showAdvancedSettings={showAdvancedSettings}
                updateParameter={updateParameter}
                onTemplatePositioningModeChange={onTemplatePositioningModeChange}
                compositeOnlyMode={compositeOnlyMode}
                t={t}
              />
            </BlockStack>
          </div>
        )}

        {/* Hidden images for loading detection */}
        <img
          src={processedImageUrl ?? undefined}
          alt="Processed mask"
          style={{ display: 'none' }}
          onLoad={() => {
            setProcessedImageLoaded(true)
          }}
          onError={() => {
            console.error('Failed to load processed image')
          }}
        />
      </div>
    )
  }

  // Desktop layout
  const hasRightColumn = !hideSettings || sideContent
  return (
    <BlockStack gap="400">
      {!hideSettings && (
        <Banner tone="success">
          <Trans t={t} components={{ b: <strong /> }}>
            {t('image-processed-review-and-adjust')}
          </Trans>
        </Banner>
      )}

      <InlineGrid columns={{ xs: 1, sm: isMobileView || !hasRightColumn ? 1 : '2fr 1fr' }} gap="100">
        {/* Image Section */}
        <div
          className={isMobileView ? '' : styles.stickyImageColumn}
          style={{ position: 'relative', ...(containerHeight ? { maxHeight: containerHeight } : {}) }}
        >
          <div
            className={styles.imageWrapper}
            ref={imageWrapperRef}
            style={{
              touchAction: 'none',
              ...(containerHeight ? { maxHeight: containerHeight } : {}),
            }}
          >
            {!processedImageLoaded && (
              <div className={styles.imageLoading}>
                <Spinner size="large" />
                <Text variant="bodyMd" as="p">
                  {t('loading-processed-image')}
                </Text>
              </div>
            )}
            {/* Composite canvas — hidden, used as pixel source for display canvas */}
            <canvas ref={compositCanvasRef} style={{ display: 'none' }} />
            {/* Display canvas — sized to container, viewport via ctx transforms, onWheel here */}
            <canvas
              ref={displayCanvasRef}
              className={styles.canvas}
              onWheel={handleWheel}
              style={{
                display: processedImageLoaded ? 'block' : 'none',
                cursor: 'default',
              }}
            />
            {/* Template manipulator overlay */}
            <div
              ref={canvasWrapperRef}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
            >
              {showManipulator
                && processedImageLoaded
                && canvasDimensions.width > 0
                && templatePositions.map((pos, i) => (
                  <TemplateManipulator
                    key={i}
                    position={pos}
                    canvasWidth={canvasDimensions.width}
                    canvasHeight={canvasDimensions.height}
                    zoom={viewport.scale}
                    viewport={viewport}
                    onChange={newPos => handleManipulatorChange(i, newPos)}
                    onDragStart={() => {
                      manipulatorDraggingRef.current = true
                    }}
                    onDragEnd={() => {
                      manipulatorDraggingRef.current = false
                    }}
                  />
                ))}
            </div>

            {/* Toggle template manipulator button — stays fixed in imageWrapper (overflow:hidden, no scroll) */}
            {processedImageLoaded && (
              <div ref={editButtonWrapperRef} style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}>
                <Tooltip content={t('adjust-template-position-size-and-rotation')} dismissOnMouseOut>
                  <Button
                    icon={EditIcon}
                    pressed={showManipulator}
                    onClick={() => setShowManipulator(v => !v)}
                    size="slim"
                    accessibilityLabel={t('toggle-template-adjustment')}
                  />
                </Tooltip>
              </div>
            )}

            {/* Hidden images for loading detection */}
            <img
              src={processedImageUrl ?? undefined}
              alt="Processed mask"
              style={{ display: 'none' }}
              onLoad={() => {
                setProcessedImageLoaded(true)
              }}
              onError={() => {
                console.error('Failed to load processed image')
              }}
            />
            {isReprocessing && (
              <div className={styles.reprocessImage}>
                <Spinner size="large" />
              </div>
            )}
          </div>

          {/* Desktop floating zoom — only when settings are hidden (simplified onboarding wizard
              mode), to mirror the mobile floating zoom and replace the below-canvas controls
              that we hide via !hideSettings below. Positioned as a sibling of imageWrapper
              (with the column set to position:relative) so it sits at the bottom-left corner of
              the column container — matches step 3 where MobileControls is a sibling of
              canvasContainer inside the wrapping Box. */}
          {processedImageLoaded && (hideSettings || floatingZoomOnDesktop) && !isMobileView && (
            <div className={styles.floatingZoomControls}>
              <ButtonGroup variant="segmented">
                <Button
                  size="slim"
                  icon={MinusIcon}
                  onClick={handleZoomOut}
                  disabled={zoom <= ZOOM_MIN}
                  accessibilityLabel="Zoom out"
                />
                <Button size="slim" icon={SearchIcon} onClick={handleZoomReset} accessibilityLabel="Reset zoom" />
                <Button
                  size="slim"
                  icon={PlusIcon}
                  onClick={handleZoomIn}
                  disabled={zoom >= ZOOM_MAX}
                  accessibilityLabel="Zoom in"
                />
              </ButtonGroup>
            </div>
          )}

          {/* Zoom controls — hidden when settings are hidden or floating zoom is active */}
          {!hideSettings && !floatingZoomOnDesktop && (
            <div className={styles.zoomControls}>
              <InlineStack align="center" gap="200">
                <ButtonGroup>
                  <Button
                    icon={MinusIcon}
                    onClick={handleZoomOut}
                    disabled={zoom <= ZOOM_MIN}
                    accessibilityLabel="Zoom out"
                    size="slim"
                  />
                  <Button onClick={handleZoomReset} size="slim">{`${Math.round(zoom * 100)}%`}</Button>
                  <Button
                    icon={PlusIcon}
                    onClick={handleZoomIn}
                    disabled={zoom >= ZOOM_MAX}
                    accessibilityLabel="Zoom in"
                    size="slim"
                  />
                </ButtonGroup>
              </InlineStack>
            </div>
          )}
        </div>

        {/* Right column: settings or custom side content */}
        {hasRightColumn && (
          <div
            className={isMobileView ? '' : styles.scrollableSettingsColumn}
            style={containerHeight ? { maxHeight: containerHeight, overflowY: 'auto' } : undefined}
          >
            {hideSettings && sideContent ? (
              sideContent
            ) : (
              <BlockStack gap="400">
                <ParameterControls
                  processingParameters={processingParameters}
                  shapeSelections={shapeSelections}
                  templatePositioningMode={templatePositioningMode}
                  templateImages={templateImages}
                  showAdvancedSettings={showAdvancedSettings}
                  updateParameter={updateParameter}
                  onTemplatePositioningModeChange={onTemplatePositioningModeChange}
                  compositeOnlyMode={compositeOnlyMode}
                  t={t}
                />
              </BlockStack>
            )}
          </div>
        )}
      </InlineGrid>
    </BlockStack>
  )
}
