/** @jsxImportSource preact */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks'
import type { ModalProps } from './index'
import { Modal } from './index'
import { ProductPersonalizerWebComponentTag } from '../../../../constants'
import { Transmitter } from '../../../../libraries/transmitter'
import { TransmitterEvents } from '../../../../constants/transmitter-events'
import { translate } from '../../../../libraries/translation'
import { EXPRESS_CHECKOUT_SELECTORS } from '../../../../handlers/buyItNowHandler'
import {
  clickAddToCart,
  findAddToCartForm,
  findExpressCheckoutButton,
} from '../../../../utils/selectors/addToCartSelectors'
import { Button } from '../../commons/button'
import { ConfirmationCheckbox } from '../../commons/confirmation-checkbox'
import { getConfirmationCheckboxSettings } from '../../../../features/confirmation-checkbox/settings'
import { getPostAtcRedirectSettings } from '../../../../features/post-atc-redirect/settings'
import { armCheckoutRedirectOnce, tagAddToCartForm } from '../../../../features/post-atc-redirect/redirect-interceptor'
import { FormManager } from '../../../../components/form-manager'
import {
  applyCenteringStyles,
  restoreCenteringStyles,
  saveCenteringStyles,
} from '../../../../utils/center-element-styles'

interface HTMLElementWithDataset extends HTMLElement {
  dataset: DOMStringMap & {
    __prevWidth?: string
    __prevHeight?: string
  }
}

interface CustomizerModalProps extends Omit<ModalProps, 'children'> {
  /** Container selector for the product image */
  productImageSelector: string
  /** The customizer content to display in modal */
  customizerContent: HTMLElement | null
  /** Which actions to render in footer */
  showAddToCart?: boolean
  showBuyItNow?: boolean
}

/**
 * Customizer Modal Component
 * Handles product image cloning and customizer content display
 */
