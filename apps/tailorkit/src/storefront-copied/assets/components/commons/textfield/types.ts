type Type =
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
type Alignment = 'left' | 'center' | 'right'
type InputMode = 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url'

/**
 * Options for creating a TextField component
 */
interface TextFieldOptions {
  /** Unique identifier for the field */
  id?: string
  /** Label text for the field */
  label?: string | HTMLElement
  /** Placeholder text */
  placeholder?: string
  /** Initial value */
  value?: string
  /** Input type */
  type?: Type
  /** Whether the field is disabled */
  disabled?: boolean
  /** Whether the field is read-only */
  readOnly?: boolean
  /** Whether the field is required */
  required?: boolean
  /** Error message */
  error?: string | null
  /** Help text displayed below the field */
  helpText?: string
  /** Text or element displayed before the input */
  prefix?: string | null
  /** Text or element displayed after the input */
  suffix?: string | null
  /** Whether to use a textarea instead of input */
  multiline?: boolean | number
  /** Number of rows for textarea */
  rows?: number
  /** Autocomplete attribute */
  autoComplete?: string
  /** Maximum character length */
  maxLength?: number | null
  /** Whether to show character count */
  showCharacterCount?: boolean
  /** Whether to show a clear button */
  clearable?: boolean
  /** Size of the input */
  size?: 'slim' | 'medium' | 'large'
  /** Loading state */
  loading?: boolean
  /** Whether to use monospaced font */
  monospaced?: boolean
  /** Whether the field should auto-size based on content */
  autoSize?: boolean
  /** Whether there's an element connected to the left */
  connectedLeft?: boolean
  /** Whether there's an element connected to the right */
  connectedRight?: boolean
  /** Whether the field should be focused on mount */
  focused?: boolean
  /** Text alignment */
  align?: Alignment
  /** Input mode for mobile keyboards */
  inputMode?: InputMode
  /** Visual styling variant */
  variant?: 'inherit' | 'borderless'
  /** Callback when value changes */
  onChange?: (value: string) => void
  /** Callback when field loses focus */
  onBlur?: (event: Event) => void
  /** Callback when field gains focus */
  onFocus?: (event: Event) => void
  /** Callback on input event */
  onInput?: (event: Event, value: string) => void
  /** Allow for additional properties */
  [key: string]: any
}

export type { TextFieldOptions }
