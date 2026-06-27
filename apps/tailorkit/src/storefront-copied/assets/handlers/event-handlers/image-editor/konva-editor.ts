import type { TransformerConfig } from 'konva/lib/shapes/Transformer'
import type Konva from 'konva'
import { TailorKitKonva as KonvaRuntime } from '../../../../shared/libraries/konva/runtime-konva'
import { ImageLayer } from './components/image-layer'
import { StageManager } from './components/stage-manager'
import { TransformerManager } from './components/transformer'
import { HistoryManager } from './state/history-manager'
import type { KonvaEditor, KonvaEditorConfig, KonvaEditorState, MinimalTransformState } from './types/editor-types'

/**
 * Initialize a Konva editor for image editing
 *
 * This main file coordinates the various components of the image editor:
 * - Stage management (canvas, layers)
 * - Image layer (clipping, content group)
 * - Transformer (handles, rotation)
 * - History management (undo/redo)
 */
export async function initKonvaEditor(
  containerId: string,
  imageElement: HTMLImageElement,
  config: KonvaEditorConfig,
  transformerConfig?: Partial<TransformerConfig>
): Promise<KonvaEditor> {
  // Konva is directly imported since this file is bundled with tailorkit-konva.js
  // No need to wait - Konva is guaranteed to be available

  // Initialize the history manager
  const historyManager = new HistoryManager()
  historyManager.setInitializing(true) // Don't record operations during setup

  // Initialize the stage manager (pass Konva to avoid direct import)
  const stageManager = new StageManager(Konva)
  const stageInitialized = stageManager.initialize(containerId)

  if (!stageInitialized) {
    console.error('Failed to initialize Konva stage')
    return createEmptyEditor()
  }

  // ---------------------------------------------------------------------
  // Loading overlays
  // 1) Minimal init overlay (spinner) - used during initial mount only
  // 2) Background-removal overlay (shimmer) - reusable via editor API
  // ---------------------------------------------------------------------

  // 1) Minimal init overlay
  let initLoadingOverlay: Konva.Group | null = null
  let initLoadingAnimation: Konva.Animation | null = null

  function showInitLoading(): void {
    if (initLoadingOverlay) return

    const layer = stageManager.getLayer()
    const stage = stageManager.getStage()
    if (!layer || !stage) return

    // Use current stage dimensions; we'll also listen for future resizes
    let width = stage.width()
    let height = stage.height()

    initLoadingOverlay = new KonvaRuntime.Group({
      listening: false,
      name: 'tlk-init-loading-overlay',
    })

    // Full canvas background (same pattern as showLoadingOverlay)
    const bgRect = new KonvaRuntime.Rect({
      x: 0,
      y: 0,
      width,
      height,
      fill: 'rgba(255, 255, 255, 0.9)',
      listening: false,
    })

    // Centered spinner elements (positioned directly, not in sub-group)
    const centerX = width / 2
    const centerY = height / 2
    const radius = 14

    const ring = new KonvaRuntime.Circle({
      x: centerX,
      y: centerY,
      radius,
      stroke: '#9aa0a6',
      strokeWidth: 3,
      opacity: 0.35,
      listening: false,
    })

    const arc = new KonvaRuntime.Arc({
      x: centerX,
      y: centerY,
      innerRadius: radius - 3,
      outerRadius: radius,
      angle: 90,
      rotation: 0,
      stroke: '#6b7280',
      strokeWidth: 3,
      listening: false,
    })

    initLoadingOverlay.add(bgRect)
    initLoadingOverlay.add(ring)
    initLoadingOverlay.add(arc)

    layer.add(initLoadingOverlay)
    initLoadingOverlay.moveToTop()
    stage.batchDraw()

    initLoadingAnimation = new KonvaRuntime.Animation(frame => {
      if (!frame || !arc) return
      const deltaDeg = (frame.timeDiff / 1000) * 300
      arc.rotation((arc.rotation() + deltaDeg) % 360)
    }, layer)

    initLoadingAnimation.start()

    // Keep overlay sized to the canvas while container/stage resizes
    stage.on('stageResize.initLoading', () => {
      width = stage.width()
      height = stage.height()

      bgRect.width(width)
      bgRect.height(height)

      const centerX = width / 2
      const centerY = height / 2
      ring.x(centerX)
      ring.y(centerY)
      arc.x(centerX)
      arc.y(centerY)
      stage.batchDraw()
    })
  }

  function hideInitLoading(): void {
    if (initLoadingAnimation) {
      initLoadingAnimation.stop()
      initLoadingAnimation = null
    }

    if (initLoadingOverlay) {
      initLoadingOverlay.remove()
      initLoadingOverlay.destroy()
      initLoadingOverlay = null
    }

    // Remove resize listener for init overlay
    const stage = stageManager.getStage()
    if (stage) {
      stage.off('stageResize.initLoading')
    }

    stageManager.redraw()
  }

  // 2) Background-removal overlay (original fancy shimmer)
  let loadingOverlay: Konva.Group | null = null
  let loadingAnimation: Konva.Animation | null = null

  function showLoadingOverlay(): void {
    if (loadingOverlay) return

    const layer = stageManager.getLayer()
    const stage = stageManager.getStage()
    if (!layer || !stage) return

    const width = stage.width()
    const height = stage.height()

    loadingOverlay = new KonvaRuntime.Group({
      listening: false,
      name: 'emtlkit--loading-overlay',
    })

    const bgRect = new KonvaRuntime.Rect({
      x: 0,
      y: 0,
      width,
      height,
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: width, y: height },
      fillLinearGradientColorStops: [
        0,
        'rgba(160, 203, 255, 0.32)',
        0.4,
        'rgba(244, 194, 255, 0.32)',
        0.9,
        'rgba(209, 189, 255, 0.32)',
        1,
        'rgba(255, 185, 162, 0.32)',
      ],
      cornerRadius: 8,
    })

    const shimmerRect = new KonvaRuntime.Rect({
      x: 0,
      y: 0,
      width,
      height,
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: width, y: 0 },
      fillLinearGradientColorStops: [
        0,
        'rgba(255, 255, 255, 0)',
        0.2,
        'rgba(255, 255, 255, 0.2)',
        0.6,
        'rgba(255, 255, 255, 0.5)',
        1,
        'rgba(255, 255, 255, 0)',
      ],
      cornerRadius: 8,
    })

    loadingOverlay.add(bgRect)
    loadingOverlay.add(shimmerRect)

    layer.add(loadingOverlay)
    loadingOverlay.moveToTop()
    stage.batchDraw()

    loadingAnimation = new KonvaRuntime.Animation(frame => {
      if (!frame) return
      const progress = (frame.time % 1500) / 1500
      const offset = (progress * 2 - 1) * width

      shimmerRect.fillLinearGradientStartPoint({ x: offset, y: 0 })
      shimmerRect.fillLinearGradientEndPoint({ x: offset + width, y: 0 })
    }, layer)

    loadingAnimation.start()
  }

  function hideLoadingOverlay(): void {
    if (loadingAnimation) {
      loadingAnimation.stop()
      loadingAnimation = null
    }

    if (loadingOverlay) {
      loadingOverlay.remove()
      loadingOverlay.destroy()
      loadingOverlay = null
    }

    stageManager.redraw()
  }

  // Hide the layer initially to prevent showing content before loading overlay
  const initLayer = stageManager.getLayer()
  if (initLayer) {
    initLayer.visible(false)
  }

  // Initialize the image layer with proper error handling (pass Konva to avoid direct import)
  const imageLayer = new ImageLayer(stageManager, historyManager, Konva)
  let imageLayerInitialized = false

  try {
    imageLayerInitialized = await imageLayer.initialize(imageElement, config, transformerConfig)
  } catch (error) {
    console.error('Failed to initialize image layer:', error)
    // Cleanup stage manager before returning empty editor
    stageManager.cleanup()
    return createEmptyEditor()
  }

  if (!imageLayerInitialized) {
    console.error('Failed to initialize image layer')
    stageManager.cleanup()
    return createEmptyEditor()
  }

  // Initialize the transformer (pass Konva to avoid direct import)
  const transformerManager = new TransformerManager(stageManager, Konva, () => {
    // This callback is called when transformations end to save state
    const state = createStateFromImage()
    if (state) {
      historyManager.saveState(state)
    }
  })

  const imageNode = imageLayer.getImageNode()
  if (!imageNode) {
    console.error('Image node not found')
    imageLayer.cleanup()
    stageManager.cleanup()
    return createEmptyEditor()
  }

  transformerManager.initialize(imageNode, transformerConfig)

  // Setup resize handling
  const stage = stageManager.getStage()
  if (stage) {
    stage.on('stageResize', () => {
      // Reposition image layer when stage resizes
      if (typeof imageLayer.updatePositionAfterResize === 'function') {
        imageLayer.updatePositionAfterResize()
      }
    })

    stage.fire('stageResize')

    // Show the layer first so loading overlay is visible, then add loading overlay
    if (initLayer) {
      initLayer.visible(true)
    }
    showInitLoading()
  }

  // Hide init loading overlay after everything is positioned and ready
  // Add a small delay to avoid any residual flicker during first paint
  setTimeout(() => {
    // Hide loading overlay (layer is already visible)
    hideInitLoading()

    if (stage) {
      stage.batchDraw()
    }
  }, 500)

  // ---------------------------------------------------------------------
  // Helper to create minimal state from current image
  // ---------------------------------------------------------------------

  function createStateFromImage(): MinimalTransformState | null {
    const imageNode = imageLayer.getImageNode()
    if (!imageNode) return null

    return {
      x: imageNode.x(),
      y: imageNode.y(),
      scaleX: 1, // Fixed value since we're not using scale anymore
      scaleY: 1, // Fixed value since we're not using scale anymore
      rotation: imageNode.rotation(),
      width: imageNode.width(),
      height: imageNode.height(),
    }
  }

  // ---------------------------------------------------------------------
  // Auto-fit image and set initial state based on parameter
  // ---------------------------------------------------------------------

  setTimeout(() => {
    // Create initial history state after setup
    setTimeout(() => {
      const state = createStateFromImage()
      if (state) {
        // Finish initialization and save initial state
        historyManager.setInitializing(false)
        historyManager.saveState(state, false)
      }
    }, 100)
  }, 100)

  // Return the editor API
  return {
    // Auto-fit the image to the boundary
    autoFitImageToBoundary: skipHistory => imageLayer.autoFitImageToBoundary(skipHistory),

    // New zoom function
    zoomImage: (zoomChange, skipHistory) => imageLayer.zoomImage(zoomChange, skipHistory),

    // Update editor based on UI controls
    updateEditor: params => imageLayer.updateEditor(params),

    // Reset editor to initial state
    resetEditor: () => imageLayer.resetEditor(),

    // Get current editor state
    getEditorState: () => imageLayer.getState(),

    // Clean up all resources
    cleanup: () => {
      transformerManager.cleanup()
      imageLayer.cleanup()
      stageManager.cleanup()
    },

    // Undo last operation
    undo: () => {
      const result = historyManager.undo()
      if (result.success && result.state) {
        // Apply the state and force a redraw
        imageLayer.applyState(result.state)

        // Update the transformer
        const imageNode = imageLayer.getImageNode()
        if (imageNode) {
          const stage = stageManager.getStage()
          if (stage) {
            stage.fire('contentChange', { target: imageNode })
            stageManager.redraw()
          }
        }
        return true
      }
      return false
    },

    // Redo previously undone operation
    redo: () => {
      const result = historyManager.redo()
      if (result.success && result.state) {
        // Apply the state and force a redraw
        imageLayer.applyState(result.state)

        // Update the transformer
        const imageNode = imageLayer.getImageNode()
        if (imageNode) {
          const stage = stageManager.getStage()
          if (stage) {
            stage.fire('contentChange', { target: imageNode })
            stageManager.redraw()
          }
        }
        return true
      }
      return false
    },

    // Check if undo is available
    canUndo: () => historyManager.canUndo(),

    // Check if redo is available
    canRedo: () => historyManager.canRedo(),

    // Replace the image while maintaining current transform state
    replaceImage: (newImageElement: HTMLImageElement) => {
      if (!imageLayer) return false

      try {
        // Get the image node and replace its image
        const imageNode = imageLayer.getImageNode()
        if (imageNode && typeof imageNode.image === 'function') {
          // Replace the image source while maintaining transforms
          imageNode.image(newImageElement)

          // Update original dimensions in the image layer to match new image
          const imageLayerInternal = imageLayer as any
          if (imageLayerInternal.originalDimensions) {
            imageLayerInternal.originalDimensions = {
              width: newImageElement.naturalWidth,
              height: newImageElement.naturalHeight,
            }
          }

          // Force redraw
          const stage = stageManager.getStage()
          if (stage) {
            stage.batchDraw()
          }

          return true
        }
      } catch (error) {
        console.error('Failed to replace image:', error)
      }

      return false
    },

    // Apply full state including position and dimensions
    applyFullState: (state: Partial<KonvaEditorState>) => {
      if (!state) return

      // Get current state to fill in missing values
      const currentState = imageLayer.getState()

      // For width and height, prefer saved values, but ensure they're valid
      let targetWidth = state.width !== undefined ? state.width : currentState.width
      let targetHeight = state.height !== undefined ? state.height : currentState.height

      // If we have zoom but no width/height, calculate from zoom
      if (state.zoom && (!state.width || !state.height)) {
        const imageNode = imageLayer.getImageNode()
        if (imageNode) {
          // Get the original image dimensions
          const image = imageNode.image()
          let originalWidth = targetWidth
          let originalHeight = targetHeight

          // Check if it's an HTMLImageElement to access naturalWidth/naturalHeight
          if (image instanceof HTMLImageElement) {
            originalWidth = image.naturalWidth
            originalHeight = image.naturalHeight
          }

          // Convert zoom percentage to decimal if needed
          let zoomDecimal = state.zoom
          if (zoomDecimal > 2) {
            zoomDecimal = zoomDecimal / 100
          }

          targetWidth = originalWidth * zoomDecimal
          targetHeight = originalHeight * zoomDecimal
        }
      }

      // Convert KonvaEditorState to MinimalTransformState
      const minimalState: MinimalTransformState = {
        x: state.x !== undefined ? state.x : currentState.x,
        y: state.y !== undefined ? state.y : currentState.y,
        rotation: state.rotation !== undefined ? state.rotation : currentState.rotation,
        width: targetWidth,
        height: targetHeight,
        scaleX: 1, // Fixed value since we're not using scale anymore
        scaleY: 1, // Fixed value since we're not using scale anymore
      }

      // Temporarily disable history to avoid recording this restoration
      historyManager.setInitializing(true)

      // Apply the state using the imageLayer's applyState method
      imageLayer.applyState(minimalState)

      // Re-enable history and save this as the initial restored state
      setTimeout(() => {
        historyManager.setInitializing(false)
        // Save the restored state as the baseline for undo/redo
        const restoredState = imageLayer.getState()

        const stateForHistory: MinimalTransformState = {
          x: restoredState.x,
          y: restoredState.y,
          rotation: restoredState.rotation,
          width: restoredState.width,
          height: restoredState.height,
          scaleX: 1,
          scaleY: 1,
        }
        historyManager.saveState(stateForHistory, false)
      }, 100)
    },

    // Loading overlay helpers
    showLoadingOverlay,
    hideLoadingOverlay,
  }
}

/**
 * Create an empty editor with no-op functions for when initialization fails
 */
function createEmptyEditor(): KonvaEditor {
  return {
    autoFitImageToBoundary: () => 70,
    zoomImage: () => 100,
    updateEditor: () => {},
    resetEditor: () => {},
    getEditorState: () => ({
      zoom: 70,
      rotation: 0,
      transform: 'fill',
      scaleX: 1,
      scaleY: 1,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      absoluteX: 0,
      absoluteY: 0,
      absoluteWidth: 0,
      absoluteHeight: 0,
    }),
    cleanup: () => {},
    undo: () => false,
    redo: () => false,
    canUndo: () => false,
    canRedo: () => false,
    replaceImage: () => false,
    applyFullState: () => {},
    showLoadingOverlay: () => {},
    hideLoadingOverlay: () => {},
  }
}
