/** @jsxImportSource preact */
import { useCallback, useEffect, useRef } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import { Portal } from '../portal'

export interface ModalProps {
  /** Whether the modal is open */
  open: boolean
  /** Called when the modal requests to be closed */
  onClose: () => void
  /** Modal title */
  title?: string
  /** The modal content */
  children: ComponentChildren
  /** Additional CSS classes */
  className?: string
  /** Whether to show close button in header */
  showCloseButton?: boolean
  /** Modal size */
  size?: 'small' | 'medium' | 'large'
  /** Primary action button props */
  primaryAction?: {
    content: string
    onAction: () => void
    loading?: boolean
    disabled?: boolean
  }
  /** Optional custom footer content (replaces default primaryAction footer) */
  footerContent?: ComponentChildren
  /** Additional CSS classes for the title */
  titleClassName?: string
}

/**
 * TailorKit Modal Component - Full-screen on mobile, centered on desktop
 * Matches the Figma design for the customizer modal
 */
export function Modal({
  open,
  onClose,
  title = 'Personalize design',
  children,
  className = '',
  showCloseButton = true,
  primaryAction,
  footerContent,
  size = 'medium',
  titleClassName = '',
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const lastFocusedElement = useRef<HTMLElement | null>(null)

  // Handle escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    },
    [onClose]
  )

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose()
      }
    },
    [onClose]
  )

  // Focus management
  useEffect(() => {
    if (open) {
      // Save currently focused element
      lastFocusedElement.current = document.activeElement as HTMLElement

      // Prevent body scroll
      document.body.style.overflow = 'hidden'

      // Focus modal
      setTimeout(() => {
        modalRef.current?.focus()
      }, 50)

      // Add event listeners
      document.addEventListener('keydown', handleKeyDown)

      return () => {
        // Restore body scroll
        document.body.style.overflow = ''

        // Remove event listeners
        document.removeEventListener('keydown', handleKeyDown)

        // Restore focus
        if (lastFocusedElement.current) {
          lastFocusedElement.current.focus()
        }
      }
    }
  }, [open, handleKeyDown])

  if (!open) return null

  const modalContent = (
    <div
      className={`emtlkit-modal-backdrop ${className}`}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="emtlkit-modal-title"
    >
      <div ref={modalRef} className={`emtlkit-modal emtlkit-modal--${size}`} tabIndex={-1} role="document">
        {/* Modal Header */}
        <div className="emtlkit-modal__header">
          <h3 id="emtlkit-modal-title" className={`emtlkit-modal__title ${titleClassName}`}>
            {title}
          </h3>
          {showCloseButton && (
            <button className="emtlkit-modal__close-button" onClick={onClose} aria-label="Close modal" type="button">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M15 5L5 15M5 5L15 15"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Modal Content */}
        <div className="emtlkit-modal__content">{children}</div>

        {/* Modal Footer */}
        {(footerContent !== null || primaryAction) && (
          <div className="emtlkit-modal__footer">
            <div className="emtlkit-modal__actions">
              {footerContent !== null ? (
                footerContent
              ) : (
                <button
                  className={`emtlkit-modal__primary-action ${primaryAction?.loading ? 'emtlkit-modal__primary-action--loading' : ''}`}
                  onClick={primaryAction?.onAction || (() => {})}
                  disabled={!!(primaryAction?.disabled || primaryAction?.loading)}
                  type="button"
                >
                  {primaryAction?.loading ? 'Loading...' : primaryAction?.content}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )

  // Render modal using pure Preact portal
  return <Portal>{modalContent}</Portal>
}
