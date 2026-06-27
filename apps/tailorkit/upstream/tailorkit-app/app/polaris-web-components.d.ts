declare namespace JSX {
  interface IntrinsicElements {
    's-badge': BadgeProps
    's-banner': BannerProps
    's-box': BoxProps
    's-button': ButtonProps
    's-checkbox': CheckboxProps
    's-choice-list': ChoiceListProps
    's-clickable': ClickableProps
    's-date-picker': DatePickerProps
    's-divider': DividerProps
    's-email-field': EmailFieldProps
    's-grid': GridProps
    's-heading': HeadingProps
    's-icon': IconProps
    's-image': ImageProps
    's-link': LinkProps
    's-money-field': MoneyFieldProps
    's-number-field': NumberFieldProps
    's-ordered-list': OrderedListProps
    's-page': PageProps
    's-paragraph': ParagraphProps
    's-password-field': PasswordFieldProps
    's-search-field': SearchFieldProps
    's-section': SectionProps
    's-select': SelectProps
    's-spinner': SpinnerProps
    's-stack': StackProps
    's-switch': SwitchProps
    's-table': TableProps
    's-text': TextProps
    's-text-area': TextAreaProps
    's-text-field': TextFieldProps
    's-url-field': URLFieldProps
    's-unordered-list': UnorderedListProps
  }
}

// Common types
type Tone = 'critical' | 'success' | 'warning' | 'info' | 'caution' | 'subdued'
type ButtonTone = 'critical' | 'auto' | 'neutral'
type Color = 'strong' | 'subdued' | 'base'
type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
type Spacing = 'none' | 'tight' | 'base' | 'loose' | 'extra-loose'
type Alignment = 'start' | 'center' | 'end' | 'baseline' | 'stretch'
type Distribution = 'space-around' | 'space-between' | 'space-evenly' | 'fill' | 'fill-evenly'

type ContentPosition = 'center' | 'start' | 'end'
type OverflowPosition = `unsafe ${ContentPosition}` | `safe ${ContentPosition}`
type ContentDistributionKeyword = 'space-between' | 'space-around' | 'space-evenly' | 'stretch'
type JustifyContentKeyword = 'normal' | ContentDistributionKeyword | OverflowPosition | ContentPosition
type BaselinePosition = 'baseline' | 'first baseline' | 'last baseline'
type AlignItemsKeyword = 'normal' | 'stretch' | BaselinePosition | OverflowPosition | ContentPosition
type AlignContentKeyword = 'normal' | BaselinePosition | ContentDistributionKeyword | OverflowPosition | ContentPosition
type SizeKeyword =
  | 'small-500'
  | 'small-400'
  | 'small-300'
  | 'small-200'
  | 'small-100'
  | 'small'
  | 'base'
  | 'large'
  | 'large-100'
  | 'large-200'
  | 'large-300'
  | 'large-400'
  | 'large-500'
type SpacingKeyword = SizeKeyword | 'none'
type ColorKeyword = 'subdued' | 'base' | 'strong'
type BackgroundColorKeyword = 'transparent' | ColorKeyword
type SizeUnits = `${number}px` | `${number}%` | `0`
type SizeUnitsOrAuto = SizeUnits | 'auto'

interface BaseComponentProps {
  key?: string
  className?: string
  id?: string
  style?: React.CSSProperties
  children?: React.ReactNode
  accessibilityLabel?: string
  hasFocusableParent?: boolean
}

interface BadgeProps extends BaseComponentProps {
  tone?: Tone
  color?: Color
  progress?: 'incomplete' | 'partiallyComplete' | 'complete'
  size?: 'sm' | 'base' | 'lg'
  icon?: string
}

interface BannerProps extends BaseComponentProps {
  tone?: Tone
  title?: string
  action?: {
    content: string
    url?: string
    onAction?: () => void
  }
  secondaryAction?: {
    content: string
    url?: string
    onAction?: () => void
  }
  onDismiss?: () => void
  dismissible?: boolean
}

interface BoxProps extends BaseComponentProps {
  background?: BackgroundColorKeyword
  border?: string
  borderColor?: ColorKeyword
  borderRadius?: string
  borderWidth?: SizeUnitsOrAuto
  color?: string
  minHeight?: string
  minWidth?: string
  maxWidth?: string
  overflowX?: 'hidden' | 'scroll' | 'visible' | 'auto'
  overflowY?: 'hidden' | 'scroll' | 'visible' | 'auto'
  padding?: SizeKeyword
  paddingBlockStart?: Spacing
  paddingBlockEnd?: Spacing
  paddingInlineStart?: Spacing
  paddingInlineEnd?: Spacing
  position?: 'relative' | 'absolute' | 'fixed' | 'sticky'
  width?: string
  zIndex?: string
}

