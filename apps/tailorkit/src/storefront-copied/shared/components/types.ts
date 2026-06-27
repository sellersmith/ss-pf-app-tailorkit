import type { IOptionSetType } from '../constants/optionSets'

/**
 * Base interface for all option items
 */
export interface BaseOptionItem {
  // id
  i: string
  // label
  l: string
  // value
  v: string
  // selected
  selecting?: boolean
  // additional pricing if any
  additionalPricing?: any
}

/**
 * Base props interface for all option sets
 */
export interface BaseOptionSetProps {
  optionSet: IOptionSetType | null
  currentPrintAreaId?: string
  currentOptionSetId?: string
  onSelect?: (id: string, e?: any) => void
}
