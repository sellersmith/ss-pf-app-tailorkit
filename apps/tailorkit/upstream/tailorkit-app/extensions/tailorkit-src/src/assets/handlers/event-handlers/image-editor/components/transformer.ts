import type KonvaType from 'konva'
import { EventManager } from '../utils/event-utils'
import { throttle } from '../utils/function-utils'
import type { StageManager } from './stage-manager'
import rotateIcon from '../../../../icons/rotate-icon.svg'

/**
 * Manages the Konva transformer for image manipulation
 */
export class TransformerManager {
  private Konva: typeof KonvaType
  private transformer: KonvaType.Transformer | null = null
  private eventManager = new EventManager()
  private isDestroyed = false
  private targetNode: KonvaType.Node | null = null

  /**
   * Constructor
   */
  constructor(
    private stageManager: StageManager,
    Konva: typeof KonvaType,
    private onTransformEnd: () => void
  ) {
    this.Konva = Konva
  }

  /**
   * Initialize the transformer
   */
  public initialize(targetNode: KonvaType.Node, transformConfig?: Partial<KonvaType.TransformerConfig>): boolean {
    if (this.isDestroyed) return false

    this.targetNode = targetNode

    // Create transformer
    this.transformer = new this.Konva.Transformer({
      nodes: [this.targetNode],
      rotateEnabled: true,
      resizeEnabled: true,
      enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
      anchorSize: 16,
      anchorStroke: '#005BD3',
      anchorFill: '#ffffff',
      anchorCornerRadius: 8,
      anchorStrokeWidth: 1.5,
      borderStroke: '#005BD3',
      borderStrokeWidth: 2,
      rotationSnaps: [0, 45, 90, 135, 180, 225, 270, 315],
      rotateAnchorOffset: 30,
      keepRatio: true,
      centeredScaling: true,
      // Show center alignment guides
      centeredGuides: true,
      boundBoxFunc: (oldBox, newBox) => {
        // Prevent scaling too small
        if (newBox.width < 20 || newBox.height < 20) {
          return oldBox
        }
        return newBox
      },
      anchorStyleFunc: anchor => {
        if (anchor.getAttrs().name === 'rotater _anchor') {
          const imageElement = document.createElement('img')
          imageElement.src = rotateIcon

          anchor.fillPriority('pattern')
          anchor.fillPatternImage(imageElement)

          anchor.fillPatternOffsetX(10)
          anchor.fillPatternOffsetY(10)
        }
      },
      ...transformConfig,
    })

    // Add transformer to stage layer
    this.stageManager.addToLayer(this.transformer)

    // Setup event handlers
    this.setupEventHandlers(targetNode)

    return true
  }

  /**
   * Setup transformer event handlers
   */
  private setupEventHandlers(targetNode: KonvaType.Node): void {
    if (this.isDestroyed || !this.transformer) return

    const stage = this.stageManager.getStage()
    const container = this.stageManager.getContainer()

    if (!stage || !container) return

    // Listen for size changes on the target
    stage.on('contentChange', e => {
      if (this.isDestroyed || !this.transformer) return

      // If our target has changed size, update the transformer
      if (e.target === targetNode || e.target.hasName('uploadedImage')) {
        // Force the transformer to update its bounds
        this.transformer.forceUpdate()
        this.stageManager.redraw()
      }
    })

    // Setup transformer events
    this.eventManager.addKonvaEventHandler(this.transformer, 'transformstart', () => {
      if (this.isDestroyed) return
      container.dispatchEvent(new CustomEvent('transform:start'))
    })

    // Throttle transform events to reduce overhead
    const throttledTransform = throttle(() => {
      if (this.isDestroyed) return
      container.dispatchEvent(new CustomEvent('transform:active'))
    }, 100)

    this.eventManager.addKonvaEventHandler(this.transformer, 'transform', throttledTransform)

    this.eventManager.addKonvaEventHandler(this.transformer, 'transformend', () => {
      if (this.isDestroyed) return

      const node = this.transformer!.nodes()[0]

      // Save the bounding box before transform
      const oldRect = node.getClientRect({ relativeTo: node.getParent() || undefined })

      const scaleX = node.scaleX()
      const scaleY = node.scaleY()

      // Reset scale
      node.scaleX(1)
      node.scaleY(1)

      // Apply the scaled dimensions
      node.width(Math.max(5, node.width() * scaleX))
      node.height(Math.max(5, node.height() * scaleY))

      // Get the new bounding box after resizing
      const newRect = node.getClientRect({ relativeTo: node.getParent() || undefined })

      // Adjust position to visually match the previous location
      const dx = oldRect.x - newRect.x
      const dy = oldRect.y - newRect.y

      node.x(node.x() + dx)
      node.y(node.y() + dy)

      // Force stage update to ensure visual correctness
      this.stageManager.redraw()

      // Dispatch transform:end event immediately
      container.dispatchEvent(new CustomEvent('transform:end'))

      // Call onTransformEnd immediately to save state
      this.onTransformEnd()
    })

    // Setup drag events on the target node
    this.eventManager.addKonvaEventHandler(targetNode, 'dragstart', () => {
      if (this.isDestroyed) return
      container.dispatchEvent(new CustomEvent('transform:start'))
    })

    // Throttle dragmove events
    const throttledDragMove = throttle(() => {
      if (this.isDestroyed) return
      container.dispatchEvent(new CustomEvent('transform:active'))
    }, 100)

    this.eventManager.addKonvaEventHandler(targetNode, 'dragmove', throttledDragMove)

    this.eventManager.addKonvaEventHandler(targetNode, 'dragend', () => {
      if (this.isDestroyed) return

      // Update the position of the node
      const node = this.transformer!.nodes()[0]

      if (!node) {
        console.error('Node not found')
        return
      }

      node.x(node.x())
      node.y(node.y())

      // Force stage update
      this.stageManager.redraw()

      // Dispatch event immediately
      container.dispatchEvent(new CustomEvent('transform:end'))

      // Save state immediately
      this.onTransformEnd()
    })

    // Setup click handlers for selection
    const stageClickHandler = (e: KonvaType.KonvaEventObject<MouseEvent>) => {
      if (this.isDestroyed || !this.transformer) return

      // Check if click is on the target or elsewhere
      if (e.target === targetNode || e.target.hasName('uploadedImage')) {
        // Select the target
        this.transformer.nodes([targetNode])
        this.transformer.visible(true)
      } else if (e.target === stage || e.target.hasName('background') || e.target.parent?.hasName('clipGroup')) {
        // Deselect if clicking on background
        this.transformer.nodes([])
        this.transformer.visible(false)
      }

      this.stageManager.redraw()
    }

    this.eventManager.addKonvaEventHandler(stage, 'mousedown', stageClickHandler)
    this.eventManager.addKonvaEventHandler(stage, 'tap', stageClickHandler)

    // Initial selection
    this.transformer.nodes([targetNode])
    this.transformer.visible(true)
    this.stageManager.redraw()
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    this.isDestroyed = true

    // Clean up event handlers
    this.eventManager.cleanup()

    try {
      if (this.transformer) {
        this.transformer.nodes([]) // Detach nodes first
        this.transformer.remove()
        this.transformer.destroy()
        this.transformer = null
      }
    } catch (e) {
      console.error('Error during transformer cleanup:', e)
    }

    this.targetNode = null
  }
}
