import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'

/**
 * Responsive breakpoint values for Flex component
 */
export type ResponsiveValue<T> =
  | T
  | {
      xs?: T
      sm?: T
      md?: T
      lg?: T
      xl?: T
    }

/**
 * Flex direction values
 */
export type FlexDirection = 'row' | 'row-reverse' | 'column' | 'column-reverse'

/**
 * Flex justify content values
 */
export type FlexJustify =
  | 'flex-start'
  | 'flex-end'
  | 'center'
  | 'space-between'
  | 'space-around'
  | 'space-evenly'
  | 'start'
  | 'end'

/**
 * Flex align items values
 */
export type FlexAlign = 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline' | 'start' | 'end'

/**
 * Flex wrap values
 */
export type FlexWrap = 'nowrap' | 'wrap' | 'wrap-reverse'

/**
 * Spacing values using Polaris spacing scale
 */
export type SpacingValue =
  | '025'
  | '050'
  | '100'
  | '150'
  | '200'
  | '250'
  | '300'
  | '400'
  | '500'
  | '600'
  | '800'
  | '1000'
  | '1200'
  | '1600'
  | '2000'
  | '2400'
  | '2800'
  | '3200'
  | number
  | string

/**
 * Comprehensive Flex component props interface
 */
export interface FlexProps extends Omit<HTMLAttributes<HTMLDivElement>, 'dir'> {
  /** React children */
  children?: ReactNode

  /** Flex direction - controls the main axis */
  direction?: ResponsiveValue<FlexDirection>

  /** Justify content - alignment along the main axis */
  justify?: ResponsiveValue<FlexJustify>

  /** Align items - alignment along the cross axis */
  align?: ResponsiveValue<FlexAlign>

  /** Flex wrap behavior */
  wrap?: ResponsiveValue<FlexWrap>

  /** Gap between flex items */
  gap?: ResponsiveValue<SpacingValue>

  /** Row gap (when direction is column) */
  rowGap?: ResponsiveValue<SpacingValue>

  /** Column gap (when direction is row) */
  columnGap?: ResponsiveValue<SpacingValue>

  /** Flex grow value */
  grow?: ResponsiveValue<number>

  /** Flex shrink value */
  shrink?: ResponsiveValue<number>

  /** Flex basis value */
  basis?: ResponsiveValue<string | number>

  /** Width */
  width?: ResponsiveValue<string | number>

  /** Height */
  height?: ResponsiveValue<string | number>

  /** Minimum width */
  minWidth?: ResponsiveValue<string | number>

  /** Minimum height */
  minHeight?: ResponsiveValue<string | number>

  /** Maximum width */
  maxWidth?: ResponsiveValue<string | number>

  /** Maximum height */
  maxHeight?: ResponsiveValue<string | number>

  /** Padding */
  padding?: ResponsiveValue<SpacingValue>

  /** Padding top */
  paddingTop?: ResponsiveValue<SpacingValue>

  /** Padding right */
  paddingRight?: ResponsiveValue<SpacingValue>

  /** Padding bottom */
  paddingBottom?: ResponsiveValue<SpacingValue>

  /** Padding left */
  paddingLeft?: ResponsiveValue<SpacingValue>

  /** Padding horizontal (left and right) */
  paddingX?: ResponsiveValue<SpacingValue>

  /** Padding vertical (top and bottom) */
  paddingY?: ResponsiveValue<SpacingValue>

  /** Margin */
  margin?: ResponsiveValue<SpacingValue>

  /** Margin top */
  marginTop?: ResponsiveValue<SpacingValue>

  /** Margin right */
  marginRight?: ResponsiveValue<SpacingValue>

  /** Margin bottom */
  marginBottom?: ResponsiveValue<SpacingValue>

  /** Margin left */
  marginLeft?: ResponsiveValue<SpacingValue>

  /** Margin horizontal (left and right) */
  marginX?: ResponsiveValue<SpacingValue>

  /** Margin vertical (top and bottom) */
  marginY?: ResponsiveValue<SpacingValue>

  /** Additional CSS styles */
  style?: CSSProperties

  /** CSS class name */
  className?: string

  /** Whether to render as inline-flex */
  inline?: boolean

  /** Custom tag to render as */
  as?: keyof JSX.IntrinsicElements
}

/**
 * Convert spacing value to CSS value
 */