interface ButtonProps extends BaseComponentProps {
  variant?: 'primary' | 'secondary' | 'plain' | 'tertiary'
  tone?: ButtonTone
  size?: 'slim' | 'medium' | 'large'
  fullWidth?: boolean
  textAlign?: 'left' | 'center' | 'right'
  disabled?: boolean
  loading?: boolean
  pressed?: boolean
  accessibilityLabel?: string
  ariaControls?: string
  ariaExpanded?: boolean
  ariaDescribedBy?: string
  onClick?: (event: Event) => void
  onFocus?: (event: FocusEvent) => void
  onBlur?: (event: FocusEvent) => void
  onKeyDown?: (event: KeyboardEvent) => void
  onKeyPress?: (event: KeyboardEvent) => void
  onKeyUp?: (event: KeyboardEvent) => void
  onMouseEnter?: (event: MouseEvent) => void
  onTouchStart?: (event: TouchEvent) => void
  submit?: boolean
  type?: 'button' | 'submit' | 'reset'
  url?: string
  external?: boolean
  download?: boolean | string
  icon?: string
  iconAlign?: 'start' | 'end'
}

interface CheckboxProps extends BaseComponentProps {
  checked?: boolean
  disabled?: boolean
  error?: boolean | string
  helpText?: React.ReactNode
  id?: string
  label: React.ReactNode
  labelHidden?: boolean
  name?: string
  value?: string
  onChange?: (checked: boolean, id: string) => void
  onFocus?: (event: FocusEvent) => void
  onBlur?: (event: FocusEvent) => void
  ariaDescribedBy?: string
  ariaLabel?: string
  ariaLabelledBy?: string
}

interface ChoiceOption {
  label: React.ReactNode
  value: string
  helpText?: React.ReactNode
  disabled?: boolean
  renderChildren?: (isSelected: boolean) => React.ReactNode
}

interface ChoiceListProps extends BaseComponentProps {
  title?: React.ReactNode
  choices: ChoiceOption[]
  selected: string[]
  name?: string
  allowMultiple?: boolean
  titleHidden?: boolean
  error?: boolean | string
  disabled?: boolean
  onChange?: (selected: string[]) => void
}

interface ClickableProps extends BaseComponentProps {
  id?: string
  accessibilityLabel?: string
  role?: string
  onClick?: (event: Event) => void
  onFocus?: (event: FocusEvent) => void
  onBlur?: (event: FocusEvent) => void
  onKeyDown?: (event: KeyboardEvent) => void
  onKeyPress?: (event: KeyboardEvent) => void
  onKeyUp?: (event: KeyboardEvent) => void
  onMouseEnter?: (event: MouseEvent) => void
  onMouseLeave?: (event: MouseEvent) => void
  onTouchStart?: (event: TouchEvent) => void
  disabled?: boolean
}

interface DatePickerProps extends BaseComponentProps {
  month: number
  year: number
  onChange?: (date: { start: Date; end: Date }) => void
  onMonthChange?: (month: number, year: number) => void
  selected?: Date | { start: Date; end: Date }
  multiMonth?: boolean
  allowRange?: boolean
  disableDatesBefore?: Date
  disableDatesAfter?: Date
  dayAccessibilityLabelPrefix?: string
}

interface DividerProps extends BaseComponentProps {
  borderColor?: 'border' | 'border-inverse' | 'transparent'
  borderWidth?: '0165' | '025' | '050' | '100'
}

interface EmailFieldProps extends TextFieldProps {
  type?: 'email'
}

interface GridProps extends BaseComponentProps {
  columns?: { [key: string]: number | string }
  rows?: number | string
  gap?: Spacing | { row?: Spacing; column?: Spacing }
  areas?: { [key: string]: string[] }
}

interface HeadingProps extends BaseComponentProps {
  element?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p'
  variant?: 'headingXs' | 'headingSm' | 'headingMd' | 'headingLg' | 'headingXl' | 'heading2xl' | 'heading3xl'
  alignment?: 'start' | 'center' | 'end' | 'justify'
  fontWeight?: 'regular' | 'medium' | 'semibold' | 'bold'
  id?: string
  truncate?: boolean
}

interface IconProps extends BaseComponentProps {
  type: string
  color?: string
  tone?: Tone
  size?: Size
}

interface ImageProps extends BaseComponentProps {
  source: string
  alt: string
  crossOrigin?: 'anonymous' | 'use-credentials'
  role?: string
  loading?: 'lazy' | 'eager'
  width?: number | string
  height?: number | string
  onLoad?: () => void
  onError?: () => void
}

