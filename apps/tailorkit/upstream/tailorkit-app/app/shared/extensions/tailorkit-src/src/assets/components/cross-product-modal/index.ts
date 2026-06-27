/**
 * Cross-Product Personalizer Modal
 *
 * Cleanup order (critical): extract properties FIRST, then dispose canvas,
 * then destroy registries, then close/destroy modal.
 */

import EmtlkitModal from '../commons/modal/index'
import { MODAL_SIZES } from '../commons/modal/constants'
import { fetchPersonalizerElement } from '../../services/cross-product-personalizer-fetcher'
import { extractPersonalizerProperties } from '../../utils/extract-personalizer-properties'
import { destroyStorefrontLayerState } from '../../stores/storefront-layer-state'
import { destroyStorefrontUndoStack } from '../../stores/storefront-undo-stack'
import { destroyFormManagerInstance } from '../form-manager'
import { CanvasPreviewManager } from '../canvas-preview-manager'
import { TAILORKIT_EVENTS, dispatchTailorKitEvent } from '../../events'
import type { TailorKitPersonalizerCompleteEventDetail, TailorKitPersonalizerCancelledEventDetail } from '../../events'

interface ProductPersonalizerElement extends HTMLElement {
  canvasManager?: {
    dispose: () => void
    getStage?: () => { container?: () => HTMLElement } | null
    pauseAnimation?: () => void
    resumeAnimation?: () => void
  }
}

export interface CrossProductModalOptions {
  requestId: string
  productHandle: string
  productId: string
  variantId: string
  productTitle?: string
}

const buildModalInstanceId = (productId: string) => `${productId}::modal`

export function openCrossProductPersonalizerModal(options: CrossProductModalOptions): void {
  const { requestId, productHandle, productId, variantId, productTitle } = options
  const instanceId = buildModalInstanceId(productId)

  let customizerEl: HTMLElement | null = null
  let hasCompleted = false

  const footer = buildFooterElement({
    onDone: () => handleDone(),
    onCancel: () => handleCancel(),
  })

  const loadingContent = buildLoadingContent()

  const modal = new EmtlkitModal({
    header: productTitle ? `Personalize: ${productTitle}` : 'Personalize Product',
    content: loadingContent,
    footer,
    size: MODAL_SIZES.LARGE,
    closeOnBackdropClick: false,
    closeOnEsc: true,
    zIndex: 10000,
    onClose: () => {
      if (!hasCompleted) {
        dispatchCancelled(requestId)
      }
      cleanup(modal, customizerEl, instanceId)
    },
  })

  pauseMainCanvas()
  modal.open()

  function fetchAndInject() {
    modal.update({ content: buildLoadingContent() })

    fetchPersonalizerElement(productHandle, variantId, productId)
      .then(el => {
        if (!el) {
          modal.update({ content: buildErrorContent(fetchAndInject) })
          return
        }

        customizerEl = el
        modal.update({ content: buildPersonalizerWrapper(el) })
      })
      .catch(err => {
        console.error('[TailorKit] Cross-product modal fetch error:', err)
        modal.update({ content: buildErrorContent(fetchAndInject) })
      })
  }

  fetchAndInject()

  async function handleDone() {
    if (!customizerEl) {
      handleCancel()
      return
    }

    // Show loading state on Done button while uploading preview
    const doneBtn = footer.querySelector<HTMLButtonElement>('.emtlkit-button--primary')
    setButtonLoading(doneBtn, true)

    try {
      // CRITICAL: extract properties BEFORE disposing/destroying anything.
      // Async because cross-product preview must be uploaded to our server
      // (addon items go via JSON /cart/add.js which can't carry file blobs).
      const properties = await extractPersonalizerProperties(customizerEl, instanceId)
      hasCompleted = true

      dispatchTailorKitEvent<TailorKitPersonalizerCompleteEventDetail>(TAILORKIT_EVENTS.PERSONALIZER_COMPLETE, {
        requestId,
        properties,
      })

      modal.close()
    } catch (err) {
      console.error('[TailorKit] Cross-product handleDone error:', err)
      setButtonLoading(doneBtn, false)
    }
  }

  function handleCancel() {
    modal.close()
  }
}

