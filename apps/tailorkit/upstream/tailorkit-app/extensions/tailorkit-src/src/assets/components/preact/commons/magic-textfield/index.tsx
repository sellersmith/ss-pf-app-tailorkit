/** @jsxImportSource preact */
import { useCallback, useEffect, useRef } from 'preact/hooks'
import type { JSX } from 'preact'

interface MagicTextFieldProps {
  ariaLabel?: string
  placeholder?: string
  disabled?: boolean
  autoFocus?: boolean
  value: string
  onChange: (value: string) => void
  onKeyDown?: (e: KeyboardEvent) => void
  rows?: number
  prefix?: any
  suffix?: any
  id?: string
  label?: string
  error?: string
  required?: boolean
}

export default function MagicTextField(props: MagicTextFieldProps) {
  const {
    ariaLabel,
    value,
    autoFocus,
    rows = 1,
    prefix,
    suffix,
    placeholder,
    disabled,
    id,
    label,
    error,
    required,
    onChange,
    onKeyDown,
  } = props
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Adjust height whenever value changes
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto'
    if (value) {
      // Set the height to match the content
      textarea.style.height = `${textarea.scrollHeight}px`
    }
  }, [value])

  const handleChange = useCallback(
    (e: JSX.TargetedEvent<HTMLTextAreaElement, Event>) => {
      onChange(e.currentTarget.value)
    },
    [onChange]
  )

  return (
    <div className={'MagicTextField'} role="textbox" aria-multiline="true" aria-invalid={!!error}>
      {label && (
        <label htmlFor={id} className={'MagicTextField__Label'}>
          {label}
          {required && <span aria-hidden="true"> *</span>}
        </label>
      )}
      {prefix && (
        <div className={'MagicTextField__Footer'} aria-hidden="true">
          {prefix}
        </div>
      )}
      <textarea
        ref={textareaRef}
        id={id}
        aria-label={!label ? ariaLabel : undefined}
        aria-required={required}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={'MagicTextField__InputContainer'}
        value={value}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        onChange={handleChange}
        onKeyDown={onKeyDown as any}
      />
      {suffix && (
        <div className={'MagicTextField__Footer'} aria-hidden="true">
          {suffix}
        </div>
      )}
      {error && (
        <div id={`${id}-error`} className={'MagicTextField__Error'} role="alert">
          {error}
        </div>
      )}
    </div>
  )
}
