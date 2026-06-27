import type { ImagelessOptionSet as ImagelessOptionSetType, IMAGELESS_OPTION_SET } from '~/types/psd'
import type { IOptionSetComponentProps } from '.'
import { useCallback, useEffect, useLayoutEffect, useMemo } from 'react'
import type { IOptionSetType } from 'extensions/tailorkit-src/src/shared/constants/optionSets'
import { tlkOptionSetClickEvent } from 'extensions/tailorkit-src/src/shared/constants/optionSets'
import { getOptionSetFormatted } from '../../../../utils/getOptionSetFormatted'
import { useStore } from '~/libs/external-store'
import { useTranslation } from 'react-i18next'

export const ImagelessOptionSet = (props: IOptionSetComponentProps) => {
  const { optionSet, onSelect, layerStore, groupId, currencyCode } = props
  const { t } = useTranslation()
  const values = useMemo(
    () => ((optionSet?.data as { values?: ImagelessOptionSetType[] })?.values || []) as ImagelessOptionSetType[],
    [optionSet?.data]
  )
  const layerId = useStore(layerStore, state => state._id)
  const optionSetId = optionSet._id

  const displayStyle = (optionSet?.data as IMAGELESS_OPTION_SET['data'])?.displayStyle || 'imageless_swatch'
  const isCheckbox = displayStyle === 'imageless_checkbox'

  // Auto-select first option if none selected. Use requestAnimationFrame instead
  // of 500ms timeout to avoid race with conditional logic visibility evaluation.
  // Skip auto-select for checkbox display style — checkbox starts unchecked by default.
  useLayoutEffect(() => {
    if (isCheckbox) return
    if (!values.some(value => value.selecting) && values[0]?._id) {
      requestAnimationFrame(() => onSelect(optionSet, values[0]._id))
    }
  }, [isCheckbox, onSelect, optionSet, values])

  const handleSelect = useCallback(
    (optionSet_: typeof optionSet, id: string) => {
      onSelect(optionSet_, id)
    },
    [onSelect]
  )

  // Format data for web component, enriched with thumbnail for swatch rendering
  const _optionSet: IOptionSetType = useMemo(() => {
    const base = getOptionSetFormatted(optionSet, t)
    return {
      ...base,
      ol: base.ol.map((item, index) => ({
        ...item,
        t: values[index]?.thumbnail || '',
      })),
    }
  }, [optionSet, t, values])

  // Always render web component — router handles swatch vs dropdown internally
  const WebComponentContainer = useMemo(() => {
    if (!_optionSet?.ol?.length) return null

    return (
      <tailorkit-imageless-options-list
        data-option-set-data={JSON.stringify(_optionSet)}
        data-current-print-area-id={groupId}
        data-current-option-set-id={optionSetId}
        data-can-default-select={false}
        data-currency-code={currencyCode}
      />
    )
  }, [_optionSet, groupId, optionSetId, currencyCode])

  // Handle checkbox uncheck — clear all selecting flags via TOGGLE_OPTION_SELECTING
  const handleDeselect = useCallback(() => {
    const selectedValue = values.find(v => v.selecting)
    if (selectedValue) {
      layerStore.dispatch({
        type: 'TOGGLE_OPTION_SELECTING',
        payload: { optionSet, _id: selectedValue._id },
      })
    }
  }, [layerStore, optionSet, values])

  // Listen for web component selection events
  useEffect(() => {
    const handleOptionSetClick = (event: Event) => {
      const { detail } = event as CustomEvent
      if (
        detail?.optionSet?.i === optionSet._id
        && detail?.currentPrintAreaId === groupId
        && detail?.currentLayerId === layerId
      ) {
        const selectedOption = detail.optionSet.ol?.find((opt: any) => opt.selecting)

        if (selectedOption) {
          handleSelect(optionSet, selectedOption.i)
        } else {
          // Checkbox unchecked — clear selection to trigger conditional logic re-evaluation
          handleDeselect()
        }
      }
    }

    document.addEventListener(tlkOptionSetClickEvent, handleOptionSetClick as EventListener)
    return () => {
      document.removeEventListener(tlkOptionSetClickEvent, handleOptionSetClick as EventListener)
    }
  }, [groupId, handleDeselect, handleSelect, layerId, optionSet])

  return WebComponentContainer
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'tailorkit-imageless-options-list': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          ref?: React.RefObject<HTMLElement>
          'data-option-set-data'?: string
          'data-current-print-area-id'?: string
          'data-current-option-set-id'?: string
          'data-can-default-select'?: boolean
          'data-currency-code'?: string
        },
        HTMLElement
      >
    }
  }
}
