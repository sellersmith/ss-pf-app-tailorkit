import { EOptionSet } from '~/types/psd'

/** All customization types available in TailorKit */
export type CustomizationItemType =
  | 'text_customer'
  | 'text_option'
  | 'font_option'
  | 'color_option'
  | 'image_buyer'
  | 'image_seller'
  | 'mask_option'
  | 'imageless_option'
  | 'multi_layout'
  | 'charm_builder'

/** Normalized customization item — unified across all source types */
export interface CustomizationItem {
  /** Unique identifier: layerId::optionSetId or layerId::type */
  id: string
  /** Discriminator — identifies the customization type */
  type: CustomizationItemType
  /** Display label for UI */
  label: string
  /** Source layer ID */
  layerId: string
  /** Source layer display name */
  layerLabel: string
  /** Parent print area ID */
  printAreaId: string
  /** Whether this item has configured data (options, presets, etc.) */
  hasData: boolean
  /** Traceability reference back to original data source */
  sourceRef: {
    optionSetId?: string
    layerSettingsPath?: string
    charmConfigRef?: boolean
  }
}

/** Maps EOptionSet enum to CustomizationItemType */
export const OPTION_SET_TYPE_MAP: Partial<Record<string, CustomizationItemType>> = {
  [EOptionSet.TEXT_OPTION]: 'text_option',
  [EOptionSet.FONT_OPTION]: 'font_option',
  [EOptionSet.COLOR_OPTION]: 'color_option',
  [EOptionSet.IMAGE_OPTION]: 'image_buyer', // default; overridden to image_seller by adapter
  [EOptionSet.IMAGELESS_OPTION]: 'imageless_option',
  [EOptionSet.MULTI_LAYOUT_OPTION]: 'multi_layout',
  [EOptionSet.MASK_OPTION]: 'mask_option',
}

/** Human-readable labels for each customization type */
export const CUSTOMIZATION_TYPE_LABELS: Record<CustomizationItemType, string> = {
  text_customer: 'Text input (buyer)',
  text_option: 'Text presets',
  font_option: 'Font selector',
  color_option: 'Color picker',
  image_buyer: 'Image upload (buyer)',
  image_seller: 'Preset images',
  mask_option: 'Mask selector',
  imageless_option: 'Swatch selector',
  multi_layout: 'Layout switcher',
  charm_builder: 'Charm builder',
}
