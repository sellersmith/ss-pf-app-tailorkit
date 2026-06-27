import { type TLayerStore } from '~/stores/modules/layer'
import { type OptionSet } from '~/types/psd'
import { useCallback, useEffect, useMemo } from 'react'
import type { IOptionSetType } from 'extensions/tailorkit-src/src/shared/constants/optionSets'
import { getOptionSetFormatted } from '../../../../utils/getOptionSetFormatted'
import { tlkOptionSetClickEvent } from 'extensions/tailorkit-src/src/shared/constants/optionSets'
import { useStore } from '~/libs/external-store'
import { useTranslation } from 'react-i18next'

export const FontOptionSet = ({
  optionSet,
  layerStore,
  onSelect,
  groupId = '',
  optionSetId,
}: {
  layerStore: TLayerStore
  optionSet: OptionSet
  groupId?: string
  optionSetId?: string
  onSelect: (optionSet: OptionSet, _id: string) => void
}) => {
  const layerId = useStore(layerStore, state => state._id)
  const { t } = useTranslation()
  const defaultFont = null // useStore(layerStore, state => state.settings?.fontFamily || {})
  const _optionSet: IOptionSetType = getOptionSetFormatted(
    {
      ...optionSet,
      data: {
        ...optionSet.data,
        fonts:
          optionSet.data?.fonts?.map((font: any) => ({
            ...font,
            value: JSON.stringify({ family: font.family, src: font.src }),
            isDefault: false, //font.family === defaultFont?.family,
          })) || [],
      },
    },
    t,
    defaultFont
  )

  const handleSelect = useCallback(
    (optionSet: OptionSet, id: string) => {
      onSelect(optionSet, id)
    },
    [onSelect]
  )

  const WebComponentContainer = useMemo(() => {
    if (!_optionSet?.ol?.length) return null

    return (
      <tailorkit-font-options-list
        data-option-set-data={JSON.stringify(_optionSet)}
        data-current-print-area-id={groupId}
        data-current-option-set-id={optionSetId}
        data-default-font={JSON.stringify(defaultFont)}
        data-can-default-select={false}
      />
    )
  }, [_optionSet, defaultFont, groupId, optionSetId])

  useEffect(() => {
    const handleOptionSetClick = (event: Event) => {
      const { detail } = event as CustomEvent
      if (detail?.optionSet?.ol) {
        const selectedOption = detail.optionSet.ol.find((opt: any) => opt.selecting)

        if (
          selectedOption
          && detail?.optionSet?.i === optionSet._id
          && detail?.currentPrintAreaId === groupId
          && detail?.currentLayerId === layerId
        ) {
          handleSelect(optionSet, selectedOption.isDefault ? undefined : selectedOption.i)
        }
      }
    }

    document.addEventListener(tlkOptionSetClickEvent, handleOptionSetClick as EventListener)

    return () => {
      document.removeEventListener(tlkOptionSetClickEvent, handleOptionSetClick as EventListener)
    }
  }, [groupId, handleSelect, layerId, optionSet])

  return WebComponentContainer
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'tailorkit-font-options-list': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          ref?: React.RefObject<HTMLElement>
          'data-option-set-data'?: string
          'data-current-print-area-id'?: string
          'data-current-option-set-id'?: string
          'data-can-default-select'?: boolean
        },
        HTMLElement
      >
    }
  }
}
