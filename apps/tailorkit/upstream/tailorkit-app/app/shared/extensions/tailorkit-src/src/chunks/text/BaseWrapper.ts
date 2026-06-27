/**
 * BaseWrapper - Re-exports shared dependencies from window.TailorKit
 *
 * This file is used by chunk components to access BaseOptionSetElement and
 * other shared dependencies without importing them via ES modules.
 *
 * The core bundle initializes window.TailorKit before chunks load,
 * so these references will be available when chunk code runs.
 */

// Reference the TailorKit namespace from window
const TK = (window as any).TailorKit

// Re-export BaseOptionSetElement with proper typing
// The type assertion ensures TypeScript knows the class shape
export const BaseOptionSetElement = TK.BaseOptionSetElement as typeof import('../../shared/components/BaseOptionSetElement').BaseOptionSetElement

// Re-export other shared dependencies
export const getOptionSetLocalStorageKey = TK.getOptionSetLocalStorageKey as typeof import('../../assets/utils/restore-option-values').getOptionSetLocalStorageKey
export const EOptionSet = TK.EOptionSet as typeof import('../../shared/constants/optionSets').EOptionSet
export const tlkOptionSetClickEvent = TK.tlkOptionSetClickEvent as typeof import('../../shared/constants/optionSets').tlkOptionSetClickEvent

// Re-export shared utilities for text chunk components
export const FontLoader = TK.FontLoader as typeof import('../../assets/utils/font-loader').FontLoader
export const Popover = TK.Popover as typeof import('../../assets/components/commons/popover').Popover
export const POSITIONS = TK.POSITIONS as typeof import('../../assets/components/commons/popover/constants').POSITIONS
export const CHECK_ICON_PATH = TK.CHECK_ICON_PATH as typeof import('../../assets/icons').CHECK_ICON_PATH
export const SELECT_ICON_PATH = TK.SELECT_ICON_PATH as typeof import('../../assets/icons').SELECT_ICON_PATH
export const createSvgIcon = TK.createSvgIcon as typeof import('../../assets/icons').createSvgIcon

// Re-export TextField and DOM constants for TextCustomer
export const TextField = TK.TextField as typeof import('../../assets/components/commons/textfield').default
export const ROLE_TEXT_INPUT = TK.ROLE_TEXT_INPUT as typeof import('../../assets/utils/dom-constants').ROLE_TEXT_INPUT
export const ROLE_TEXT_COUNTER = TK.ROLE_TEXT_COUNTER as typeof import('../../assets/utils/dom-constants').ROLE_TEXT_COUNTER

// Re-export types (these are erased at runtime, so direct import is fine)
export type { PopoverOptions } from '../../assets/components/commons/popover'
export type { PopoverPosition } from '../../assets/components/commons/popover/constants'
