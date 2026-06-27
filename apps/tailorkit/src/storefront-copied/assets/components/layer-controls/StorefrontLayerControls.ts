/**
 * StorefrontLayerControls — DOM overlay Delete button.
 *
 * Rendered outside Konva canvas as a DOM element so buttons stay upright
 * even when layer is rotated (design spec requirement).
 *
 * Usage:
 *   const controls = new StorefrontLayerControls(canvasContainer)
 *   controls.attachToNode(node, stage, { onDelete })
 *   controls.detach()
 */

import type Konva from 'konva'
import { CLOSE_ICON, RESET_ICON } from '../../icons'
import { StorefrontLayerState } from '../../stores/storefront-layer-state'

export interface LayerControlsCallbacks {
  onDelete: () => void
  onReset?: () => void
}

/** Which action buttons to display for the selected layer. */
export interface LayerControlsVisibility {
  showDelete: boolean
  showReset: boolean
}

/** Minimum distance from top of canvas before controls flip to below-node. */
const FLIP_THRESHOLD_PX = 12
/** Tolerances match StorefrontLayerState.getChangedLayers thresholds. */
const POS_TOL = 0.5
const ROT_TOL = 0.1

export class StorefrontLayerControls {
  private container: HTMLElement
  private wrapper: HTMLElement
  private actionsEl: HTMLElement | null = null
  private deleteBtn: HTMLButtonElement | null = null
  private resetBtn: HTMLButtonElement | null = null

  private currentNode: Konva.Node | null = null
  private currentStage: Konva.Stage | null = null
  private currentLayerId: string | null = null
  private cleanup: (() => void) | null = null

  constructor(
    canvasContainer: HTMLElement,
    actionsBtns?: { deleteBtn?: HTMLButtonElement | boolean; resetBtn?: HTMLButtonElement | boolean }
  ) {
    this.container = canvasContainer

    if (window.getComputedStyle(canvasContainer).position === 'static') {
      canvasContainer.style.position = 'relative'
    }

    this.wrapper = document.createElement('div')
    this.wrapper.className = 'emtlkit-lc-overlay'
    Object.assign(this.wrapper.style, { top: '0', left: '0', width: '0', height: '0', overflow: 'visible' })

    if (actionsBtns) {
      const { deleteBtn, resetBtn } = actionsBtns
      if (deleteBtn || resetBtn) {
        this.actionsEl = document.createElement('div')
        this.actionsEl.className = 'emtlkit-lc-actions emtlkit-lc-actions--above'

        if (resetBtn) {
          this.resetBtn
            = typeof resetBtn === 'boolean'
              ? this.createButton('emtlkit-lc-btn emtlkit-lc-btn--reset', 'Reset to default', RESET_ICON, true)
              : resetBtn
          this.actionsEl.appendChild(this.resetBtn)
        }

        if (deleteBtn) {
          this.deleteBtn
            = typeof deleteBtn === 'boolean'
              ? this.createButton('emtlkit-lc-btn emtlkit-lc-btn--delete', 'Remove layer', CLOSE_ICON)
              : deleteBtn
          this.actionsEl.appendChild(this.deleteBtn)
        }

        this.wrapper.appendChild(this.actionsEl)
      }
    }
    this.container.appendChild(this.wrapper)
  }

