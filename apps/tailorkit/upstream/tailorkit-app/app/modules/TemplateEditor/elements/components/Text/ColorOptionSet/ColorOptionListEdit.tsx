import { Fragment, useCallback, useContext, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { MAX_OPTION_SET_ITEM_NAME_SIZE } from '~/constants/canvas'
import { DEFAULT_TEXT_COLOR } from '~/constants/inspector/text'
import { useStore } from '~/libs/external-store'
import { TemplateEditorContext } from '~/modules/TemplateEditor/context'
import { type TLayerStore } from '~/stores/modules/layer'
import type { ColorOptionSet } from '~/types/psd'
import { uuid } from '~/utils/uuid'
import { ColorChangingBox } from './ColorChangingBox'
import SortableItemList from '~/modules/SortableItemList'
import { OptionSetErrors } from '~/constants/errors'
import { getErrorMessageByKey, getKeyError, OptionSetErrorKeys } from '~/modules/TemplateEditor/utilities/optionSet-fns'
import { useValidateOptionSetData } from '../../../hooks/useValidateOptionSetData'
import { Scrollable } from '@shopify/polaris'
import { createOptionPricing } from '~/utils/exchange-rates/client'
import OptionSetPricingField from '~/components/OptionSetPricingField'
import OptionSetPricingHeader from '~/components/OptionSetPricingHeader'
import { isAdditionalPricingEnabled } from '~/utils/optionSet-pricing'

interface ITempColorOptionSet extends ColorOptionSet {
  id: string
}

const ColorOptionListEdit = (props: {
  layerStore: TLayerStore
  optionSet: any
  updateOptionSelecting: (colorId: string) => void
}) => {
  const { t } = useTranslation()
  const { layerStore, optionSet, updateOptionSelecting } = props
  const layerId = useStore(layerStore, state => state._id)
  const context = useContext(TemplateEditorContext)
  const { setValidationErrors } = context

  const colorOptions: ITempColorOptionSet[] = useMemo(
    () =>
      optionSet?.data?.colors.map((color: any) => ({
        ...color,
        id: color._id,
      })) || [],
    [optionSet?.data?.colors]
  )

  const onChangeSortableList = useCallback(
    (items: ITempColorOptionSet[]) => {
      layerStore.dispatch({
        type: 'UPDATE_OPTIONS_SORTABLE',
        payload: {
          optionSet,
          data: items,
        },
      })
    },
    [layerStore, optionSet]
  )

  const handleChangeColor = useCallback(
    (_id: string, value: string) => {
      layerStore.dispatch({ type: 'UPDATE_COLOR_OPTION_VALUE', payload: { optionSet, _id, value } })
    },
    [layerStore, optionSet]
  )

  const onChangeColorNameById = useCallback(
    (_id: string, data: any) => {
      const { name } = data

      layerStore.dispatch({
        type: 'UPDATE_OPTION_ITEM_TITLE',
        payload: {
          optionSet,
          _id,
          name,
        },
      })
    },
    [layerStore, optionSet]
  )

  const handleTogglePricingEnabled = useCallback(
    (enabled: boolean) => {
      layerStore.dispatch({
        type: 'UPDATE_OPTION_SET',
        payload: {
          optionSet: {
            ...optionSet,
            additionalPricingEnabled: enabled,
          },
        },
      })
    },
    [layerStore, optionSet]
  )

  const pricingEnabled = isAdditionalPricingEnabled(optionSet)

  const onChangeColorPricingById = useCallback(
    async (_id: string, value: string) => {
      const numericValue = +value

      try {
        const newPricing = await createOptionPricing(numericValue)
        const colors: ColorOptionSet[] = optionSet?.data?.colors || []

        // Update the specific color's pricing
        const updatedColors = colors.map(color =>
          color._id === _id ? { ...color, additionalPricing: newPricing } : color
        )

        layerStore.dispatch({
          type: 'UPDATE_OPTION_SET',
          payload: {
            optionSet: {
              ...optionSet,
              data: {
                ...optionSet.data,
                colors: updatedColors,
              },
            },
          },
        })
      } catch (error) {
        console.error('Error updating option pricing:', error)
      }
    },
    [layerStore, optionSet]
  )

  const getItemDefaultLabel = useCallback(
    (item: any, index: number): string => {
      return item.name || t('option-index', { index })
    },
    [t]
  )

  const handleAddOption = useCallback(() => {
    const newId = uuid()
    const newItem = {
      _id: newId,
      name: getItemDefaultLabel({}, colorOptions.length + 1),
      value: DEFAULT_TEXT_COLOR,
      selecting: false,
      id: newId,
    }
    layerStore.dispatch({
      type: 'UPDATE_OPTION_SET',
      payload: {
        optionSet: {
          ...optionSet,
          data: {
            ...optionSet.data,
            colors: [...colorOptions, { ...newItem }],
          },
        },
      },
    })

    return newItem
  }, [colorOptions, layerStore, optionSet, getItemDefaultLabel])

  const onDeleteColorItemById = (_id: string) => {
    layerStore.dispatch({
      type: 'DELETE_OPTION_ITEM',
      payload: {
        optionSet,
        _id,
        context,
      },
    })
  }

  useValidateOptionSetData({ optionSet, layerId })

  return (
    <Fragment>
      <SortableItemList
        items={colorOptions}
        onAddItem={handleAddOption}
        getItemDefaultLabel={(item: any) => getItemDefaultLabel(item, colorOptions.length)}
        disabled={!optionSet?.label}
        onEditing={updateOptionSelecting}
        addNewItemLabel={t('add-option')}
        onListChange={onChangeSortableList}
        onDeleteItem={onDeleteColorItemById}
        onItemChange={onChangeColorNameById}
        itemHtmlClass={`image-option-name-edit${!optionSet?.label ? ' color-option-name-disabled' : ''}`}
        inputPlaceholder={t('input-your-color-name')}
        maxLabelLength={MAX_OPTION_SET_ITEM_NAME_SIZE}
        customHeader={
          <OptionSetPricingHeader
            optionSet={optionSet}
            onToggleEnabled={handleTogglePricingEnabled}
            disabled={!optionSet?.label}
          />
        }
        customThumb={(item: any) => (
          <ColorChangingBox
            disabled={!optionSet?.label}
            colorValue={item.value || DEFAULT_TEXT_COLOR}
            onChangeColor={value => handleChangeColor(item._id, value)}
            style={{
              width: '24px',
            }}
          />
        )}
        getItemError={(item: any) => {
          const { _id } = item
          const errorItemKey = getKeyError(optionSet, OptionSetErrorKeys.OPTION_SET_ITEM_NAME, _id)
          return getErrorMessageByKey({ keyOptionSetError: errorItemKey, layerId }, context)
        }}
        validateItem={(item: any) => {
          const { _id, name } = item
          const errorItemKey = getKeyError(optionSet, OptionSetErrorKeys.OPTION_SET_ITEM_NAME, _id)

          if (name?.length > 0) {
            setValidationErrors(layerId, errorItemKey, null)
          } else {
            setValidationErrors(layerId, errorItemKey, OptionSetErrors.TEXT_VALUE_IS_REQUIRED)
          }
        }}
        customExtraActions={(item: any) =>
          pricingEnabled ? (
            <OptionSetPricingField
              item={item}
              onPricingChange={onChangeColorPricingById}
              disabled={!optionSet?.label}
            />
          ) : null
        }
      />
      <Scrollable.ScrollTo />
    </Fragment>
  )
}

export default ColorOptionListEdit
