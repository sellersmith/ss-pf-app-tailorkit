import styles from '../../styles.module.css'
import React, { useCallback, useState, useRef, useEffect } from 'react'
import { Spinner, Text } from '@shopify/polaris'
import { useCanvasState } from '../../hooks/useCanvasState'
import { useTouchGestures } from '../../hooks/useTouchGestures'
import { serializePathCommandsToD } from '../../utils/vectorPathUtils'
import useScreenBreakpoints from '~/utils/hooks/use-screen-breakpoints'
import { useTranslation } from 'react-i18next'
import type { InteractiveCanvasProps, DrawingMode } from './types'
import type { RectangularShape } from '../../types'
import { AUTO_DETECT_CONSTANTS } from '../../constants'
import { useInteractionState } from './use-interaction-state'
import { useCanvasZoom } from './use-canvas-zoom'
import { useCanvasTools } from './use-canvas-tools'
import { useCanvasEffects } from './use-canvas-effects'
import { useMouseHandlers } from './use-mouse-handlers'
import { useTouchHandlers } from './use-touch-handlers'
import { getAutoDetectLabel } from './auto-detect-label'
import { CanvasToolbars } from './canvas-toolbars'
import { CanvasHintBanner } from './canvas-hint-banner'
import HintBanner from '~/components/common/HintBanner'

/** Auto-detect tip carousel — re-uses the same i18n keys as the toolbar. */
const AUTO_DETECT_TIPS = ['auto-detect-tip-1', 'auto-detect-tip-2', 'auto-detect-tip-3'] as const

