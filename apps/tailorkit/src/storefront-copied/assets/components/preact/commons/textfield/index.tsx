/** @jsxImportSource preact */
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import type { JSX } from 'preact/jsx-runtime'

// Re-use existing CSS classes defined for vanilla implementation (import handled in root)

export type TextFieldAlignment = 'left' | 'center' | 'right'
export type TextFieldSize = 'slim' | 'medium' | 'large'
export type TextFieldVariant = 'inherit' | 'borderless'
export type TextFieldType =
  | 'text'
  | 'email'
  | 'number'
  | 'integer'
  | 'password'
  | 'search'
  | 'tel'
  | 'url'
  | 'date'
  | 'datetime-local'
  | 'month'
  | 'time'
  | 'week'
  | 'currency'

export interface TextFieldProps {
  id?: string
  label?: ComponentChildren
  placeholder?: string
  value?: string
  defaultValue?: string
  type?: TextFieldType
  disabled?: boolean
  readOnly?: boolean
  required?: boolean
  error?: string | null
  helpText?: string
  prefix?: ComponentChildren
  suffix?: ComponentChildren
  multiline?: boolean | number
  rows?: number
  autoComplete?: string
  maxLength?: number | null
  showCharacterCount?: boolean
  clearable?: boolean
  size?: TextFieldSize
  loading?: boolean
  monospaced?: boolean
  autoSize?: boolean
  connectedLeft?: boolean
  connectedRight?: boolean
  focused?: boolean
  align?: TextFieldAlignment
  inputMode?: string
  variant?: TextFieldVariant
  onChange?: (value: string) => void
  onBlur?: (e: FocusEvent) => void
  onFocus?: (e: FocusEvent) => void
  onInput?: (e: Event, value: string) => void
}

