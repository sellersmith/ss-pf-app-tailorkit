import { Fragment, useCallback, useContext, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { OptionSetErrors } from '~/constants/errors'
import { useStore } from '~/libs/external-store'
import { TemplateEditorContext } from '~/modules/TemplateEditor/context'
import { type TLayerStore } from '~/stores/modules/layer'
import type { TextOptionSet } from '~/types/psd'
import { uuid } from '~/utils/uuid'
import SortableItemList from '~/modules/SortableItemList'
import { MAX_OPTION_SET_ITEM_NAME_SIZE } from '~/constants/canvas'
import { getErrorMessageByKey, getKeyError, OptionSetErrorKeys } from '~/modules/TemplateEditor/utilities/optionSet-fns'
import { useValidateOptionSetData } from '../../../hooks/useValidateOptionSetData'
import { Scrollable } from '@shopify/polaris'
import { createOptionPricing } from '~/utils/exchange-rates/client'
import OptionSetPricingField from '~/components/OptionSetPricingField'
import OptionSetPricingHeader from '~/components/OptionSetPricingHeader'
import { isAdditionalPricingEnabled } from '~/utils/optionSet-pricing'
import { applyStyleCase } from 'extensions/tailorkit-src/src/assets/utils/render-text-layer-to-data-source'

interface ITempTextOptionSet extends TextOptionSet {
  id: string
}

const OptionSetListEdit = (props: {
  layerStore: TLayerStore
  optionSet: any
  updateOptionSelecting: (textId: string) => void
}) => {
  const { t } = useTranslation()
  const { layerStore, optionSet, updateOptionSelecting } = props
  const context = useContext(TemplateEditorContext)
  const layerId = useStore(layerStore, state => state._id)

  const textOptions: ITempTextOptionSet[] = useMemo(
    () =>
      optionSet?.data?.texts?.map((text: any) => ({
        ...text,
        id: text._id,
      })) || [],
    [optionSet?.data?.texts]
  )

  const onChangeSortableList = useCallback(
    (items: ITempTextOptionSet[]) => {
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

  const onChangeTextNameById = useCallback(
    (_id: string, data: any) => {
      const name = typeof data === 'string' ? data : data.name
      const { settings } = layerStore.getState()
      const styleCase = settings?.styleCase
      const mutationName = applyStyleCase(name, styleCase || 'none')

      layerStore.dispatch({
        type: 'UPDATE_OPTION_ITEM_TITLE',
        payload: {
          optionSet,
          _id,
          name: mutationName,
        },
      })
    },
    [layerStore, optionSet]
  )

  const onChangeTextPricingById = useCallback(
    async (_id: string, value: string) => {
      const numericValue = +value

      try {
        const newPricing = await createOptionPricing(numericValue)
        const texts: TextOptionSet[] = optionSet?.data?.texts || []

        // Update the specific text's pricing
        const updatedTexts = texts.map(text => (text._id === _id ? { ...text, additionalPricing: newPricing } : text))

        layerStore.dispatch({
          type: 'UPDATE_OPTION_SET',
          payload: {
            optionSet: {
              ...optionSet,
              data: {
                ...optionSet.data,
                texts: updatedTexts,
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
      name: getItemDefaultLabel({}, textOptions.length + 1),
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
            texts: [...textOptions, { ...newItem }],
          },
        },
      },
    })

    return newItem
  }, [getItemDefaultLabel, layerStore, optionSet, textOptions])

  const onDeleteTextItemById = (_id: string) => {
    layerStore.dispatch({
      type: 'DELETE_OPTION_ITEM',
      payload: {
        optionSet,
        _id,
        context,
      },
    })
  }

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

  useValidateOptionSetData({ optionSet, layerId })

  return (
    <Fragment>
      <SortableItemList
        items={textOptions}
        onAddItem={handleAddOption}
        getItemDefaultLabel={(item: any) => getItemDefaultLabel(item, textOptions.length)}
        disabled={!optionSet?.label}
        onEditing={updateOptionSelecting}
        addNewItemLabel={t('add-option')}
        onListChange={onChangeSortableList}
        onDeleteItem={onDeleteTextItemById}
        onItemChange={onChangeTextNameById}
        itemHtmlClass="image-option-name-edit"
        inputPlaceholder={t('input-your-text-option')}
        maxLabelLength={MAX_OPTION_SET_ITEM_NAME_SIZE}
        customHeader={
          <OptionSetPricingHeader
            optionSet={optionSet}
            onToggleEnabled={handleTogglePricingEnabled}
            disabled={!optionSet?.label}
          />
        }
        getItemError={(item: any) => {
          const { _id } = item
          const errorItemKey = getKeyError(optionSet, OptionSetErrorKeys.OPTION_SET_ITEM_NAME, _id)

          return getErrorMessageByKey({ keyOptionSetError: errorItemKey, layerId }, context)
        }}
        validateItem={(item: any) => {
          const { _id, name } = item
          const errorItemKey = getKeyError(optionSet, OptionSetErrorKeys.OPTION_SET_ITEM_NAME, _id)
          context.setValidationErrors(
            layerId,
            errorItemKey,
            name?.length > 0 ? null : OptionSetErrors.TEXT_VALUE_IS_REQUIRED
          )
        }}
        customExtraActions={(item: any) =>
          pricingEnabled ? (
            <OptionSetPricingField item={item} onPricingChange={onChangeTextPricingById} disabled={!optionSet?.label} />
          ) : null
        }
      />
      <Scrollable.ScrollTo />
    </Fragment>
  )
}

export default OptionSetListEdit
