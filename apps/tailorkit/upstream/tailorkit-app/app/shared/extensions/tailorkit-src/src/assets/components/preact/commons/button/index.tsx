/** @jsxImportSource preact */
import type { ComponentChildren, Ref } from 'preact'
import { useMemo } from 'preact/hooks'

export type ButtonVariant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'plain'
  | 'monochromePlain'

export type ButtonSize = 'slim' | 'medium' | 'large'

export interface ButtonProps {
  /** Standard element id */
  id?: string
  /** The variant determines color treatment */
  variant?: ButtonVariant
  /** Size affects padding / height */
  size?: ButtonSize
  /** Tone is used for contextual colouring (success, critical) */
  tone?: 'default' | 'success' | 'critical' | 'magic' | 'super-magic' | 'success'
  /** Additional custom classes */
  className?: string
  /** When true the button takes full width of the container */
  fullWidth?: boolean
  /** Render in a disabled state */
  disabled?: boolean
  /** Show loading spinner */
  loading?: boolean
  /** Set pressed state for toggle buttons */
  pressed?: boolean
  /** Submit type button */
  submit?: boolean
  /** Add an icon before the label. Accepts an SVG string or JSX */
  icon?: string | ComponentChildren
  /** Icon only button – no children label */
  iconOnly?: boolean
  /** Shows a small chevron as disclosure */
  disclosure?: boolean
  /** If supplied, renders an anchor element instead of button */
  url?: string
  /** Anchor target attribute */
  target?: string
  /** Download attribute for anchor */
  download?: string
  /** Click handler */
  onClick?: any
  /** Button label */
  children?: ComponentChildren
  /** Forward ref to the underlying element */
  ref?: Ref<HTMLElement>
}

/**
 * TailorKit Button
 * Converted from the original imperative implementation to a Preact
 * functional component. All visual styling remains the same by importing
 * the existing stylesheet.
 */
export const Button = (props: ButtonProps) => {
  const {
    ref,
    id,
    variant = 'default',
    size = 'medium',
    className = '',
    tone = 'default',
    fullWidth = false,
    disabled = false,
    loading = false,
    pressed = false,
    submit = false,
    icon,
    iconOnly = false,
    disclosure = false,
    url,
    target,
    download,
    onClick,
    children,
    ...rest
  } = props

  const Element = url ? 'a' : 'button'

  const computedClassName = useMemo(() => {
    const classes: string[] = ['emtlkit-button']

    // variant
    switch (variant) {
      case 'primary':
        classes.push('emtlkit-button--primary')
        break
      case 'secondary':
        classes.push('emtlkit-button--secondary')
        break
      case 'destructive':
        classes.push('emtlkit-button--destructive')
        break
      case 'outline':
        classes.push('emtlkit-button--outline')
        break
      case 'plain':
        classes.push('emtlkit-button--plain')
        break
      case 'monochromePlain':
        classes.push('emtlkit-button--monochromePlain')
        break
      default:
        // default variant adds no modifier class
        break
    }

    // tone
    if (tone === 'magic') {
      classes.push('emtlkit-button--magic-tone')
    }

    if (tone === 'success') {
      classes.push('emtlkit-button--success-tone')
    }

    if (tone === 'super-magic') {
      classes.push('emtlkit-button--super-magic-tone')
    }

    // size
    if (size === 'slim') classes.push('emtlkit-button--slim')
    if (size === 'large') classes.push('emtlkit-button--large')

    // state
    if (fullWidth) classes.push('emtlkit-button--fullWidth')
    if (loading) classes.push('emtlkit-button--loading')
    if (pressed) classes.push('emtlkit-button--pressed')
    if (iconOnly) classes.push('emtlkit-button--iconOnly')

    if (className) classes.push(className)

    return classes.join(' ')
  }, [className, fullWidth, iconOnly, loading, pressed, size, variant, tone])

  // prepare icon node if provided as string
  const renderIcon = (ic: ButtonProps['icon']) => {
    if (!ic) return null
    if (typeof ic === 'string') {
      // svg string
      // eslint-disable-next-line react/no-danger
      return <span className="emtlkit-button__icon" dangerouslySetInnerHTML={{ __html: ic }} />
    }
    return <span className="emtlkit-button__icon">{ic as any}</span>
  }

  const spinner = loading ? <span className="emtlkit-button__spinner" /> : null
  const iconNode = iconOnly ? renderIcon(icon) : null // if iconOnly label suppressed
  const textNode = iconOnly ? null : (children as any)
  const iconBeforeLabel = !iconOnly && icon ? renderIcon(icon) : null
  const disclosureNode = disclosure ? (
    <span
      className="emtlkit-button__icon"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html:
          // eslint-disable-next-line max-len
          '<svg viewBox="0 0 20 20"><path d="M7 7l3 3 3-3" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      }}
    />
  ) : null

  const commonProps: any = useMemo(
    () => ({
      id,
      className: computedClassName,
      onClick,
      ...rest,
    }),
    [id, computedClassName, onClick, rest]
  )

  return (
    <Element
      {...commonProps}
      ref={ref}
      {...(Element === 'button'
        ? {
            type: submit ? 'submit' : 'button',
            disabled: disabled || loading,
            'aria-pressed': pressed || undefined,
          }
        : {
            href: url,
            target,
            download,
            rel: target === '_blank' ? 'noopener noreferrer' : undefined,
          })}
    >
      {spinner}
      {iconNode || iconBeforeLabel}
      {textNode}
      {disclosureNode}
    </Element>
  ) as any
}

export default Button
