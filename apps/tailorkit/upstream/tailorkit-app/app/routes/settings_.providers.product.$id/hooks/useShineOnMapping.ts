import { useCallback, useMemo } from 'react'
import type { ProductTemplate } from '@sellersmith/shineon-sdk'
import type { ShineOnMapping } from '~/modules/Fulfillments/ShineOn/types'
import type { EngravingSlotConfig } from '~/modules/Fulfillments/ShineOn/catalog/get-engraving-slots'
import { getEngravingSlots } from '~/modules/Fulfillments/ShineOn/catalog/get-engraving-slots'
import { ProductProviderStore } from '../stores/productProviderStore'
import type { TextLayerOption } from '../components/ShineOnMapping/types'

interface TemplateDetails {
  variants: Array<{ id: string; title: string; cost: number; options: Record<string, string> }>
  engraving_sibling_id?: number
  buyer_uploads?: boolean
  metafields?: {
    size_option?: string
    [key: string]: string | undefined
  }
}

interface UseShineOnMappingProps {
  templateDetails: TemplateDetails | null
  savedMapping: ShineOnMapping | null
  hasEngravings: boolean
  hasSizeOption: boolean
}

interface UseShineOnMappingReturn {
  mapping: ShineOnMapping | null
  engravingConfig: EngravingSlotConfig
  textLayers: TextLayerOption[]
  printAreaOptions: Array<{ id: string; name: string }>
  setMapping: (mapping: ShineOnMapping) => void
  isShineOnProduct: boolean
}

/**
 * Hook for managing ShineOn personalization mapping state.
 * Computes engraving configuration from template data and provides mapping state management.
 */
export function useShineOnMapping({
  templateDetails,
  savedMapping,
  hasEngravings,
  hasSizeOption,
}: UseShineOnMappingProps): UseShineOnMappingReturn {
  const isShineOnProduct = !!templateDetails

  // Build engraving configuration from template data
  const engravingConfig = useMemo<EngravingSlotConfig>(() => {
    if (!templateDetails) {
      return {
        lineCount: 0,
        supportsArtwork: false,
        hasSizeOption: false,
        defaultMaxChars: 20,
        defaultFonts: [],
      }
    }

    // Build minimal template config for getEngravingSlots
    const templateForConfig: Pick<ProductTemplate, 'engraving_sibling_id' | 'buyer_uploads' | 'metafields'> = {
      engraving_sibling_id: hasEngravings ? 1 : undefined,
      buyer_uploads: templateDetails.buyer_uploads || false,
      metafields: {
        size_option: hasSizeOption ? 'true' : undefined,
        ...templateDetails.metafields,
      },
    }

    return getEngravingSlots(templateForConfig as ProductTemplate)
  }, [templateDetails, hasEngravings, hasSizeOption])

  // Generate placeholder text layers from template data
  // TODO: Replace with actual integration layers from print areas in future phase
  const textLayers = useMemo<TextLayerOption[]>(() => {
    if (!templateDetails) return []

    // Generate placeholder text layers based on engraving count
    const layerCount = Math.max(engravingConfig.lineCount, 2)
    return Array.from({ length: layerCount }, (_, index) => ({
      layerId: `text-layer-${index + 1}`,
      label: `Text Layer ${index + 1}`,
      printAreaName: 'Front',
    }))
  }, [templateDetails, engravingConfig.lineCount])

  // Generate placeholder print area options
  const printAreaOptions = useMemo(() => {
    if (!templateDetails) return []
    return [
      { id: 'print-area-1', name: 'Front' },
      { id: 'print-area-2', name: 'Back' },
    ]
  }, [templateDetails])

  // Dispatch mapping changes to store
  const setMapping = useCallback((mapping: ShineOnMapping) => {
    ProductProviderStore.dispatch({
      type: 'SET_SHINEON_MAPPING',
      payload: { shineOnMapping: mapping },
    })
  }, [])

  return {
    mapping: savedMapping,
    engravingConfig,
    textLayers,
    printAreaOptions,
    setMapping,
    isShineOnProduct,
  }
}
