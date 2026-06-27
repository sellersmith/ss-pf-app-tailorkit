/* eslint-disable react-hooks/exhaustive-deps */
import { useCallback, useContext, useEffect, useMemo } from 'react'
import { TemplateEditorContext } from '../../context'
import { optionSetDataKeys, type OptionSet } from '~/types/psd'
import { MIN_OPTION_SET_ITEM_LENGTH } from '~/constants/canvas'
import { OptionSetErrors } from '~/constants/errors'
import { EMPTY_ARRAY } from '~/constants'
import { getKeyError, OptionSetErrorKeys } from '../../utilities/optionSet-fns'
import { TemplateEditorStore } from '~/stores/modules/template'
import { useStore } from '~/libs/external-store'

interface IProps {
  layerId: string
  optionSet: OptionSet
  itemId?: string
}

export function validateOptionSet(props: any, context: any) {
  const { validationErrors } = context
  const { keyDataError, layerId, optionSet } = props

  // @ts-ignore
  // TODO: Optimize this code to make readable
  const optionSetData = optionSet?.data?.[optionSetDataKeys[optionSet?.type]] || EMPTY_ARRAY
  const emptyNameItemExists = optionSet?.label && optionSetData.find((item: any) => !item.name)
  const labelOnStoreFront = optionSet?.labelOnStoreFront

  const keyLabelStoreFrontError = `${layerId}-optionSet-${optionSet?._id}.storefrontLabel`
  const errorDataMsg = (validationErrors as any)?.[`${layerId}-${keyDataError}`]
  const hasValidTextOptions = optionSetData.length >= MIN_OPTION_SET_ITEM_LENGTH
  const hasLabel = optionSet?.label

  return {
    hasLabel,
    errorDataMsg,
    optionSetData,
    labelOnStoreFront,
    emptyNameItemExists,
    hasValidTextOptions,
    keyLabelStoreFrontError,
  }
}

export const useValidateOptionSetData = (props: IProps) => {
  const { layerId, optionSet } = props
  const context = useContext(TemplateEditorContext)
  const { setValidationErrors } = context

  // Force the interaction handler to re-render so elements that display
  // the storefront label on the editor canvas can work properly.
  const { scale, left, top } = useStore(TemplateEditorStore, state => state.viewport)

  const keyOptionSetLabelStoreFrontError = useMemo(
    () => getKeyError(optionSet, OptionSetErrorKeys.LABEL_STORE_FRONT),
    [optionSet]
  )
  const keyOptionSetLabelError = useMemo(() => getKeyError(optionSet, OptionSetErrorKeys.OPTION_SET_LABEL), [optionSet])
  const keyOptionSetDataError = useMemo(() => getKeyError(optionSet, OptionSetErrorKeys.OPTION_SET_DATA), [optionSet])

  // Clear errors about the option set items
  const optionSetDataKey = optionSetDataKeys[optionSet.type as keyof typeof optionSetDataKeys]
  const optionSetItems = (optionSet.data as any)?.[optionSetDataKey] || EMPTY_ARRAY
  const { label, labelOnStoreFront } = optionSet || ({} as OptionSet)
  const emptyNameItemExists = optionSetItems.find((item: any) => !item.name)
  const hasValidData = optionSetItems.length >= MIN_OPTION_SET_ITEM_LENGTH && !emptyNameItemExists
  const doNotValidate = !labelOnStoreFront && !label && !optionSet?.data

  const forceRefreshEditorCanvas = useCallback(() => {
    TemplateEditorStore.dispatch({
      type: 'SET_VIEW_PORT',
      payload: {
        viewport: { scale, left, top },
      },
      skipTrace: true,
    })
  }, [left, scale, top])

  const validateOptionSet = () => {
    // Validate store front label
    const labelOnStoreFrontError = !labelOnStoreFront ? OptionSetErrors.MISSING_STORE_FRONT_LABEL : null
    setValidationErrors(layerId, keyOptionSetLabelStoreFrontError, labelOnStoreFrontError)

    // Validate label name
    const labelError = !label ? OptionSetErrors.MISSING_OPTION_NAME : null
    setValidationErrors(layerId, keyOptionSetLabelError, labelError)

    if (labelOnStoreFront && label) {
      // Validate data existence
      const dataError = !hasValidData ? OptionSetErrors.MISSING_OPTION_ADDED : null
      setValidationErrors(layerId, keyOptionSetDataError, dataError)

      // Validate individual option set items
      if (optionSetItems.length > 0) {
        optionSetItems.forEach((item: any) => {
          const keyOptionSetItemNameError = getKeyError(optionSet, OptionSetErrorKeys.OPTION_SET_ITEM_NAME, item._id)
          const itemError = !item.name ? OptionSetErrors.TEXT_VALUE_IS_REQUIRED : null
          setValidationErrors(layerId, keyOptionSetItemNameError, itemError)
        })
      }
    }
  }

  useEffect(() => {
    // Perform validation and refresh the editor canvas
    if (!doNotValidate) {
      validateOptionSet()
      forceRefreshEditorCanvas()
    }
  }, [labelOnStoreFront, label, hasValidData, layerId, optionSetItems?.length])
}