export function CustomizerModal({
  open,
  onClose,
  productImageSelector,
  customizerContent,
  showAddToCart = true,
  showBuyItNow = false,
  ...modalProps
}: CustomizerModalProps) {
  const customizerContentRef = useRef<HTMLDivElement>(null)
  const productImageContainerRef = useRef<HTMLDivElement>(null)
  const [loadingAction, setLoadingAction] = useState<null | 'add' | 'buy'>(null)

  // Confirmation checkbox state
  const confirmationSettings = getConfirmationCheckboxSettings()
  const [confirmationChecked, setConfirmationChecked] = useState(false)
  const [confirmationShake, setConfirmationShake] = useState(false)

  // Wrapper to persist checkbox state to FormManager (survives modal close)
  const handleConfirmationChange = useCallback((checked: boolean) => {
    setConfirmationChecked(checked)
    FormManager.setModalConfirmationChecked(checked)
  }, [])

  // Reset checkbox when design changes (listen to option changes)
  useEffect(() => {
    if (!open || !confirmationSettings.enabled) return

    const handleOptionChange = () => {
      // Uncheck checkbox when customer changes their design
      if (confirmationChecked) {
        setConfirmationChecked(false)
        FormManager.setModalConfirmationChecked(false)
      }
    }

    Transmitter.listen(TransmitterEvents.SET_OPTIONS, handleOptionChange)
    return () => {
      Transmitter.remove(TransmitterEvents.SET_OPTIONS, handleOptionChange)
    }
  }, [open, confirmationSettings.enabled, confirmationChecked])

  // Keep track of the original location of the customizer root so we can move it back
  const originalParentRef = useRef<HTMLElement | null>(null)
  const originalNextRef = useRef<Node | null>(null)

  // Remember original location of product image / canvas container
  const originalPicParentRef = useRef<HTMLElement | null>(null)
  const originalPicNextRef = useRef<Node | null>(null)

  const PRE_CLOSE_DELAY_MS = 500
  const AFTER_CLOSE_DELAY_MS = 350

  // Product image handling omitted for brevity – optional clone not required for logic

  /**
   * Move the live TailorKitProductPersonalizer element into the modal on open
   * and move it back to its original position on close. This keeps all native
   * and Preact event handlers intact (no cloning required).
   */
  useLayoutEffect(() => {
    if (!customizerContent || !customizerContentRef.current) return

    const hostSelector = ProductPersonalizerWebComponentTag
    // Always resolve the actual web component separately, regardless of what we're moving
    const webComponent
      = (customizerContent.closest(hostSelector) as HTMLElement | null)
      || (customizerContent.querySelector(hostSelector) as HTMLElement | null)
      || (document.querySelector(`${hostSelector}[data-modal-instance="true"]`) as HTMLElement | null)

    // Determine what element to move (container or web component)
    let root = customizerContent.closest(hostSelector) as HTMLElement | null
    if (!root) {
      // If not inside product-personalizer, move the container itself
      root = customizerContent as HTMLElement
    }
    if (!root) return

    if (open) {
      // Remember original location once
      if (!originalParentRef.current) {
        originalParentRef.current = root.parentElement as HTMLElement | null
        originalNextRef.current = root.nextSibling
      }
      // Ensure inline content becomes visible in modal
      if (root.classList.contains('emtlkit--tab-content-container')) {
        ;(root as HTMLElement).style.display = 'initial'
      } else {
        root.querySelector('.emtlkit--tab-content-container')?.setAttribute('style', 'display:initial')
      }
      // Guard against double-move
      if (!customizerContentRef.current.contains(root)) {
        customizerContentRef.current.appendChild(root)
      }

      // Mark the actual web component as modal instance (not the container div)
      if (webComponent && !webComponent.hasAttribute('data-modal-instance')) {
        webComponent.setAttribute('data-modal-instance', 'true')
      } else if (!webComponent) {
        console.warn('[TailorKit][modal] could not find web component to mark as modal instance')
      }

      // Move product image/canvas into modal view section
      const pic = document.querySelector(productImageSelector) as HTMLElement | null
      if (pic && productImageContainerRef.current) {
        if (!originalPicParentRef.current) {
          originalPicParentRef.current = pic.parentElement as HTMLElement | null
          originalPicNextRef.current = pic.nextSibling
        }

        // Store original inline styles to restore later
        const el = pic as HTMLElementWithDataset
        el.dataset.__prevWidth = el.style.width || ''
        el.dataset.__prevHeight = el.style.height || ''

        el.style.width = '100%'
        el.style.height = '100%'

        // Apply centering styles to img inside the container (match canvas positioning)
        const img = pic.querySelector('img') as HTMLImageElement | null
        if (img) {
          saveCenteringStyles(img, { fillContainer: true })
          applyCenteringStyles(img, { fillContainer: true })
        }

        if (!productImageContainerRef.current.contains(pic)) {
          productImageContainerRef.current.innerHTML = ''
          productImageContainerRef.current.appendChild(pic)
        }
      }
    } else if (originalParentRef.current) {
      // Move root back only if needed
      if (root.parentElement !== originalParentRef.current) {
        if (originalNextRef.current) {
          originalParentRef.current.insertBefore(root, originalNextRef.current)
        } else {
          originalParentRef.current.appendChild(root)
        }
      }
      // Remove modal marker from the actual web component (not container div)
      const webComponentToUnmark
        = (root.closest(hostSelector) as HTMLElement | null)
        || (root.querySelector(hostSelector) as HTMLElement | null)
        || (document.querySelector(`${hostSelector}[data-modal-instance="true"]`) as HTMLElement | null)
      if (webComponentToUnmark && webComponentToUnmark.hasAttribute('data-modal-instance')) {
        webComponentToUnmark.removeAttribute('data-modal-instance')
      }
      // Hide inline customizer for modal mode
      if (root.classList.contains('emtlkit--tab-content-container')) {
        ;(root as HTMLElement).style.display = 'none'
      } else {
        root.querySelector('.emtlkit--tab-content-container')?.setAttribute('style', 'display:none')
      }

      // Move product image back inline
      const pic = document.querySelector(productImageSelector) as HTMLElement | null
      if (pic && originalPicParentRef.current) {
        // Restore original size styles
        const el = pic as HTMLElementWithDataset
        const prevW = el.dataset.__prevWidth || ''
        const prevH = el.dataset.__prevHeight || ''
        el.style.width = prevW
        el.style.height = prevH
        delete el.dataset.__prevWidth
        delete el.dataset.__prevHeight

        // Restore img styles
        const img = pic.querySelector('img') as HTMLImageElement | null
        if (img) {
          restoreCenteringStyles(img)
        }

        if (pic.parentElement !== originalPicParentRef.current) {
          if (originalPicNextRef.current) {
            originalPicParentRef.current.insertBefore(pic, originalPicNextRef.current)
          } else {
            originalPicParentRef.current.appendChild(pic)
          }
        }
      }
      // Reset refs after successful move-back
      originalParentRef.current = null
      originalNextRef.current = null
      originalPicParentRef.current = null
      originalPicNextRef.current = null
    }
  }, [open, customizerContent, productImageSelector])

  // No special product image handling needed – existing CSS covers it

  // Removed cloneAndReplaceCustomizer logic – moving preserves state

  const handleClose = useCallback(() => {
    // Before clearing modal content, move product image back synchronously
    try {
      const modalPic = productImageContainerRef.current?.querySelector(productImageSelector) as HTMLElement | null
      if (modalPic && originalPicParentRef.current) {
        const el = modalPic as HTMLElementWithDataset
        const prevW = el.dataset.__prevWidth || ''
        const prevH = el.dataset.__prevHeight || ''
        el.style.width = prevW
        el.style.height = prevH
        delete el.dataset.__prevWidth
        delete el.dataset.__prevHeight

        // Restore img styles
        const img = modalPic.querySelector('img') as HTMLImageElement | null
        if (img) {
          restoreCenteringStyles(img)
        }

        if (originalPicNextRef.current) {
          originalPicParentRef.current.insertBefore(modalPic, originalPicNextRef.current)
        } else {
          originalPicParentRef.current.appendChild(modalPic)
        }
        // Clear refs proactively
        originalPicParentRef.current = null
        originalPicNextRef.current = null
      }
    } catch {
      // best-effort; effect will also attempt to move back
    }

    // Call parent close handler
    // Note: useLayoutEffect cleanup handles moving content back when open→false
    onClose()
  }, [onClose, productImageSelector])

  /**
   * Validate all required fields before submission
   * Returns true if valid, false if invalid
   */
  const validateAllFields = useCallback(() => {
    // Validate required text-customer fields
    if (!FormManager.validateRequiredTextCustomers()) {
      return false
    }

    // Validate required image upload fields
    if (!FormManager.validateRequiredImageUploads()) {
      return false
    }

    // Validate confirmation checkbox if enabled
    if (confirmationSettings.enabled && !confirmationChecked) {
      setConfirmationShake(true)
      return false
    }

    return true
  }, [confirmationSettings.enabled, confirmationChecked])

  // Reset shake/error state when user checks the checkbox
  useEffect(() => {
    if (confirmationChecked && confirmationShake) {
      setConfirmationShake(false)
    }
  }, [confirmationChecked, confirmationShake])

  /**
   * Resolve add-to-cart form + button on the page and trigger it
   */
  const triggerThemeAddToCart = useCallback(() => {
    // Validate confirmation checkbox first
    if (!validateAllFields()) {
      return
    }

    try {
      // Provide immediate feedback in the modal
      setLoadingAction('add')
      // Brief loading, then close modal and fire theme action
      setTimeout(() => {
        handleClose()
        setTimeout(() => {
          // Content is back inside the customizer — trigger IMMEDIATE option sync
          // so handleOptionSetChange updates the ATC form with pricing/properties
          // synchronously before clickAddToCart fires. Without `immediate: true`,
          // the customizer debounces this by 300ms and the form would be stale.
          Transmitter.trigger(TransmitterEvents.SET_OPTIONS, { immediate: true })

          // Skip FormManager's checkbox validation since modal already validated
          FormManager.setSkipCheckboxValidation(true)

          // Arm one-shot redirect-to-checkout intercept if merchant opted in.
          // Tag the ATC form with a line-item-property marker so the
          // interceptor can ignore unrelated cart-adds (theme upsells, cart
          // drawer recommendations, subscription apps) fired during the
          // armed window.
          if (getPostAtcRedirectSettings().enabled) {
            const atcForm = findAddToCartForm()
            if (atcForm) {
              tagAddToCartForm(atcForm)
              armCheckoutRedirectOnce()
            } else {
              console.warn(
                '[TailorKit] Direct-to-checkout is enabled but no add-to-cart form was found on the page — falling back to theme default behavior.'
              )
            }
          }

          const clicked = clickAddToCart()
          if (!clicked) {
            console.warn('[TailorKit] Unable to find a working Add to cart button/form')
          }
          setLoadingAction(null)
        }, AFTER_CLOSE_DELAY_MS)
      }, PRE_CLOSE_DELAY_MS)
    } catch (error) {
      console.error('[TailorKit] Failed to trigger Add to cart:', error)
    }
  }, [handleClose, validateAllFields])

  /**
   * Resolve a Buy It Now / express checkout button on the page and click it
   * This preserves compatibility with 3rd-party apps and Shopify accelerated checkout
   */
  const triggerThemeBuyItNow = useCallback(() => {
    // Validate confirmation checkbox first
    if (!validateAllFields()) {
      return
    }

    try {
      setLoadingAction('buy')
      setTimeout(() => {
        handleClose()
        setTimeout(() => {
          // Sync options to ATC form (same reason as triggerThemeAddToCart)
          Transmitter.trigger(TransmitterEvents.SET_OPTIONS, { immediate: true })

          // Skip FormManager's checkbox validation since modal already validated
          FormManager.setSkipCheckboxValidation(true)

          // Use centralized helper that prefers buttons within the main product form
          // This avoids triggering buttons in cart drawer upsells or other forms
          const btn = findExpressCheckoutButton(EXPRESS_CHECKOUT_SELECTORS)
          if (btn) {
            btn.click()
            setLoadingAction(null)
            return
          }

          // Fallback: locate Shopify payment button
          const fallback = document.querySelector('.shopify-payment-button__button') as HTMLElement | null
          fallback?.click()
          setLoadingAction(null)
        }, AFTER_CLOSE_DELAY_MS)
      }, PRE_CLOSE_DELAY_MS)
    } catch (error) {
      console.error('[TailorKit] Failed to trigger Buy it now:', error)
    }
  }, [handleClose, validateAllFields])

  // Render confirmation checkbox if enabled (for inside scrollable content)
  const renderConfirmationCheckbox = useCallback(() => {
    if (!confirmationSettings.enabled) {
      return null
    }
    return (
      <ConfirmationCheckbox
        checked={confirmationChecked}
        onChange={handleConfirmationChange}
        message={confirmationSettings.message}
        shake={confirmationShake}
      />
    )
  }, [
    confirmationSettings.enabled,
    confirmationSettings.message,
    confirmationChecked,
    confirmationShake,
    handleConfirmationChange,
  ])

  const modalContent = (
    <div className="emtlkit-modal__customizer-content">
      {/* Product image / canvas */}
      <div ref={productImageContainerRef} className="emtlkit-modal__product-image-container" />

      {/* Customizer sidebar */}
      <div className="emtlkit-modal__scrollable-content">
        <div ref={customizerContentRef} />
        {/* Confirmation checkbox at bottom of personalizer content */}
        {renderConfirmationCheckbox()}
      </div>
    </div>
  )

  const actionCount = (showAddToCart ? 1 : 0) + (showBuyItNow ? 1 : 0)

  let footer: any

  if (actionCount === 2) {
    // Both actions – secondary on the left, primary (Buy it now) on the right
    footer = (
      <div className="emtlkit-modal__footer-wrapper">
        <div className="emtlkit-modal__button-group">
          <Button
            variant="secondary"
            onClick={triggerThemeAddToCart}
            disabled={loadingAction !== null}
            loading={loadingAction === 'add'}
          >
            {translate('add-to-cart', 'Add to cart')}
          </Button>
          <Button
            variant="primary"
            onClick={triggerThemeBuyItNow}
            disabled={loadingAction !== null}
            loading={loadingAction === 'buy'}
          >
            {translate('buy-it-now', 'Buy it now')}
          </Button>
        </div>
      </div>
    )
  } else if (actionCount === 1) {
    // One action – render Close on the left, then the single primary action
    footer = (
      <div className="emtlkit-modal__footer-wrapper">
        <div className="emtlkit-modal__button-group">
          <Button variant="secondary" onClick={handleClose}>
            {translate('close', 'Close')}
          </Button>
          {showAddToCart && (
            <Button
              variant="primary"
              onClick={triggerThemeAddToCart}
              disabled={loadingAction !== null}
              loading={loadingAction === 'add'}
            >
              {translate('add-to-cart', 'Add to cart')}
            </Button>
          )}
          {showBuyItNow && (
            <Button
              variant="primary"
              onClick={triggerThemeBuyItNow}
              disabled={loadingAction !== null}
              loading={loadingAction === 'buy'}
            >
              {translate('buy-it-now', 'Buy it now')}
            </Button>
          )}
        </div>
      </div>
    )
  } else {
    // No actions – only Done
    footer = (
      <div className="emtlkit-modal__footer-wrapper">
        <div className="emtlkit-modal__button-group">
          <Button onClick={handleClose}>{translate('done', 'Done')}</Button>
        </div>
      </div>
    )
  }

  return Modal({
    ...modalProps,
    open,
    onClose: handleClose,
    footerContent: footer,
    children: modalContent,
  })
}