function dispatchCancelled(requestId: string): void {
  dispatchTailorKitEvent<TailorKitPersonalizerCancelledEventDetail>(TAILORKIT_EVENTS.PERSONALIZER_CANCELLED, {
    requestId,
  })
}

/** Order: dispose canvas → destroy registries → restore main canvas → destroy modal DOM. */
function cleanup(modal: EmtlkitModal, customizerEl: HTMLElement | null, instanceId: string): void {
  try {
    if (customizerEl) {
      // Detach stage container BEFORE Stage.destroy() to prevent "removeChild" error
      // (Konva tries to remove it internally, but modal may have already cleared content).
      const pp = customizerEl.querySelector('tailorkit-product-personalizer') as ProductPersonalizerElement | null
      if (pp && typeof pp.canvasManager?.dispose === 'function') {
        try {
          const stage = pp.canvasManager.getStage?.()
          const stageContainer = stage?.container?.()
          if (stageContainer?.parentElement) {
            stageContainer.parentElement.removeChild(stageContainer)
          }
          pp.canvasManager.dispose()
        } catch {
          // Already cleaned up — safe to ignore
        }
      }

      destroyStorefrontLayerState(instanceId)
      destroyStorefrontUndoStack(instanceId)
      destroyFormManagerInstance(instanceId)
      CanvasPreviewManager.cleanup(instanceId)
    }
  } catch (err) {
    console.error('[TailorKit] Cross-product modal cleanup error:', err)
  } finally {
    restoreMainCanvas()
    try {
      modal.destroy()
    } catch {
      // Already destroyed — ignore
    }
  }
}

/**
 * Build footer using the same design system as the normal personalizer modal.
 * Uses `.emtlkit-button` classes (single source of truth) instead of custom button styles.
 */
function buildFooterElement(callbacks: { onDone: () => void; onCancel: () => void }): HTMLElement {
  const footer = document.createElement('div')
  footer.className = 'emtlkit-modal__footer-wrapper'

  const buttonGroup = document.createElement('div')
  buttonGroup.className = 'emtlkit-modal__button-group'

  const cancelBtn = document.createElement('button')
  cancelBtn.type = 'button'
  cancelBtn.className = 'emtlkit-button emtlkit-button--secondary'
  cancelBtn.textContent = 'Cancel'
  cancelBtn.setAttribute('aria-label', 'Cancel personalization')
  cancelBtn.addEventListener('click', callbacks.onCancel)

  const doneBtn = document.createElement('button')
  doneBtn.type = 'button'
  doneBtn.className = 'emtlkit-button emtlkit-button--primary'
  doneBtn.textContent = 'Done'
  doneBtn.setAttribute('aria-label', 'Confirm personalization')
  doneBtn.addEventListener('click', callbacks.onDone)

  buttonGroup.appendChild(cancelBtn)
  buttonGroup.appendChild(doneBtn)
  footer.appendChild(buttonGroup)

  return footer
}

function buildLoadingContent(): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.className = 'tlk-cross-product-modal__loading'
  wrapper.setAttribute('aria-live', 'polite')
  wrapper.setAttribute('aria-label', 'Loading personalizer')

  const spinner = document.createElement('div')
  spinner.className = 'tlk-cross-product-modal__spinner'
  spinner.setAttribute('aria-hidden', 'true')

  const label = document.createElement('p')
  label.className = 'tlk-cross-product-modal__loading-label'
  label.textContent = 'Loading personalizer...'

  wrapper.appendChild(spinner)
  wrapper.appendChild(label)

  return wrapper
}

function buildErrorContent(onRetry?: () => void): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.className = 'tlk-cross-product-modal__error'

  const msg = document.createElement('p')
  msg.textContent = 'Unable to load the personalizer for this product.'
  wrapper.appendChild(msg)

  if (onRetry) {
    const retryBtn = document.createElement('button')
    retryBtn.type = 'button'
    retryBtn.className = 'emtlkit-button emtlkit-button--secondary'
    retryBtn.textContent = 'Try Again'
    retryBtn.addEventListener('click', onRetry)
    wrapper.appendChild(retryBtn)
  }

  return wrapper
}

