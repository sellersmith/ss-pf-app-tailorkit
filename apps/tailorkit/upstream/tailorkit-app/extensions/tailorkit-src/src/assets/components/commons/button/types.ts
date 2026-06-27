export type ButtonVariant = 'default' | 'primary' | 'destructive' | 'outline' | 'plain' | 'monochromePlain'
export type ButtonSize = 'slim' | 'medium' | 'large'
export type ButtonTone = 'default' | 'success' | 'critical'

export interface ButtonOptions {
  variant?: ButtonVariant
  className?: string
  attributes?: Record<string, string>
  size?: ButtonSize
  tone?: ButtonTone
  fullWidth?: boolean
  disabled?: boolean
  loading?: boolean
  pressed?: boolean
  submit?: boolean
  destructive?: boolean
  outline?: boolean
  plain?: boolean
  monochromePlain?: boolean
  primary?: boolean
  icon?: string | null
  iconOnly?: boolean
  disclosure?: boolean
  external?: boolean
  url?: string | null
  target?: string | null
  download?: string | null
  id?: string | null
  name?: string | null
  value?: string | null
  styles?: Record<string, string> | null
  onBlur?: ((event: FocusEvent) => void) | null
  onClick?: ((event: MouseEvent) => void) | null
  onFocus?: ((event: FocusEvent) => void) | null
  onKeyDown?: ((event: KeyboardEvent) => void) | null
  onKeyPress?: ((event: KeyboardEvent) => void) | null
  onKeyUp?: ((event: KeyboardEvent) => void) | null
  onMouseEnter?: ((event: MouseEvent) => void) | null
  onMouseLeave?: ((event: MouseEvent) => void) | null
  onTouchStart?: ((event: TouchEvent) => void) | null
  children?: string
}
