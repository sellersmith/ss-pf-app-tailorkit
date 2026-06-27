import type { TextFieldOptions } from '../textfield/types'

/**
 * Option item interface
 */
interface Option {
  /** Value of the option */
  value: string
  /** Display label for the option */
  label: string
  /** Optional description text */
  description?: string
  /** Whether the option is disabled */
  disabled?: boolean
  /** Media element (image URL or HTML) */
  media?: string | HTMLElement
  /** Content to display before the option */
  prefix?: string | HTMLElement
  /** Content to display after the option */
  suffix?: string | HTMLElement
  /** Additional attributes */
  [key: string]: any
}

/**
 * Section of grouped options
 */
interface OptionSection {
  /** Section title */
  title?: string
  /** Options within this section */
  options: Option[]
}

/**
 * Options for creating an OptionList component
 */
interface OptionListOptions {
  /** List of available options */
  options?: Option[]
  /** Array of pre-selected option values */
  selected?: string[]
  /** Whether multiple selections are allowed */
  allowMultiple?: boolean
  /** Whether to show radio buttons in single selection mode */
  showRadio?: boolean
  /** Whether to show check icon in multiple selection mode */
  showCheck?: boolean
  /** Title for the option list */
  title?: string
  /** Callback when selection changes */
  onChange?: (selected: string[]) => void
  /** Callback when an individual option is selected */
  onSelect?: (value: string) => void
  /** ARIA role for the container */
  role?: string
  /** ARIA role for option elements */
  optionRole?: string
  /** Loading state */
  loading?: boolean
  /** Grouped sections of options */
  sections?: OptionSection[]
  /** Whether to show search input */
  showSearch?: boolean
  /** Search TextField options */
  searchFieldOptions?: TextFieldOptions
  /** Placeholder text for search field */
  searchPlaceholder?: string
}

export type { Option, OptionSection, OptionListOptions }
