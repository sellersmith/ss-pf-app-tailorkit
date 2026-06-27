import type { TLayerStore } from '~/stores/modules/layer'
import { MultiLayout } from '../Multi-Layout'
import { TextOptionSet } from './TextOptionSet'
import { ColorOptionSet } from './ColorOptionSet'
import { ImageOptionSet } from './ImageOptionSet'
import { ImagelessOptionSet } from './ImagelessOptionSet'
import { EOptionSet, optionSetDataKeys, type OptionSet, type SHAPE_OPTION_SET } from '~/types/psd'
import { FontOptionSet } from './FontOptionSet'
import { MaskOptionSet } from './MaskOptionSet'
import type { ShopDocument } from '~/models/Shop'
import { useMemo } from 'react'
import { useStore } from '~/libs/external-store'
import { getDefaultStorefrontLabel } from '~/modules/TemplateEditor/elements/fns'
import { useTranslation } from 'react-i18next'
import { formatOptionDisplayPricing } from '~/utils/exchange-rates/client'
import { EMPTY_ARRAY } from '~/constants'

interface OptionSetSelectorProps {
  layerStore: TLayerStore
  optionSet: Exclude<OptionSet, SHAPE_OPTION_SET>
  onSelect: (optionSet: OptionSet, _id: string) => void
  shopData?: ShopDocument
  groupId?: string
  previewMode?: boolean
  /** Whether this option set is marked as required */
  required?: boolean
}

export const OptionSetSelector = (props: OptionSetSelectorProps) => {
  const { layerStore, optionSet, onSelect, groupId, previewMode, shopData, required = false } = props
  const { t } = useTranslation()
  const defaultStorefrontLabel = useMemo(
    () => getDefaultStorefrontLabel({ t, type: optionSet?.type }),
    [t, optionSet?.type]
  )
  const { labelOnStoreFront = defaultStorefrontLabel, type } = optionSet
  const currency = shopData?.shopConfig?.currency || 'USD'

  const _id = useStore(layerStore, state => state._id)
  const storefrontOptionSetLabels = useStore(layerStore, state => state.settings?.storefrontOptionSetLabels)
  const storefrontLabel = useStore(layerStore, state => state.settings?.storefrontLabel)

  // Refine option set label on the storefront
  // For multi-layout, prioritize layer's storefrontLabel over optionSet's labelOnStoreFront
  // This matches the server-side preparation logic for consistency
  const label
    = type === EOptionSet.MULTI_LAYOUT_OPTION
      ? storefrontOptionSetLabels?.[type] || storefrontLabel || labelOnStoreFront
      : storefrontOptionSetLabels?.[type] || labelOnStoreFront || storefrontLabel

  // const shapeSettings = useStore(layerStore, state => state.shapeSettings)
  const C = useMemo(() => getOptionComponentByType(type), [type])

  if (type === EOptionSet.MULTI_LAYOUT_OPTION) {
    return (
      <div className="emtlkit--option-set-container" data-item-id={`${_id}::${optionSet._id}`}>
        <fieldset data-layer-type={type} className="emtlkit--d-flex emtlkit--flex-column" data-layer-id={_id}>
          <MultiLayout
            label={label}
            optionSet={optionSet}
            layerStore={layerStore}
            previewMode={previewMode}
            groupId={groupId}
          />
        </fieldset>
      </div>
    )
  }

  const isTextOption = type === EOptionSet.TEXT_OPTION
  const optionSetDataValue = (optionSet.data as unknown as any)?.[optionSetDataKeys[type]] || EMPTY_ARRAY

  const optionSetSelecting = optionSetDataValue.find((item: any) => item.selecting)

  return (
    <div id={_id} className="emtlkit--option-set-container" data-item-id={`${_id}::${optionSet._id}`}>
      <fieldset data-layer-type={type} className="emtlkit--d-flex emtlkit--flex-column" data-layer-id={_id}>
        {C && (
          <>
            <h3
              className={`emtlkit--option-set-label${required ? ' emtlkit--required-indicator' : ''}`}
              data-label={label}
              data-changeable={isTextOption}
            >
              {label}
              {/* Skip label suffix for checkbox — checkbox already shows its own label + pricing */}
              {optionSetSelecting
                ? `: ${!isTextOption ? optionSetSelecting.name : ''}${formatOptionDisplayPricing(optionSetSelecting.additionalPricing, currency)}`
                : ''}
            </h3>
            <C
              optionSet={optionSet}
              onSelect={onSelect}
              layerStore={layerStore}
              groupId={groupId}
              currencyCode={currency}
            />
          </>
        )}
        {/* {type === 'shape' && shapeSettings && shapeSettings.enableForCustomers && (
          <TextShape
            label={shapeSettings.label || ''}
            value={shapeSettings.tempShape !== undefined ? shapeSettings.tempShape : shapeSettings.shape}
            onChange={onTextShapeChange}
          />
        )} */}
      </fieldset>
    </div>
  )
}

const getOptionComponentByType = (type: string) => {
  if (type === EOptionSet.TEXT_OPTION) {
    return TextOptionSet
  }

  if (type === EOptionSet.IMAGE_OPTION) {
    return ImageOptionSet
  }

  if (type === EOptionSet.MASK_OPTION) {
    return MaskOptionSet
  }

  if (type === EOptionSet.IMAGELESS_OPTION) {
    return ImagelessOptionSet
  }

  if (type === EOptionSet.COLOR_OPTION) {
    return ColorOptionSet
  }

  if (type === EOptionSet.FONT_OPTION) {
    return FontOptionSet
  }

  return null
}

export interface IOptionSetComponentProps {
  optionSet: OptionSet
  layerStore: TLayerStore
  onSelect: (optionSet: OptionSet, _id: string) => void
  groupId?: string
  currencyCode?: string
}
