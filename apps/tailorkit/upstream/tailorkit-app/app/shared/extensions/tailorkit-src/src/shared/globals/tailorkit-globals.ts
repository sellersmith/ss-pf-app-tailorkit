/**
 * TailorKit Global Namespace
 *
 * Exposes shared dependencies for chunks to consume without importing.
 * This prevents code duplication when building separate entry points.
 *
 * IMPORTANT: Static imports are used but window.TailorKit assignment is deferred
 * to a function call to avoid class initialization order issues.
 */
import { BaseOptionSetElement } from '../components/BaseOptionSetElement'
import { getOptionSetLocalStorageKey } from '../../assets/utils/restore-option-values'
import { EOptionSet, tlkOptionSetClickEvent } from '../constants/optionSets'
import { FontLoader } from '../../assets/utils/font-loader'
import { Popover } from '../../assets/components/commons/popover'
import { POSITIONS } from '../../assets/components/commons/popover/constants'
import { CHECK_ICON_PATH, SELECT_ICON_PATH, createSvgIcon } from '../../assets/icons'
import TextField from '../../assets/components/commons/textfield'
import { ROLE_TEXT_INPUT, ROLE_TEXT_COUNTER } from '../../assets/utils/dom-constants'

// Type definitions for the namespace
export interface TailorKitNamespace {
  BaseOptionSetElement: typeof BaseOptionSetElement
  getOptionSetLocalStorageKey: typeof getOptionSetLocalStorageKey
  EOptionSet: typeof EOptionSet
  tlkOptionSetClickEvent: typeof tlkOptionSetClickEvent
  FontLoader: typeof FontLoader
  Popover: typeof Popover
  POSITIONS: typeof POSITIONS
  CHECK_ICON_PATH: typeof CHECK_ICON_PATH
  SELECT_ICON_PATH: typeof SELECT_ICON_PATH
  createSvgIcon: typeof createSvgIcon
  TextField: typeof TextField
  ROLE_TEXT_INPUT: typeof ROLE_TEXT_INPUT
  ROLE_TEXT_COUNTER: typeof ROLE_TEXT_COUNTER
}

// Extend Window interface
declare global {
  interface Window {
    TailorKit: TailorKitNamespace
  }
}

/**
 * Initialize the TailorKit global namespace.
 * This should be called AFTER all core components are imported
 * to avoid class initialization order issues.
 */
export function initializeTailorKitNamespace() {
  // Initialize namespace on window
  // By the time this function is called, all imported classes are fully initialized
  window.TailorKit = {
    BaseOptionSetElement,
    getOptionSetLocalStorageKey,
    EOptionSet,
    tlkOptionSetClickEvent,
    FontLoader,
    Popover,
    POSITIONS,
    CHECK_ICON_PATH,
    SELECT_ICON_PATH,
    createSvgIcon,
    TextField,
    ROLE_TEXT_INPUT,
    ROLE_TEXT_COUNTER,
  }

  console.log('[TailorKit] Global namespace initialized')
}
