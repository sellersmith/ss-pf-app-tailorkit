import type { BaseOptionItem, BaseOptionSetProps } from '../types'
import type { EOptionSet } from '../../constants/optionSets'

/**
 * Font-specific option item interface
 */
export interface FontOptionItem extends BaseOptionItem {
  family?: string
  src?: string
  isDefault?: boolean
}

/**
 * Font-specific option set props interface
 */
export interface FontOptionSetProps extends BaseOptionSetProps {
  optionSet: {
    i: string
    t: EOptionSet.FONT_OPTION
    l: string
    ol: FontOptionItem[]
    displayStyle: string
  }
  defaultFont?: {
    src: string
    family: string
    additionalPricing?: any
  }
  displayStyle?: 'font_swatch' | 'font_dropdown_list'
}