export function TextField(props: TextFieldProps) {
  const {
    id = `textfield-${Math.random().toString(36).slice(2, 9)}`,
    label,
    placeholder = '',
    value,
    defaultValue = '',
    type = 'text',
    disabled = false,
    readOnly = false,
    required = false,
    error = null,
    helpText = '',
    prefix = null,
    suffix = null,
    multiline = false,
    rows = 3,
    autoComplete = 'off',
    maxLength = null,
    showCharacterCount = false,
    clearable = false,
    size = 'medium',
    loading = false,
    monospaced = false,
    autoSize = false,
    focused = false,
    align = 'left',
    inputMode,
    variant = 'inherit',
    onChange,
    onBlur,
    onFocus,
    onInput,
    ...rest
  } = props

  // internal state if uncontrolled
  const isControlled = value !== undefined
  const [internalVal, setInternalVal] = useState<string>(value ?? defaultValue)

  const innerRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  // Track if the last change was from user input to avoid cursor reset
  const isUserInputRef = useRef(false)

  useEffect(() => {
    // Only sync external value changes (not from user input)
    if (isControlled && value !== internalVal && !isUserInputRef.current) {
      setInternalVal(value as string)
    }
    // Reset the flag after each render
    isUserInputRef.current = false
  }, [value, isControlled, internalVal])

  // autoSize textarea
  const resizeTextarea = useCallback(() => {
    if (!autoSize || !multiline || !innerRef.current) return
    const txt = innerRef.current as HTMLTextAreaElement
    txt.style.height = 'auto'
    txt.style.height = `${txt.scrollHeight}px`
  }, [autoSize, multiline])

  useEffect(() => {
    if (multiline && autoSize) resizeTextarea()
  }, [autoSize, internalVal, multiline, resizeTextarea])

  // focus on mount if requested
  useEffect(() => {
    if (focused && innerRef.current) {
      setTimeout(() => innerRef.current!.focus(), 50)
    }
  }, [focused])

  const handleInput: JSX.GenericEventHandler<HTMLInputElement | HTMLTextAreaElement> = e => {
    const val = (e.target as HTMLInputElement | HTMLTextAreaElement).value
    // Mark this as user input to prevent cursor reset in useEffect
    isUserInputRef.current = true
    // Always update internal state to keep cursor position stable
    setInternalVal(val)
    if (onInput) onInput(e as Event, val)
    if (onChange) onChange(val)
  }

  const handleClear = () => {
    if (disabled || readOnly) return
    isUserInputRef.current = true
    setInternalVal('')
    if (onChange) onChange('')
    if (innerRef?.current) innerRef.current.focus()
  }

  const currentLength = internalVal.length

  // --- class helpers
  const wrapperClasses = [
    'emtlkit-textfield',
    readOnly && 'emtlkit-textfield--readonly',
    loading && 'emtlkit-textfield--loading',
    variant === 'borderless' && 'emtlkit-textfield--borderless',
  ]
    .filter(Boolean)
    .join(' ')

  const labelClasses = [
    'emtlkit-textfield__label',
    required && 'emtlkit-textfield__label--required',
    disabled && 'emtlkit-textfield__label--disabled',
  ]
    .filter(Boolean)
    .join(' ')

  const inputClasses = [
    'emtlkit-textfield__input',
    error && 'emtlkit-textfield__input--error',
    multiline && 'emtlkit-textfield__input--multiline',
    (showCharacterCount || maxLength) && 'emtlkit-textfield__input--with-counter',
    size === 'large' && 'emtlkit-textfield__input--large',
    size === 'slim' && 'emtlkit-textfield__input--slim',
    prefix && 'emtlkit-textfield__input--with-prefix',
    suffix && 'emtlkit-textfield__input--with-suffix',
  ]
    .filter(Boolean)
    .join(' ')

  const charCountClasses = [
    'emtlkit-textfield__character-count',
    maxLength && currentLength > (maxLength ?? 0) && 'emtlkit-textfield__character-count--error',
  ]
    .filter(Boolean)
    .join(' ')

  const renderInput = () => {
    const baseStyle: Record<string, string> = { textAlign: align }
    if (monospaced) baseStyle.fontFamily = 'monospace'

    const common = {
      id,
      ref: innerRef,
      className: inputClasses,
      placeholder,
      disabled,
      readOnly,
      required,
      value: internalVal,
      onInput: handleInput,
      onBlur,
      onFocus,
      style: baseStyle,
      autoComplete,
      inputMode,
      ...(maxLength && maxLength > 0 ? { maxLength } : {}),
      ...rest,
    }

    if (multiline) {
      const rowsCount = typeof multiline === 'number' ? multiline : rows
      return <textarea {...common} rows={rowsCount} />
    }
    return <input {...common} type={type} />
  }

  return (
    <div className={wrapperClasses} {...(disabled ? { 'aria-disabled': true } : {})}>
      {label ? (
        <label className={labelClasses} htmlFor={id as string}>
          {label}
        </label>
      ) : null}
      <div className="emtlkit-textfield__input-wrapper">
        {prefix ? <div className="emtlkit-textfield__prefix">{prefix}</div> : null}
        {renderInput()}
        {showCharacterCount || maxLength ? (
          <div className={charCountClasses}>
            {maxLength ? `${currentLength}/${maxLength}` : `${currentLength} characters`}
          </div>
        ) : null}
        {clearable ? (
          <button
            type="button"
            // eslint-disable-next-line max-len
            className={`emtlkit-textfield__clear-button${currentLength > 0 && !disabled && !readOnly ? ' emtlkit-textfield__clear-button--visible' : ''}`}
            aria-label="Clear"
            onClick={handleClear}
          >
            ✕
          </button>
        ) : null}
        {suffix ? <div className="emtlkit-textfield__suffix">{suffix}</div> : null}
      </div>
      {error ? <div className="emtlkit-textfield__error">{error}</div> : null}
      {helpText && !error ? <div className="emtlkit-textfield__help-text">{helpText}</div> : null}
    </div>
  )
}

export default TextField