  /** Creates a configured action button. */
  private createButton(className: string, label: string, icon: string, hidden = false): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.className = className
    btn.type = 'button'
    btn.title = label
    btn.setAttribute('aria-label', label)
    btn.innerHTML = icon
    if (hidden) btn.style.display = 'none'
    return btn
  }

  /**
   * Attach controls to a Konva node.
   * Detaches from any previous node first.
   */
  attachToNode(node: Konva.Node, stage: Konva.Stage, callbacks: LayerControlsCallbacks): void {
    this.detach()

    this.currentNode = node
    this.currentStage = stage
    this.currentLayerId = node.id()

    const handleDelete = (e: Event) => {
      e.stopPropagation()
      callbacks.onDelete()
    }
    const handleReset = callbacks.onReset
      ? (e: Event) => {
          e.stopPropagation()
          callbacks.onReset!()
          this.updateResetVisibility()
          this.updatePosition()
        }
      : null

    this.deleteBtn?.addEventListener('pointerdown', handleDelete)
    if (handleReset) this.resetBtn?.addEventListener('pointerdown', handleReset)

    // Re-use bound reference so removeEventListener can match it
    const handleMove = this.updatePosition.bind(this)
    const handleInteractionEnd = () => {
      this.updatePosition()
      this.updateResetVisibility()
    }
    node.on('dragmove.layercontrols', handleMove)
    node.on('transform.layercontrols', handleMove)
    node.on('dragend.layercontrols', handleInteractionEnd)
    node.on('transformend.layercontrols', handleInteractionEnd)

    this.cleanup = () => {
      this.deleteBtn?.removeEventListener('pointerdown', handleDelete)
      if (handleReset) this.resetBtn?.removeEventListener('pointerdown', handleReset)
      node.off('dragmove.layercontrols')
      node.off('transform.layercontrols')
      node.off('dragend.layercontrols')
      node.off('transformend.layercontrols')
    }

    this.updateResetVisibility()
    this.updatePosition()
    this.actionsEl?.classList.add('emtlkit-lc-actions--visible')
  }

  /**
   * Control which action buttons are allowed for the current selection.
   * - showDelete: immediately shows/hides the delete button
   * - showReset: gates reset visibility — when true, reset shows only if transform differs from default
   *
   * Must be called BEFORE attachToNode so updateResetVisibility() respects _resetAllowed.
   */
  setButtonVisibility(visibility: LayerControlsVisibility): void {
    if (this.deleteBtn) this.deleteBtn.style.display = visibility.showDelete ? '' : 'none'
    this._resetAllowed = visibility.showReset
    // Re-evaluate reset visibility: shows only if allowed AND transform differs from default
    this.updateResetVisibility()
  }

  /** Whether reset button is allowed for the current layer type. */
  private _resetAllowed = true

  /** Detach from current node and hide. */
  detach(): void {
    this.cleanup?.()
    this.cleanup = null
    this.currentNode = null
    this.currentStage = null
    this.currentLayerId = null
    if (this.resetBtn) this.resetBtn.style.display = 'none'
    this.actionsEl?.classList.remove('emtlkit-lc-actions--visible')
  }

  /**
   * Show/hide reset button based on whether the layer's current transform
   * differs from its merchant default.
   */
  private updateResetVisibility(): void {
    if (!this.resetBtn) return
    if (!this._resetAllowed) {
      this.resetBtn.style.display = 'none'
      return
    }
    const current = this.currentLayerId ? StorefrontLayerState.getCurrent(this.currentLayerId) : null
    const defaults = this.currentLayerId ? StorefrontLayerState.getDefault(this.currentLayerId) : null
    if (!current || !defaults) {
      this.resetBtn.style.display = 'none'
      return
    }
    const changed
      = Math.abs(current.x - defaults.x) > POS_TOL
      || Math.abs(current.y - defaults.y) > POS_TOL
      || Math.abs(current.width - defaults.width) > POS_TOL
      || Math.abs(current.height - defaults.height) > POS_TOL
      || Math.abs(current.rotation - defaults.rotation) > ROT_TOL
    this.resetBtn.style.display = changed ? '' : 'none'
  }

  /** Update position of the actions overlay based on current node state. */
  updatePosition(): void {
    if (!this.currentNode || !this.currentStage || !this.actionsEl) return

    const { currentNode: node, currentStage: stage, actionsEl } = this
    const box = node.getClientRect({ relativeTo: stage })
    const stageRect = stage.container().getBoundingClientRect()
    const containerRect = this.container.getBoundingClientRect()
    const stageScale = stage.scaleX()

    const absLeft = stageRect.left - containerRect.left + box.x * stageScale
    const absTop = stageRect.top - containerRect.top + box.y * stageScale
    const flipToBelow = absTop < FLIP_THRESHOLD_PX

    actionsEl.classList.toggle('emtlkit-lc-actions--above', !flipToBelow)
    actionsEl.classList.toggle('emtlkit-lc-actions--below', flipToBelow)

    actionsEl.style.top = flipToBelow ? `${absTop + box.height * stageScale}px` : `${absTop}px`
    actionsEl.style.left = `${absLeft + (box.width * stageScale) / 2}px`
    actionsEl.style.transform = flipToBelow ? 'translateX(-50%)' : 'translate(-50%, -100%) translateY(-6px)'
  }

  /** Destroy the DOM overlay completely. */
  destroy(): void {
    this.detach()
    this.wrapper.parentElement?.removeChild(this.wrapper)
  }
}