interface LinkProps extends BaseComponentProps {
  url?: string
  children?: React.ReactNode
  external?: boolean
  id?: string
  monochrome?: boolean
  removeUnderline?: boolean
  onClick?: (event: Event) => void
  accessibilityLabel?: string
  download?: boolean | string
}

interface MoneyFieldProps extends NumberFieldProps {
  currencyCode?: string
}

interface NumberFieldProps extends BaseComponentProps {
  label: React.ReactNode
  labelAction?: {
    content: string
    onAction?: () => void
  }
  labelHidden?: boolean
  id?: string
  name?: string
  value?: string | number
  disabled?: boolean
  readOnly?: boolean
  autoComplete?: boolean | string
  error?: boolean | string
  helpText?: React.ReactNode
  placeholder?: string
  prefix?: React.ReactNode
  suffix?: React.ReactNode
  verticalContent?: React.ReactNode
  clearButton?: boolean
  monospaced?: boolean
  align?: 'left' | 'center' | 'right'
  requiredIndicator?: boolean
  min?: number
  max?: number
  step?: number
  largeStep?: number
  autoSize?: boolean
  onChange?: (value: string, id: string) => void
  onClearButtonClick?: (id: string) => void
  onSpinnerChange?: (delta: number, id: string) => void
  onFocus?: (event: FocusEvent) => void
  onBlur?: (event: FocusEvent) => void
}

interface ListProps extends BaseComponentProps {
  type?: 'bullet' | 'number'
  gap?: 'extraTight' | 'loose'
}

interface OrderedListProps extends ListProps {
  start?: number
}

interface PageProps extends BaseComponentProps {
  title?: string
  subtitle?: string
  compactTitle?: boolean
  titleMetadata?: React.ReactNode
  additionalMetaData?: React.ReactNode
  titleHidden?: boolean
  primaryAction?: {
    content: string
    disabled?: boolean
    loading?: boolean
    url?: string
    onAction?: () => void
  }
  secondaryActions?: Array<{
    content: string
    disabled?: boolean
    loading?: boolean
    url?: string
    onAction?: () => void
  }>
  actionGroups?: Array<{
    title: string
    actions: Array<{
      content: string
      disabled?: boolean
      url?: string
      onAction?: () => void
    }>
  }>
  pagination?: {
    hasPrevious?: boolean
    hasNext?: boolean
    onPrevious?: () => void
    onNext?: () => void
  }
  breadcrumbs?: Array<{
    content: string
    url?: string
    onAction?: () => void
  }>
  backAction?: {
    content?: string
    url?: string
    onAction?: () => void
  }
  fullWidth?: boolean
  narrowWidth?: boolean
  divider?: boolean
}

interface ParagraphProps extends BaseComponentProps {
  fontWeight?: 'regular' | 'medium' | 'semibold' | 'bold'
  variant?: 'bodyXs' | 'bodySm' | 'bodyMd' | 'bodyLg'
  alignment?: 'start' | 'center' | 'end' | 'justify'
  id?: string
  color?: 'subdued' | 'success' | 'critical' | 'warning' | 'caution' | 'info' | 'magic' | 'magic-subdued'
  truncate?: boolean
}

interface PasswordFieldProps extends TextFieldProps {
  type?: 'password'
}

interface SearchFieldProps extends TextFieldProps {
  type?: 'search'
  showClearButton?: boolean
}

interface SectionProps extends BaseComponentProps {
  variant?: 'default' | 'subdued'
}

interface SelectOption {
  label: string
  value: string
  disabled?: boolean
  prefix?: React.ReactNode
  group?: string
}

interface SelectProps extends BaseComponentProps {
  options: SelectOption[]
  label: string
  labelAction?: {
    content: string
    onAction?: () => void
  }
  labelHidden?: boolean
  labelInline?: boolean
  disabled?: boolean
  helpText?: React.ReactNode
  placeholder?: string
  id?: string
  name?: string
  value?: string
  error?: boolean | string
  onChange?: (value: string, id: string) => void
  onFocus?: (event: FocusEvent) => void
  onBlur?: (event: FocusEvent) => void
  requiredIndicator?: boolean
}

interface SpinnerProps extends BaseComponentProps {
  size?: 'small' | 'large'
  accessibilityLabel?: string
  hasFocusableParent?: boolean
}

interface StackProps extends BoxProps {
  alignContent?: AlignContentKeyword | string
  alignItems?: AlignItemsKeyword | string
  columnGap?: SpacingKeyword | string
  direction?: 'inline' | 'block'
  gap?: SpacingKeyword
  justifyContent?: JustifyContentKeyword | string
  rowGap?: SpacingKeyword | string
}

