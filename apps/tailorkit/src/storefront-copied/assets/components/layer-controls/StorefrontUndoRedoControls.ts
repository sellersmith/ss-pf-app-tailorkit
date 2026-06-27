/**
 * StorefrontUndoRedoControls — Undo/Redo toolbar bar.
 *
 * Mounts OUTSIDE the canvas container as a sibling flow element.
 * Automatically re-mounts when canvas moves between inline and modal contexts.
 * Hidden when no undo/redo history; appears after user makes changes.
 * Keyboard: Ctrl+Z / Cmd+Z (undo), Ctrl+Shift+Z / Cmd+Shift+Z (redo).
 */

export interface UndoRedoCallbacks {
  onUndo: () => void
  onRedo: () => void
}

export class StorefrontUndoRedoControls {
  private container: HTMLElement
  private wrapper: HTMLElement
  private undoBtn: HTMLButtonElement
  private redoBtn: HTMLButtonElement
  private keyHandler: ((e: KeyboardEvent) => void) | null = null

  constructor(canvasContainer: HTMLElement, callbacks: UndoRedoCallbacks) {
    this.container = canvasContainer

    // Build DOM
    this.wrapper = document.createElement('div')
    this.wrapper.className = 'emtlkit-lc-undoredo'
    this.wrapper.style.display = 'none'
    this.wrapper.setAttribute('role', 'toolbar')
    this.wrapper.setAttribute('aria-label', 'Undo/Redo')

    this.undoBtn = document.createElement('button')
    this.undoBtn.className = 'emtlkit-lc-btn emtlkit-lc-btn--undo'
    this.undoBtn.type = 'button'
    this.undoBtn.title = 'Undo'
    this.undoBtn.setAttribute('aria-label', 'Undo')
    this.undoBtn.disabled = true
    this.undoBtn.innerHTML = `
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
        <path d="M3 6h7a3 3 0 0 1 0 6H8" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M6 3L3 6l3 3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `

    this.redoBtn = document.createElement('button')
    this.redoBtn.className = 'emtlkit-lc-btn emtlkit-lc-btn--redo'
    this.redoBtn.type = 'button'
    this.redoBtn.title = 'Redo'
    this.redoBtn.setAttribute('aria-label', 'Redo')
    this.redoBtn.disabled = true
    this.redoBtn.innerHTML = `
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
        <path d="M13 6H6a3 3 0 0 0 0 6h2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M10 3l3 3-3 3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `

    this.undoBtn.addEventListener('pointerdown', e => {
      e.stopPropagation()
      callbacks.onUndo()
    })

    this.redoBtn.addEventListener('pointerdown', e => {
      e.stopPropagation()
      callbacks.onRedo()
    })

    // Divider dot between buttons for visual separation
    const dot = document.createElement('span')
    dot.className = 'emtlkit-lc-undoredo__divider'
    dot.setAttribute('aria-hidden', 'true')

    this.wrapper.appendChild(this.undoBtn)
    this.wrapper.appendChild(dot)
    this.wrapper.appendChild(this.redoBtn)

    // Deferred mount: toolbar mounts on first update() with history.
    // Mounting at construction corrupts modal's DOM position references
    // (originalPicNextRef captures toolbar as nextSibling, then stale on close).

    // Keyboard shortcuts
    this.keyHandler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey
      if (!isMod) return

      // Don't intercept when user is typing in an input/textarea
      const target = e.target as HTMLElement
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }

      if (e.key === 'z' || e.key === 'Z') {
        if (e.shiftKey) {
          e.preventDefault()
          callbacks.onRedo()
        } else {
          e.preventDefault()
          callbacks.onUndo()
        }
      }
    }

    document.addEventListener('keydown', this.keyHandler)
  }

  /** Update button enabled state and visibility. Re-mounts if canvas moved contexts. */
  update(canUndo: boolean, canRedo: boolean): void {
    this.undoBtn.disabled = !canUndo
    this.redoBtn.disabled = !canRedo

    const shouldShow = canUndo || canRedo
    this.wrapper.style.display = shouldShow ? 'flex' : 'none'

    // Re-mount if canvas was moved (e.g., into/out of modal)
    if (shouldShow) {
      this.mountToolbar()
    }
  }

  /**
   * Mount toolbar in the correct DOM position based on context.
   *
   * CRITICAL: Toolbar must NEVER be in the product image DOM subtree or adjacent
   * as a sibling. The modal tracks pic.nextSibling — any element there that later
   * moves makes the ref stale → product image disappears on modal close.
   *
   * - Modal: prepend to .emtlkit-modal__scrollable-content (above charm picker)
   * - Inline: prepend to <tailorkit-product-personalizer> (customizer area, right side)
   *   Completely separate DOM subtree from image area → zero modal ref interference.
   */
  private mountToolbar(): void {
    const modalImageContainer = this.container.closest('.emtlkit-modal__product-image-container')

    if (modalImageContainer && modalImageContainer.parentElement) {
      // Modal context: prepend to .emtlkit-modal__scrollable-content
      const scrollable = modalImageContainer.parentElement.querySelector('.emtlkit-modal__scrollable-content')
      if (scrollable) {
        if (this.wrapper.parentElement === scrollable && scrollable.firstElementChild === this.wrapper) return
        scrollable.insertBefore(this.wrapper, scrollable.firstChild)
      }
    } else {
      // Inline context: mount inside the web component (customizer area on right side).
      // This is a completely separate DOM subtree from the product image area.
      const personalizer = document.querySelector('tailorkit-product-personalizer')
      if (personalizer) {
        if (this.wrapper.parentElement === personalizer && personalizer.firstElementChild === this.wrapper) return
        personalizer.insertBefore(this.wrapper, personalizer.firstChild)
      }
    }
  }

  /** Destroy the controls and remove keyboard listeners. */
  destroy(): void {
    if (this.keyHandler) {
      document.removeEventListener('keydown', this.keyHandler)
      this.keyHandler = null
    }
    this.wrapper.parentElement?.removeChild(this.wrapper)
  }
}