function getSpacingValue(value: SpacingValue): string {
  if (typeof value === 'number') {
    return `${value}px`
  }

  if (typeof value === 'string') {
    // If it's a Polaris spacing token, convert to CSS custom property
    if (/^\d{3,4}$/.test(value)) {
      return `var(--p-space-${value})`
    }
    return value
  }

  return '0'
}

/**
 * Convert responsive value to CSS styles
 */
function getResponsiveStyles<T>(
  value: ResponsiveValue<T> | undefined,
  property: string,
  transformer?: (val: T) => string
): CSSProperties {
  if (value === undefined) return {}

  // If it's not an object, it's a single value
  if (typeof value !== 'object' || value === null) {
    const transformedValue = transformer ? transformer(value as T) : String(value)
    return { [property]: transformedValue }
  }

  const styles: CSSProperties = {}
  const responsiveValue = value as { xs?: T; sm?: T; md?: T; lg?: T; xl?: T }

  // Handle base value (xs or default)
  const baseValue = responsiveValue.xs ?? Object.values(responsiveValue)[0]
  if (baseValue !== undefined) {
    const transformedValue = transformer ? transformer(baseValue) : String(baseValue)
    styles[property as keyof CSSProperties] = transformedValue as never
  }

  return styles
}

/**
 * Build flex styles from props
 */
function buildFlexStyles(props: FlexProps): CSSProperties {
  const {
    direction,
    justify,
    align,
    wrap,
    gap,
    rowGap,
    columnGap,
    grow,
    shrink,
    basis,
    width,
    height,
    minWidth,
    minHeight,
    maxWidth,
    maxHeight,
    padding,
    paddingTop,
    paddingRight,
    paddingBottom,
    paddingLeft,
    paddingX,
    paddingY,
    margin,
    marginTop,
    marginRight,
    marginBottom,
    marginLeft,
    marginX,
    marginY,
    inline,
    style,
  } = props

  const styles: CSSProperties = {
    display: inline ? 'inline-flex' : 'flex',
  }

  // Flex properties
  if (direction !== undefined) Object.assign(styles, getResponsiveStyles(direction, 'flexDirection'))
  if (justify !== undefined) Object.assign(styles, getResponsiveStyles(justify, 'justifyContent'))
  if (align !== undefined) Object.assign(styles, getResponsiveStyles(align, 'alignItems'))
  if (wrap !== undefined) Object.assign(styles, getResponsiveStyles(wrap, 'flexWrap'))
  if (grow !== undefined) Object.assign(styles, getResponsiveStyles(grow, 'flexGrow'))
  if (shrink !== undefined) Object.assign(styles, getResponsiveStyles(shrink, 'flexShrink'))
  if (basis !== undefined) Object.assign(styles, getResponsiveStyles(basis, 'flexBasis'))

  // Gap properties
  if (gap !== undefined) Object.assign(styles, getResponsiveStyles(gap, 'gap', getSpacingValue))
  if (rowGap !== undefined) Object.assign(styles, getResponsiveStyles(rowGap, 'rowGap', getSpacingValue))
  if (columnGap !== undefined) Object.assign(styles, getResponsiveStyles(columnGap, 'columnGap', getSpacingValue))

  // Dimension properties
  if (width !== undefined) Object.assign(styles, getResponsiveStyles(width, 'width'))
  if (height !== undefined) Object.assign(styles, getResponsiveStyles(height, 'height'))
  if (minWidth !== undefined) Object.assign(styles, getResponsiveStyles(minWidth, 'minWidth'))
  if (minHeight !== undefined) Object.assign(styles, getResponsiveStyles(minHeight, 'minHeight'))
  if (maxWidth !== undefined) Object.assign(styles, getResponsiveStyles(maxWidth, 'maxWidth'))
  if (maxHeight !== undefined) Object.assign(styles, getResponsiveStyles(maxHeight, 'maxHeight'))

  // Padding properties
  if (padding !== undefined) Object.assign(styles, getResponsiveStyles(padding, 'padding', getSpacingValue))
  if (paddingTop !== undefined) Object.assign(styles, getResponsiveStyles(paddingTop, 'paddingTop', getSpacingValue))
  if (paddingRight !== undefined) {
    Object.assign(styles, getResponsiveStyles(paddingRight, 'paddingRight', getSpacingValue))
  }
  if (paddingBottom !== undefined) {
    Object.assign(styles, getResponsiveStyles(paddingBottom, 'paddingBottom', getSpacingValue))
  }
  if (paddingLeft !== undefined) Object.assign(styles, getResponsiveStyles(paddingLeft, 'paddingLeft', getSpacingValue))

  // Handle paddingX and paddingY
  if (paddingX !== undefined) {
    Object.assign(styles, getResponsiveStyles(paddingX, 'paddingLeft', getSpacingValue))
    Object.assign(styles, getResponsiveStyles(paddingX, 'paddingRight', getSpacingValue))
  }
  if (paddingY !== undefined) {
    Object.assign(styles, getResponsiveStyles(paddingY, 'paddingTop', getSpacingValue))
    Object.assign(styles, getResponsiveStyles(paddingY, 'paddingBottom', getSpacingValue))
  }

  // Margin properties
  if (margin !== undefined) Object.assign(styles, getResponsiveStyles(margin, 'margin', getSpacingValue))
  if (marginTop !== undefined) Object.assign(styles, getResponsiveStyles(marginTop, 'marginTop', getSpacingValue))
  if (marginRight !== undefined) Object.assign(styles, getResponsiveStyles(marginRight, 'marginRight', getSpacingValue))
  if (marginBottom !== undefined) {
    Object.assign(styles, getResponsiveStyles(marginBottom, 'marginBottom', getSpacingValue))
  }
  if (marginLeft !== undefined) Object.assign(styles, getResponsiveStyles(marginLeft, 'marginLeft', getSpacingValue))

  // Handle marginX and marginY
  if (marginX !== undefined) {
    Object.assign(styles, getResponsiveStyles(marginX, 'marginLeft', getSpacingValue))
    Object.assign(styles, getResponsiveStyles(marginX, 'marginRight', getSpacingValue))
  }
  if (marginY !== undefined) {
    Object.assign(styles, getResponsiveStyles(marginY, 'marginTop', getSpacingValue))
    Object.assign(styles, getResponsiveStyles(marginY, 'marginBottom', getSpacingValue))
  }

  // Apply custom styles last to allow override
  if (style) {
    Object.assign(styles, style)
  }

  return styles
}

