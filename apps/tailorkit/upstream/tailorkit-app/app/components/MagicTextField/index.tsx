import { useEffect, useRef } from 'react'
import styles from './style.module.css'

interface MagicTextFieldProps {
  ariaLabel?: string
  placeholder?: string
  disabled?: boolean
  autoFocus?: boolean
  value: string
  onChange: (value: string) => void
  rows?: number
  prefix?: React.ReactNode
  suffix?: React.ReactNode
  headerContent?: React.ReactNode
  fixedHeight?: number
  id?: string
  label?: string
  error?: string
  required?: boolean
  actionsField?: React.ReactNode
}

export default function MagicTextField(props: MagicTextFieldProps) {
  const {
    ariaLabel,
    value,
    autoFocus,
    rows = 1,
    prefix,
    suffix,
    headerContent,
    fixedHeight,
    placeholder,
    disabled,
    id,
    label,
    error,
    required,
    onChange,
    actionsField,
  } = props
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Adjust height whenever value changes while preserving cursor position
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    if (fixedHeight) {
      textarea.style.height = `${fixedHeight}px`
      textarea.style.maxHeight = `${fixedHeight}px`
      return
    }

    // Save cursor position before height adjustment
    const cursorStart = textarea.selectionStart
    const cursorEnd = textarea.selectionEnd

    // Reset height to auto to measure scrollHeight, then clamp between 90 and 120
    textarea.style.height = 'auto'
    const MIN_HEIGHT = 90
    const MAX_HEIGHT = 120
    const measured = textarea.scrollHeight
    const clamped = Math.max(MIN_HEIGHT, Math.min(measured, MAX_HEIGHT))
    textarea.style.maxHeight = `${MAX_HEIGHT}px`
    textarea.style.height = `${clamped}px`

    // Restore cursor position after height adjustment
    if (cursorStart !== null && cursorEnd !== null) {
      textarea.setSelectionRange(cursorStart, cursorEnd)
    }
  }, [value, fixedHeight])

  return (
    <div
      className={`${styles.MagicTextField} ${styles.MagicBorder}`}
      role="textbox"
      aria-multiline="true"
      aria-invalid={!!error}
    >
      {label && (
        <label htmlFor={id} className={styles.MagicTextField__Label}>
          {label}
          {required && <span aria-hidden="true"> *</span>}
        </label>
      )}
      {prefix && (
        <div className={styles.MagicTextField__Footer} aria-hidden="true">
          {prefix}
        </div>
      )}
      <div style={{ width: '100%' }}>
        {headerContent && (
          <div className={styles.MagicTextField__Header} aria-hidden="true">
            {headerContent}
          </div>
        )}
        <textarea
          ref={textareaRef}
          id={id}
          aria-label={!label ? ariaLabel : undefined}
          aria-required={required}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={styles.MagicTextField__InputContainer}
          style={{ fontSize: 16 }}
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
        />

        {actionsField && (
          <div className={styles.MagicTextField__Actions} aria-hidden="true">
            {actionsField}
          </div>
        )}
      </div>
      {suffix && (
        <div className={styles.MagicTextField__Footer} aria-hidden="true">
          {suffix}
        </div>
      )}
      {error && (
        <div id={`${id}-error`} className={styles.MagicTextField__Error} role="alert">
          {error}
        </div>
      )}
    </div>
  )
}