interface SwitchProps extends BaseComponentProps {
  id?: string
  label?: string
  details?: string
  name?: string
  checked?: boolean
  disabled?: boolean
  helpText?: React.ReactNode | string
  onChange?: (checked: boolean, id: string) => void
  onInput?: () => void
  onFocus?: (event: FocusEvent) => void
  onBlur?: (event: FocusEvent) => void
  accessibilityLabel?: string
  ariaDescribedBy?: string
  ariaLabelledBy?: string
}

interface TableColumn {
  header: React.ReactNode
  id: string
  width?: string
  sticky?: boolean
  truncate?: boolean
  sortable?: boolean
  defaultSortDirection?: 'ascending' | 'descending'
}

interface TableProps extends BaseComponentProps {
  data: Array<{ [key: string]: React.ReactNode }>
  columns: TableColumn[]
  sortable?: boolean
  defaultSortDirection?: 'ascending' | 'descending'
  initialSortColumnIndex?: number
  onSort?: (headingIndex: number, direction: 'ascending' | 'descending') => void
  footerContent?: React.ReactNode
  stickyHeader?: boolean
  striped?: boolean
  condensed?: boolean
  hoverable?: boolean
}

interface TextProps extends BaseComponentProps {
  type?: 'strong' | 'em' | 'mark' | 'del' | 'ins' | 'sub' | 'sup'
  tone?: Tone
  color?: Color
  truncate?: boolean
  accessibilityVisibility?: 'visible' | 'hidden' | 'exclusive'
  dir?: 'ltr' | 'rtl' | 'auto' | ''
  fontVariantNumeric?: boolean
}

interface TextAreaProps extends BaseComponentProps {
  label: React.ReactNode
  labelAction?: {
    content: string
    onAction?: () => void
  }
  labelHidden?: boolean
  id?: string
  name?: string
  value?: string
  disabled?: boolean
  readOnly?: boolean
  autoComplete?: boolean | string
  error?: boolean | string
  helpText?: React.ReactNode
  placeholder?: string
  rows?: number
  maxLength?: number
  maxHeight?: number | string
  showCharacterCount?: boolean
  requiredIndicator?: boolean
  onChange?: (value: string, id: string) => void
  onFocus?: (event: FocusEvent) => void
  onBlur?: (event: FocusEvent) => void
  ariaActiveDescendant?: string
  ariaAutocomplete?: 'none' | 'inline' | 'list' | 'both'
  ariaControls?: string
  ariaDescribedBy?: string
  ariaExpanded?: boolean
  ariaInvalid?: boolean
  ariaLabel?: string
  ariaLabelledBy?: string
  ariaMultiline?: boolean
  ariaOwns?: string
}

interface TextFieldProps extends BaseComponentProps {
  label: React.ReactNode
  labelAction?: {
    content: string
    onAction?: () => void
  }
  labelHidden?: boolean
  id?: string
  name?: string
  value?: string
  disabled?: boolean
  readOnly?: boolean
  autoComplete?: boolean | string
  error?: boolean | string
  helpText?: React.ReactNode
  placeholder?: string
  prefix?: React.ReactNode
  suffix?: React.ReactNode
  verticalContent?: React.ReactNode
  clearButton?: boolean
  monospaced?: boolean
  align?: 'left' | 'center' | 'right'
  requiredIndicator?: boolean
  pattern?: string
  inputMode?: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url'
  type?:
    | 'text'
    | 'email'
    | 'number'
    | 'password'
    | 'search'
    | 'tel'
    | 'url'
    | 'date'
    | 'datetime-local'
    | 'month'
    | 'time'
    | 'week'
  multiline?: boolean | number
  maxLength?: number
  maxHeight?: number | string
  showCharacterCount?: boolean
  largeStep?: number
  max?: number | string
  min?: number | string
  step?: number | string
  autoSize?: boolean
  rows?: number
  size?: 'medium' | 'slim'
  spellCheck?: boolean
  onChange?: (value: string, id: string) => void
  onClearButtonClick?: (id: string) => void
  onSpinnerChange?: (delta: number, id: string) => void
  onFocus?: (event: FocusEvent) => void
  onBlur?: (event: FocusEvent) => void
  onKeyDown?: (event: KeyboardEvent) => void
  onKeyPress?: (event: KeyboardEvent) => void
  onKeyUp?: (event: KeyboardEvent) => void
  ariaActiveDescendant?: string
  ariaAutocomplete?: 'none' | 'inline' | 'list' | 'both'
  ariaControls?: string
  ariaDescribedBy?: string
  ariaExpanded?: boolean
  ariaInvalid?: boolean
  ariaLabel?: string
  ariaLabelledBy?: string
  ariaMultiline?: boolean
  ariaOwns?: string
}

interface URLFieldProps extends TextFieldProps {
  type?: 'url'
}

interface UnorderedListProps extends ListProps {}
