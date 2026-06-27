import { Fragment, useCallback, useContext, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { OptionSetErrors } from '~/constants/errors'
import { useStore } from '~/libs/external-store'
import { TemplateEditorContext } from '~/modules/TemplateEditor/context'
import { type TLayerStore } from '~/stores/modules/layer'
import type { FontOptionSet } from '~/types/psd'
import { uuid } from '~/utils/uuid'
import SortableItemList from '~/modules/SortableItemList'
import { MAX_OPTION_SET_ITEM_NAME_SIZE } from '~/constants/canvas'
import { getErrorMessageByKey, getKeyError, OptionSetErrorKeys } from '~/modules/TemplateEditor/utilities/optionSet-fns'
import { useValidateOptionSetData } from '../../../hooks/useValidateOptionSetData'
import { Icon, Scrollable, TextField } from '@shopify/polaris'
import { UploadIcon } from '@shopify/polaris-icons'
import type { FontType } from '~/modules/modals/FontSelector'
import FontSelector from '~/modules/modals/FontSelector'
import { MODAL_ID } from '~/constants/modal'
import { useModal } from '~/utils/hooks/useModal'
import { fontLoader } from '../instances'
import { createOptionPricing } from '~/utils/exchange-rates/client'
import OptionSetPricingField from '~/components/OptionSetPricingField'
import OptionSetPricingHeader from '~/components/OptionSetPricingHeader'
import { isAdditionalPricingEnabled } from '~/utils/optionSet-pricing'

interface ITempFontOptionSet extends FontOptionSet {
  id: string
}

const OptionSetListEdit = (props: {
  layerStore: TLayerStore
  optionSet: any
  updateOptionSelecting: (fontId: string) => void
}) => {
  const { t } = useTranslation()
  const { layerStore, optionSet, updateOptionSelecting } = props
  const { state: modalState, openModal, closeModal } = useModal()
  const context = useContext(TemplateEditorContext)
  const layerId = useStore(layerStore, state => state._id)
  const fontUploaderModalActive = modalState[MODAL_ID.UPLOAD_FONTS_MODAL]?.active

  const fontOptions: ITempFontOptionSet[] = useMemo(
    () =>
      optionSet?.data?.fonts?.map((font: any) => ({
        ...font,
        id: font._id,
      })) || [],
    [optionSet?.data?.fonts]
  )

  const onChangeSortableList = useCallback(
    (items: ITempFontOptionSet[]) => {
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

  const onChangeFontNameById = useCallback(
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

  const onChangeFontPricingById = useCallback(
    async (_id: string, value: string) => {
      const numericValue = +value

      try {
        const newPricing = await createOptionPricing(numericValue)
        const fonts: FontOptionSet[] = optionSet?.data?.fonts || []

        // Update the specific font's pricing
        const updatedFonts = fonts.map(font => (font._id === _id ? { ...font, additionalPricing: newPricing } : font))

        layerStore.dispatch({
          type: 'UPDATE_OPTION_SET',
          payload: {
            optionSet: {
              ...optionSet,
              data: {
                ...optionSet.data,
                fonts: updatedFonts,
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

  const onDeleteFontItemById = (_id: string) => {
    layerStore.dispatch({
      type: 'DELETE_OPTION_ITEM',
      payload: {
        optionSet,
        _id,
        context,
      },
    })
  }

  const openFontSelectorModal = useCallback(() => {
    openModal(MODAL_ID.UPLOAD_FONTS_MODAL, { context: 'font-option-set' })
  }, [openModal])

  const handleCloseFontSelectorModal = useCallback(() => {
    closeModal(MODAL_ID.UPLOAD_FONTS_MODAL)
  }, [closeModal])

  const handleSelectFont = useCallback(
    async (fonts: FontType[]) => {
      // If a font already exists in fontOptions and is not in the new fonts array, remove it from fontOptions
      // If a font already exists in fontOptions and is in the new fonts array, do not add it to fontOptions
      // If a font does not exist in fontOptions, add it to fontOptions

      // Filter out fonts from fontOptions that are not in the new fonts array
      const currentFonts
        = optionSet.data?.fonts?.filter((existingFont: any) =>
          fonts.some(newFont => newFont.family === existingFont.family)
        ) || []

      // Add new fonts that don't exist in fontOptions
      const selectedFonts: FontType[] = fonts
        .filter(font => !fontOptions.some(option => option.family === font.family))
        .map(font => ({
          ...font,
          _id: uuid(),
          name: font.family,
        }))

      await Promise.all(
        selectedFonts.map(async font => {
          await fontLoader.loadFont(font.family, font.src)
        })
      )

      layerStore.dispatch({
        type: 'UPDATE_OPTION_SET',
        payload: {
          optionSet: {
            ...optionSet,
            data: {
              ...optionSet.data,
              fonts: [...currentFonts, ...selectedFonts],
            },
          },
        },
      })
    },
    [fontOptions, layerStore, optionSet]
  )

  const getItemDefaultLabel = useCallback(
    (item: any, index: number): string => {
      return item.name || t('option-index', { index })
    },
    [t]
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

  useValidateOptionSetData({ optionSet, layerId })

  return (
    <Fragment>
      <div
        onClick={() => {
          openFontSelectorModal()
        }}
      >
        <TextField
          label={'Upload fonts'}
          labelHidden
          autoComplete="off"
          placeholder={t('upload-fonts')}
          suffix={<Icon source={UploadIcon} />}
          disabled={!optionSet?.label}
        />
      </div>
      {fontUploaderModalActive && modalState[MODAL_ID.UPLOAD_FONTS_MODAL]?.data?.context === 'font-option-set' && (
        <FontSelector
          selectedFonts={fontOptions}
          onClose={handleCloseFontSelectorModal}
          onSelectFont={handleSelectFont}
        />
      )}
      <OptionSetPricingHeader
        optionSet={optionSet}
        onToggleEnabled={handleTogglePricingEnabled}
        disabled={!optionSet?.label}
      />
      <SortableItemList
        items={fontOptions}
        disabled={!optionSet?.label}
        onEditing={updateOptionSelecting}
        addNewItemLabel={null}
        getItemDefaultLabel={(item: any) => getItemDefaultLabel(item, fontOptions.length)}
        getItemStyles={(item: any) => {
          const font = fontLoader.getLoadedFonts().find(font => font === item.family)
          return {
            fontFamily: `'${font}'`,
          }
        }}
        getItemImage={() => null}
        onListChange={onChangeSortableList}
        onDeleteItem={onDeleteFontItemById}
        onItemChange={onChangeFontNameById}
        itemHtmlClass="font-option-name-edit"
        inputPlaceholder={t('input-your-font-option')}
        maxLabelLength={MAX_OPTION_SET_ITEM_NAME_SIZE}
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
            <OptionSetPricingField item={item} onPricingChange={onChangeFontPricingById} disabled={!optionSet?.label} />
          ) : null
        }
      />
      <Scrollable.ScrollTo />
    </Fragment>
  )
}

export default OptionSetListEdit
