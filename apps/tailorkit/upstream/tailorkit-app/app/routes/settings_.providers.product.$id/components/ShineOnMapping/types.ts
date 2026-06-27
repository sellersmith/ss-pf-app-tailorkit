import type {
  ShineOnMapping,
  ShineOnEngravingLineMapping,
  ShineOnFontMapping,
  ShineOnSizeMapping,
  ShineOnPrintUrlMapping,
} from '~/modules/Fulfillments/ShineOn/types'
import type { EngravingSlotConfig } from '~/modules/Fulfillments/ShineOn/catalog/get-engraving-slots'

export type {
  ShineOnMapping,
  ShineOnEngravingLineMapping,
  ShineOnFontMapping,
  ShineOnSizeMapping,
  ShineOnPrintUrlMapping,
  EngravingSlotConfig,
}

export interface TextLayerOption {
  layerId: string
  label: string
  printAreaName: string
}

export interface ShineOnMappingProps {
  mapping: ShineOnMapping | null
  engravingConfig: EngravingSlotConfig
  textLayers: TextLayerOption[]
  printAreaOptions: Array<{ id: string; name: string }>
  onChange: (mapping: ShineOnMapping) => void
}