/**
 * Comprehensive Flex component that provides all flexbox capabilities
 *
 * @example
 * ```tsx
 * // Basic row layout
 * <Flex direction="row" justify="space-between" align="center" gap="200">
 *   <div>Item 1</div>
 *   <div>Item 2</div>
 * </Flex>
 *
 * // Column layout with responsive behavior
 * <Flex
 *   direction={{ xs: 'column', md: 'row' }}
 *   gap="400"
 *   padding="500"
 * >
 *   <div>Item 1</div>
 *   <div>Item 2</div>
 * </Flex>
 *
 * // Flex item with grow
 * <Flex grow={1} basis="0">
 *   Flexible content
 * </Flex>
 * ```
 */
export function Flex(props: FlexProps) {
  const {
    children,
    className,
    as = 'div',
    // Extract all flex-related props to avoid passing them to the DOM
    direction,
    justify,
    align,
    wrap,
    gap,
    rowGap,
    columnGap,
    grow,
    shrink,
    basis,
    width,
    height,
    minWidth,
    minHeight,
    maxWidth,
    maxHeight,
    padding,
    paddingTop,
    paddingRight,
    paddingBottom,
    paddingLeft,
    paddingX,
    paddingY,
    margin,
    marginTop,
    marginRight,
    marginBottom,
    marginLeft,
    marginX,
    marginY,
    inline,
    style,
    ...restProps
  } = props

  const flexStyles = buildFlexStyles(props)
  const Element = as as any

  return (
    <Element className={className} style={flexStyles} {...restProps}>
      {children}
    </Element>
  )
}

// Convenience components for common patterns
export const FlexRow = (props: Omit<FlexProps, 'direction'>) => <Flex direction="row" {...props} />

export const FlexColumn = (props: Omit<FlexProps, 'direction'>) => <Flex direction="column" {...props} />

export const FlexCenter = (props: Omit<FlexProps, 'justify' | 'align'>) => (
  <Flex justify="center" align="center" {...props} />
)

export const FlexBetween = (props: Omit<FlexProps, 'justify'>) => <Flex justify="space-between" {...props} />

export const FlexAround = (props: Omit<FlexProps, 'justify'>) => <Flex justify="space-around" {...props} />

export const FlexEvenly = (props: Omit<FlexProps, 'justify'>) => <Flex justify="space-evenly" {...props} />
