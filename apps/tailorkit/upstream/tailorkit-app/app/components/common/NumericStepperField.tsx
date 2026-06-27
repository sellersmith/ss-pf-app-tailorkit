import { Button, TextField } from '@shopify/polaris'
import { MinusIcon, PlusIcon } from '@shopify/polaris-icons'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'

export interface NumericStepperFieldProps {
  /** Field label */
  label: string
  /** Current value */
  value: number
  /** Callback when value changes (only called on blur, Enter, or increment/decrement) */
  onChange: (value: number) => void
  /** Minimum value */
  min: number
  /** Maximum value */
  max: number
  /** Step increment/decrement amount */
  step?: number
  /** Optional prefix to display (e.g., "X", "Y") */
  prefix?: string
  /** Optional suffix to display (e.g., "px", "%") */
  suffix?: string
  /** Hide the label visually */
  labelHidden?: boolean
  /** Align text in input */
  align?: 'left' | 'center' | 'right'
  /** Minimum width for the field */
  minWidth?: string
  /** Hide the numeric stepper */
  hideNumericStepper?: boolean
}

/**
 * A numeric input field with increment/decrement buttons that only updates on blur or Enter.
 * This prevents layout-breaking real-time updates while typing large values.
 *
 * Based on the FontSize component pattern for optimal UX.
 */
export function NumericStepperField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  prefix,
  suffix,
  labelHidden = false,
  align = 'center',
  minWidth = '84px',
  hideNumericStepper = false,
}: NumericStepperFieldProps) {
  // Defensive: Handle undefined/null value (can happen with nested elements)
  const safeValue = value ?? 0

  // Local input state as string to allow free typing (including empty)
  const [localValue, setLocalValue] = useState<string>(safeValue.toString())
  const refLocalValue = useRef<number>(safeValue)

  // Update local state when props change
  useEffect(() => {
    setLocalValue(safeValue.toString())
    refLocalValue.current = safeValue
  }, [safeValue])

  // Cleanup on unmount: commit any pending changes
  useEffect(() => {
    return () => {
      const trimmed = refLocalValue.current
      const clamped = Math.max(min, Math.min(max, trimmed))

      if (clamped !== safeValue) {
        onChange(clamped)
      }
    }
  }, [min, max, onChange, safeValue])

  const onLocalInputChange = useCallback((newValue: string) => {
    setLocalValue(newValue)
    const parsed = Number(newValue)
    if (Number.isFinite(parsed)) {
      refLocalValue.current = parsed
    }
  }, [])

  const handleTextFieldChange = useCallback(
    (newValue: string) => {
      onLocalInputChange(newValue)
    },
    [onLocalInputChange]
  )

  const handleDecrement = useCallback(() => {
    const base = Number.isFinite(Number(localValue)) ? Number(localValue) : safeValue
    const next = Math.max(min, base - step)
    onLocalInputChange(next.toString())
    onChange(next)
  }, [localValue, onLocalInputChange, safeValue, min, step, onChange])

  const handleIncrement = useCallback(() => {
    const base = Number.isFinite(Number(localValue)) ? Number(localValue) : safeValue
    const next = Math.min(max, base + step)
    onLocalInputChange(next.toString())
    onChange(next)
  }, [localValue, onLocalInputChange, safeValue, max, step, onChange])

  // Commit on blur or Enter
  const commitValue = useCallback(() => {
    const trimmed = (localValue ?? '').toString().trim()
    if (trimmed === '') {
      // Reset to current value if empty
      setLocalValue(safeValue.toString())
      refLocalValue.current = safeValue
      return
    }

    const numeric = Number(trimmed)
    if (!Number.isFinite(numeric)) {
      // Reset to current value if invalid
      setLocalValue(safeValue.toString())
      refLocalValue.current = safeValue
      return
    }

    // Clamp to min/max
    const clamped = Math.max(min, Math.min(max, numeric))

    // Update UI with clamped value
    refLocalValue.current = clamped
    setLocalValue(clamped.toString())

    // Only call onChange if value actually changed
    if (clamped !== safeValue) {
      onChange(clamped)
    }
  }, [localValue, safeValue, min, max, onChange])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        commitValue()
      }
    },
    [commitValue]
  )

  const handleBlur = useCallback(() => {
    commitValue()
  }, [commitValue])

  return (
    <div
      className={`tailorkit-input_field ${!suffix && !prefix ? 'custom-prefix-suffix' : ''}`}
      style={{ minWidth }}
      onKeyDown={handleKeyDown}
    >
      <TextField
        align={align}
        autoComplete="off"
        label={label}
        labelHidden={labelHidden}
        type="number"
        {...(hideNumericStepper
          ? { prefix: prefix || null, suffix: suffix || null }
          : {
              prefix: prefix || <Button size="micro" icon={MinusIcon} variant="tertiary" onClick={handleDecrement} />,
              suffix: suffix || <Button size="micro" icon={PlusIcon} variant="tertiary" onClick={handleIncrement} />,
            })}
        min={min}
        max={max}
        value={localValue}
        onChange={handleTextFieldChange}
        onBlur={handleBlur}
      />
    </div>
  )
}