/**
 * Build 2-column layout matching the normal personalizer modal.
 * Uses `.emtlkit-modal__customizer-content` (row: image + sidebar) as single source of truth.
 *
 * init-canvas.ts expects `data-modal-instance` + `.emtlkit-modal__product-image-container`
 * to mount the canvas inside the modal instead of the page's featured image.
 */
function buildPersonalizerWrapper(el: HTMLElement): HTMLElement {
  /* Outer wrapper — same class as normal modal's content layout */
  const wrapper = document.createElement('div')
  wrapper.className = 'emtlkit-modal__customizer-content'

  /* Left column: product image / canvas — CSS handles sizing (590×590 desktop, responsive mobile) */
  const imageContainer = document.createElement('div')
  imageContainer.className = 'emtlkit-modal__product-image-container'

  const ppEl = el.querySelector('tailorkit-product-personalizer')
  const piAttr = ppEl?.getAttribute('data-product-image')
  if (piAttr) {
    try {
      const pi = JSON.parse(piAttr.replace(/&quot;/g, '"').replace(/&amp;/g, '&'))
      if (pi?.u) {
        const img = document.createElement('img')
        img.src = pi.u
        img.className = 'emtlkit-modal__product-image'
        img.alt = 'Product preview'
        imageContainer.appendChild(img)
      }
    } catch {
      // Invalid JSON — skip image
    }
  }

  wrapper.appendChild(imageContainer)

  /* Right column: scrollable personalizer content — matches normal modal sidebar */
  const scrollableContent = document.createElement('div')
  scrollableContent.className = 'emtlkit-modal__scrollable-content'

  const pp = el.querySelector('tailorkit-product-personalizer')
  if (pp) {
    pp.setAttribute('data-modal-instance', 'true')
  }

  // Remove inline confirmation — modal uses its own Done/Cancel buttons
  el.querySelectorAll(
    '.emtlkit-inline-confirmation-checkbox-container, [data-confirmation-checkbox], [data-confirmation-input]'
  ).forEach(node => node.remove())

  scrollableContent.appendChild(el)
  wrapper.appendChild(scrollableContent)

  return wrapper
}

/** Pause main canvas to reduce GPU load while modal is open. */
function pauseMainCanvas(): void {
  try {
    const mainPP = document.querySelector(
      'tailorkit-product-personalizer:not([data-modal-instance])'
    ) as ProductPersonalizerElement | null
    if (mainPP?.canvasManager?.pauseAnimation) {
      mainPP.canvasManager.pauseAnimation()
    }
  } catch {
    // Non-critical — ignore
  }
}

function restoreMainCanvas(): void {
  try {
    const mainPP = document.querySelector(
      'tailorkit-product-personalizer:not([data-modal-instance])'
    ) as ProductPersonalizerElement | null
    if (mainPP?.canvasManager?.resumeAnimation) {
      mainPP.canvasManager.resumeAnimation()
    }
  } catch {
    // Non-critical — ignore
  }
}

/** Toggle loading spinner on a button using existing .emtlkit-button--loading pattern. */
function setButtonLoading(btn: HTMLButtonElement | null, loading: boolean): void {
  if (!btn) return
  if (loading) {
    btn.classList.add('emtlkit-button--loading')
    btn.setAttribute('disabled', 'true')
    if (!btn.querySelector('.emtlkit-button__spinner')) {
      const spinner = document.createElement('span')
      spinner.className = 'emtlkit-button__spinner'
      spinner.setAttribute('aria-hidden', 'true')
      btn.appendChild(spinner)
    }
  } else {
    btn.classList.remove('emtlkit-button--loading')
    btn.removeAttribute('disabled')
    btn.querySelector('.emtlkit-button__spinner')?.remove()
  }
}
