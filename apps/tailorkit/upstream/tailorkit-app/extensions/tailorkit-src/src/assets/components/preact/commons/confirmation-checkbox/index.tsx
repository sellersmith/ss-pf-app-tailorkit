/** @jsxImportSource preact */
import { useCallback, useEffect, useRef } from 'preact/hooks'

export interface ConfirmationCheckboxProps {
  id?: string
  checked: boolean
  onChange: (checked: boolean) => void
  message: string
  shake?: boolean
  onShakeEnd?: () => void
  disabled?: boolean
}

/**
 * ConfirmationCheckbox Component
 *
 * A checkbox that customers must check before adding to cart.
 * Supports shake animation to draw attention when validation fails.
 */
export function ConfirmationCheckbox({
  id = 'emtlkit-confirmation-checkbox',
  checked,
  onChange,
  message,
  shake = false,
  onShakeEnd,
  disabled = false,
}: ConfirmationCheckboxProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Listen for animationend to notify parent
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return

    const handleAnimationEnd = (e: AnimationEvent) => {
      if (e.animationName === 'emtlkit-shake') {
        onShakeEnd?.()
      }
    }

    el.addEventListener('animationend', handleAnimationEnd)
    return () => el.removeEventListener('animationend', handleAnimationEnd)
  }, [onShakeEnd])

  const handleChange = useCallback(
    (e: Event) => {
      const target = e.target as HTMLInputElement
      onChange(target.checked)
    },
    [onChange]
  )

  const wrapperClasses = [
    'emtlkit-confirmation-checkbox',
    shake && 'emtlkit-confirmation-checkbox--shake',
    disabled && 'emtlkit-confirmation-checkbox--disabled',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div ref={wrapperRef} className={wrapperClasses} data-confirmation-checkbox="true">
      <label className="emtlkit-confirmation-checkbox__label" htmlFor={id}>
        <input
          type="checkbox"
          id={id}
          className="emtlkit-confirmation-checkbox__input"
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
          data-confirmation-input="true"
        />
        <span className="emtlkit-confirmation-checkbox__checkmark" />
        <span className="emtlkit-confirmation-checkbox__text">{message}</span>
      </label>
    </div>
  )
}

export default ConfirmationCheckbox