export default function InteractiveCanvas({
  imageUrl,
  shapeSelections,
  onShapeSelectionsChange,
  onError,
  onZoomChange,
  onVectorModeEnter,
  autoTriggerDetection = false,
}: InteractiveCanvasProps) {
  const { t } = useTranslation()
  const { isMobileView } = useScreenBreakpoints()
  const { canvasRef, containerRef, imageLoaded, image, getCanvasContext, getCanvasCoordinates } = useCanvasState(
    imageUrl,
    onError
  )
  const zoom = useCanvasZoom()
  const interaction = useInteractionState()
  const shapeSelectionsRef = useRef(shapeSelections)
  shapeSelectionsRef.current = shapeSelections

  const [mobileMode, setMobileMode] = useState<DrawingMode>('rectangle')
  const [isVectorMode, setIsVectorMode] = useState(false)
  const [isMagicWandMode, setIsMagicWandMode] = useState(false)
  const [isAutoDetectMode, setIsAutoDetectMode] = useState(false)
  const [hasInteracted, setHasInteracted] = useState(false)
  const [tipIndex, setTipIndex] = useState(0)
  const [mobileToolbarHint, setMobileToolbarHint] = useState<string | null>(null)
  const [showAutoDetectHint, setShowAutoDetectHint] = useState(false)

  const isVectorModeRef = useRef(isVectorMode)
  isVectorModeRef.current = isVectorMode
  const isMagicWandModeRef = useRef(isMagicWandMode)
  isMagicWandModeRef.current = isMagicWandMode
  const isAutoDetectModeRef = useRef(isAutoDetectMode)
  isAutoDetectModeRef.current = isAutoDetectMode
  const imageRef = useRef(image)
  imageRef.current = image
  const fallbackTimerRef = useRef<NodeJS.Timeout | null>(null)

  const transformCanvasToImage = useCallback(
    (cx: number, cy: number) => {
      const { scale, left, top } = zoom.viewport
      return { x: Math.round((cx - left) / scale), y: Math.round((cy - top) / scale) }
    },
    [zoom.viewport]
  )
  const transformImageToCanvas = useCallback(
    (ix: number, iy: number) => {
      const { scale, left, top } = zoom.viewport
      return { x: ix * scale + left, y: iy * scale + top }
    },
    [zoom.viewport]
  )
  const isWithinImageBounds = useCallback(
    (x: number, y: number) => (!image ? false : x >= 0 && x <= image.width && y >= 0 && y <= image.height),
    [image]
  )
  const findShapeAtPoint = useCallback((x: number, y: number, shapes: typeof shapeSelections) => {
    for (let i = shapes.length - 1; i >= 0; i--) {
      const s = shapes[i]
      if (s && typeof s.x === 'number' && x >= s.x && x <= s.x + s.width && y >= s.y && y <= s.y + s.height) return i
    }
    return null
  }, [])
  const deleteShape = useCallback(
    (index: number) => {
      const updated = shapeSelections.filter((_, i) => i !== index)
      if (interaction.selectedShapeIndex === index) interaction.setSelectedShapeIndex(null)
      else if (interaction.selectedShapeIndex !== null && interaction.selectedShapeIndex > index) {
        interaction.setSelectedShapeIndex(interaction.selectedShapeIndex - 1)
      }
      onShapeSelectionsChange(updated)
    },
    [shapeSelections, onShapeSelectionsChange, interaction]
  )

  const tools = useCanvasTools({
    isVectorMode,
    isMagicWandMode,
    isAutoDetectMode,
    mobileMode,
    isMobileView,
    image,
    viewportScale: zoom.viewport.scale,
    shapeSelections,
    onShapeSelectionsChange,
    interaction,
    transformCanvasToImage,
    transformImageToCanvas,
    setIsVectorMode,
    setIsMagicWandMode,
    setIsAutoDetectMode,
    setMobileMode,
    setHasInteracted,
  })
  const {
    vectorTool,
    magicWand,
    autoDetect,
    nodeEditing,
    shapeTool,
    paintTool,
    vectorToolRef,
    magicWandRef,
    autoDetectRef,
    nodeEditingRef,
    shapeToolRef,
    nodeEditingDeleteSelectedRef,
  } = tools
  const isPaintMode = mobileMode === 'paint' && !isAutoDetectMode
  const isPaintModeRef = useRef(isPaintMode)
  isPaintModeRef.current = isPaintMode
  const isAutoDetectProcessing
    = autoDetect.phase !== 'idle' && autoDetect.phase !== 'preview' && autoDetect.phase !== 'error'

  // Option B: inject a 60%-coverage center rectangle when auto-detect fails or times out.
  // Uses refs so the callback is stable and safe to call from a timeout.
  const injectCenterRectangle = useCallback(() => {
    const img = imageRef.current
    if (!img || shapeSelectionsRef.current.length > 0) return
    const margin = 0.2
    const rect: RectangularShape = {
      type: 'rectangle',
      x: Math.round(img.width * margin),
      y: Math.round(img.height * margin),
      width: Math.round(img.width * (1 - 2 * margin)),
      height: Math.round(img.height * (1 - 2 * margin)),
    }
    autoDetectRef.current?.cancelSelection()
    autoTriggeredPendingRef.current = false
    setIsAutoDetectMode(false)
    onShapeSelectionsChange([rect])
    interaction.setSelectedShapeIndex(0)
  }, [onShapeSelectionsChange, interaction.setSelectedShapeIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-trigger auto-detect when image first loads (no existing shapes)
  const autoDetectTriggeredRef = useRef(false)
  // True while the CURRENT detection run was triggered automatically (not by the user).
  // When the run succeeds we skip the preview/confirm step and confirm immediately.
  const autoTriggeredPendingRef = useRef(false)
  useEffect(() => {
    if (autoTriggerDetection && imageLoaded && !autoDetectTriggeredRef.current && shapeSelections.length === 0) {
      autoDetectTriggeredRef.current = true
      autoTriggeredPendingRef.current = true
      setIsAutoDetectMode(true)
      setIsMagicWandMode(false)
      setIsVectorMode(false)
      autoDetect.detect()
      // Option B: fallback if auto-detect doesn't reach preview in time
      fallbackTimerRef.current = setTimeout(() => {
        if (autoTriggeredPendingRef.current) injectCenterRectangle()
      }, AUTO_DETECT_CONSTANTS.FALLBACK_TIMEOUT_MS)
    }
  }, [imageLoaded, autoTriggerDetection, injectCenterRectangle]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-confirm when the automatically-triggered detection succeeds — skip the
  // manual ✓ step so merchants land directly on an already-shaped canvas.
  // Option B: if detection errors out, inject center rectangle immediately.
  useEffect(() => {
    if (autoTriggeredPendingRef.current && autoDetect.phase === 'preview' && autoDetect.hasOverlay) {
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current)
        fallbackTimerRef.current = null
      }
      autoTriggeredPendingRef.current = false
      autoDetect.confirmSelection()
      setIsAutoDetectMode(false)
      setShowAutoDetectHint(true)
    } else if (autoTriggeredPendingRef.current && autoDetect.phase === 'error') {
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current)
        fallbackTimerRef.current = null
      }
      injectCenterRectangle()
    }
  }, [autoDetect.phase, autoDetect.hasOverlay, injectCenterRectangle]) // eslint-disable-line react-hooks/exhaustive-deps

  // Clean up fallback timer on unmount
  useEffect(() => {
    return () => {
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current)
    }
  }, [])

  const lastMagicWandTapRef = useRef(0)
  const vectorDrawingStartedRef = useRef(false)

  const { handleMouseDown, handleMouseMove, handleMouseUp } = useMouseHandlers({
    image,
    canvasRef,
    getCanvasCoordinates,
    getCanvasContext,
    shapeSelections,
    onShapeSelectionsChange,
    interaction,
    zoom,
    isVectorMode,
    isMagicWandMode,
    isVectorModeRef,
    findShapeAtPoint,
    isWithinImageBounds,
    transformCanvasToImage,
    isMobileView,
    magicWand,
    nodeEditing,
    vectorTool,
    shapeTool,
    paintTool,
    isPaintMode,
    serializePathCommandsToD,
    vectorDrawingStartedRef,
    setHasInteracted,
    setMobileMode,
    setIsVectorMode,
  })
  const { handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchTap, handleTouchTapAndHold } = useTouchHandlers(
    {
      isMobileView,
      image,
      canvasRef,
      shapeSelections,
      onShapeSelectionsChange,
      interaction,
      zoom,
      mobileMode,
      isWithinImageBounds,
      transformCanvasToImage,
      findShapeAtPoint,
      isOverInteractiveElement: useCallback(
        (x: number, y: number) =>
          image
            ? findShapeAtPoint(transformCanvasToImage(x, y).x, transformCanvasToImage(x, y).y, shapeSelections) !== null
            : false,
        [image, transformCanvasToImage, findShapeAtPoint, shapeSelections]
      ),
      vectorTool,
      vectorToolRef,
      nodeEditingRef,
      magicWand,
      shapeTool,
      paintTool,
      lastMagicWandTapRef,
      deleteShape,
      setHasInteracted,
      setMobileMode,
      setIsVectorMode,
    }
  )

  const deleteSelectedShape = useCallback(() => {
    if (interaction.selectedShapeIndex !== null) deleteShape(interaction.selectedShapeIndex)
  }, [interaction.selectedShapeIndex, deleteShape])

  const resetTouchState = useCallback(() => {
    interaction.manipulationIntentRef.current = null
    interaction.setIsTouchDrawing(false)
    interaction.setIsTouchMoving(false)
    interaction.setIsTouchResizing(false)
    interaction.setIsTouchRotating(false)
  }, [interaction])

  useCanvasEffects({
    image,
    imageLoaded,
    canvasRef,
    containerRef,
    getCanvasContext,
    shapeSelections,
    shapeSelectionsRef,
    interaction,
    zoom,
    isMobileView,
    onZoomChange,
    nodeEditingRef,
    shapeToolRef,
    isVectorModeRef,
    vectorToolRef,
    isMagicWandModeRef,
    magicWandRef,
    isAutoDetectModeRef,
    autoDetectRef,
    isPaintModeRef,
    paintToolRef: tools.paintToolRef,
    paintTool,
    vectorTool,
    nodeEditing,
    magicWand,
    autoDetect,
    shapeTool,
    nodeEditingDeleteSelectedRef,
    isVectorMode,
    isMagicWandMode,
    isAutoDetectMode,
    deleteShape,
    onVectorModeEnter,
    isAutoDetectProcessing,
    setTipIndex,
    autoDetectTipsLength: 3,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    mobileMode,
    setMobileMode,
    handleWheel: zoom.handleWheel,
  })

  useTouchGestures(
    canvasRef,
    {
      onPinchZoom: undefined,
      onPan:
        mobileMode === 'pan'
          ? (dx: number, dy: number) => {
              // Don't pan when a shape manipulation intent is pending or active
              if (
                interaction.manipulationIntentRef.current
                || interaction.isTouchMoving
                || interaction.isTouchResizing
                || interaction.isTouchRotating
              ) {
                return
              }
              zoom.handleTouchPan(dx, dy)
            }
          : undefined,
      onTap: (x, y) => {
        setHasInteracted(true)
        handleTouchTap(x, y)
      },
      onTapAndHold: (x, y) => {
        setHasInteracted(true)
        if (nodeEditing.isActive && nodeEditing.selectedNodeIndex !== null) {
          const c = transformCanvasToImage(x, y)
          if (nodeEditing.handleMouseDown(c.x, c.y)) {
            nodeEditing.handleMouseUp()
            if (nodeEditing.selectedNodeIndex !== null) nodeEditing.deleteNodeAtIndex(nodeEditing.selectedNodeIndex)
            return
          }
        }
        const c = transformCanvasToImage(x, y)
        if (!findShapeAtPoint(c.x, c.y, shapeSelections) && (mobileMode === 'rectangle' || mobileMode === 'ellipse')) {
          if (isWithinImageBounds(c.x, c.y)) {
            interaction.setIsTouchDrawing(true)
            shapeTool.handleMouseDown(x, y, false)
          }
        } else {
          handleTouchTapAndHold(x, y)
        }
      },
    },
    { enabled: isMobileView && !interaction.isTouchDrawing, tapHoldDelay: 600, minPinchDistance: 20, panThreshold: 8 }
  )

  const labelFn = useCallback(
    (phase: string, progress: { percent: number }, isMobile: boolean) =>
      getAutoDetectLabel(t, phase, progress, isMobile),
    [t]
  )

  return (
    <div className={styles.canvasContainer} ref={containerRef}>
      {/* Scanning line effect during auto-detect processing */}
      {isAutoDetectProcessing && (
        <div className={styles.scanningOverlay}>
          <div className={styles.scanningLine} />
        </div>
      )}
      {!imageLoaded && (
        <div className={styles.loading}>
          <Spinner size="large" />
          <Text variant="bodyMd" as="p">
            {t('loading-image')}
          </Text>
        </div>
      )}
      {imageLoaded && (
        <CanvasToolbars
          isMobileView={isMobileView}
          mobileMode={mobileMode}
          isPaintMode={isPaintMode}
          isVectorMode={isVectorMode}
          isMagicWandMode={isMagicWandMode}
          isAutoDetectMode={isAutoDetectMode}
          isAutoDetectProcessing={isAutoDetectProcessing}
          hasInteracted={hasInteracted}
          tipIndex={tipIndex}
          selectedShapeIndex={interaction.selectedShapeIndex}
          isTouchDrawing={interaction.isTouchDrawing}
          isTouchMoving={interaction.isTouchMoving}
          isTouchResizing={interaction.isTouchResizing}
          isTouchRotating={interaction.isTouchRotating}
          autoDetectPhase={autoDetect.phase}
          autoDetectProgress={autoDetect.progress}
          autoDetectHasOverlay={autoDetect.hasOverlay}
          autoDetectError={autoDetect.error}
          vectorToolIsDrawing={vectorTool.isDrawing}
          vectorToolCanUndo={vectorTool.canUndo}
          vectorToolCanRedo={vectorTool.canRedo}
          nodeEditingIsActive={nodeEditing.isActive}
          nodeEditingSelectedNodeIndex={nodeEditing.selectedNodeIndex}
          magicWandHasOverlay={magicWand.hasOverlay}
          magicWandTolerance={magicWand.tolerance}
          magicWandIsLoading={magicWand.isLoading}
          magicWandError={magicWand.error}
          paintToolHasOverlay={paintTool.hasOverlay}
          paintToolMode={paintTool.mode}
          paintToolBrushSize={paintTool.brushSize}
          onPaintToolModeChange={paintTool.setMode}
          onPaintToolBrushSizeChange={paintTool.setBrushSize}
          onPaintToolConfirm={paintTool.confirmSelection}
          onPaintToolCancel={() => {
            paintTool.cancelSelection()
            setMobileMode('pan')
            setIsVectorMode(false)
            setIsMagicWandMode(false)
          }}
          labelFn={labelFn}
          onDeleteSelectedShape={deleteSelectedShape}
          onSetMobileMode={mode => {
            const m = mode
            setMobileMode(m)
            setIsVectorMode(m === 'vector')
            setIsMagicWandMode(m === 'magicwand')
            setIsAutoDetectMode(false)
            setHasInteracted(false)
            resetTouchState()
          }}
          onSetDesktopMode={mode => {
            setMobileMode(mode)
            setIsVectorMode(mode === 'vector')
            setIsMagicWandMode(mode === 'magicwand')
            setIsAutoDetectMode(false)
          }}
          onAutoDetectMobile={() => {
            setIsAutoDetectMode(true)
            setMobileMode('pan')
            setIsMagicWandMode(false)
            setIsVectorMode(false)
            setHasInteracted(false)
            resetTouchState()
            autoDetect.detect()
          }}
          onAutoDetectDesktop={() => {
            setIsAutoDetectMode(true)
            setIsMagicWandMode(false)
            setIsVectorMode(false)
            autoDetect.detect()
          }}
          onAutoDetectConfirm={autoDetect.confirmSelection}
          onAutoDetectCancel={() => {
            autoDetect.cancelSelection()
            setIsAutoDetectMode(false)
            // Clear pending flag so a subsequent manual detection isn't auto-confirmed
            autoTriggeredPendingRef.current = false
            if (fallbackTimerRef.current) {
              clearTimeout(fallbackTimerRef.current)
              fallbackTimerRef.current = null
            }
          }}
          onAutoDetectRetry={autoDetect.retry}
          onVectorUndo={vectorTool.undo}
          onVectorRedo={vectorTool.redo}
          onVectorFinish={vectorTool.finishDrawing}
          onVectorCancel={() => {
            vectorTool.cancelDrawing()
            setMobileMode('pan')
            setIsVectorMode(false)
          }}
          onDeleteNodes={() => nodeEditing.deleteSelectedNodes()}
          onMagicWandToleranceChange={magicWand.updateTolerance}
          onMagicWandConfirm={magicWand.confirmSelection}
          onMagicWandCancel={() => {
            magicWand.cancelSelection()
            setMobileMode('pan')
            setIsMagicWandMode(false)
            setIsVectorMode(false)
          }}
          onMobileHintChange={setMobileToolbarHint}
        />
      )}
      {imageLoaded && (
        <CanvasHintBanner
          isAutoDetectProcessing={isAutoDetectProcessing}
          autoDetectPhase={autoDetect.phase}
          autoDetectProgress={autoDetect.progress}
          autoDetectTips={AUTO_DETECT_TIPS}
          tipIndex={tipIndex}
        />
      )}
      {imageLoaded && !isAutoDetectProcessing && (
        <div className={styles.canvasHintBanner}>
          <HintBanner show={showAutoDetectHint} onClose={() => setShowAutoDetectHint(false)}>
            <Text variant="bodySm" as="p">
              {t('auto-detect-confirmed-hint')}
            </Text>
          </HintBanner>
        </div>
      )}
      {imageLoaded && isMobileView && !isAutoDetectProcessing && (
        <div className={styles.canvasHintBanner}>
          <HintBanner show={!!mobileToolbarHint} onClose={() => setMobileToolbarHint(null)}>
            {mobileToolbarHint}
          </HintBanner>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        tabIndex={0}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{
          display: imageLoaded ? 'block' : 'none',
          touchAction: isMobileView ? 'manipulation' : 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none',
        }}
      />
    </div>
  )
}
