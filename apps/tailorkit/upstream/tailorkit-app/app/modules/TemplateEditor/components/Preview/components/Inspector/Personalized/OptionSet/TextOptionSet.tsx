import { type TLayerStore } from '~/stores/modules/layer'
import { type OptionSet } from '~/types/psd'
import { useCallback, useEffect, useMemo } from 'react'
import type { IOptionSetType } from 'extensions/tailorkit-src/src/shared/constants/optionSets'
import { getOptionSetFormatted } from '../../../../utils/getOptionSetFormatted'
import { tlkOptionSetClickEvent } from 'extensions/tailorkit-src/src/shared/constants/optionSets'
import { useStore } from '~/libs/external-store'
import { useTranslation } from 'react-i18next'

export const TextOptionSet = ({
  optionSet,
  onSelect,
  groupId = '',
  optionSetId,
  layerStore,
}: {
  layerStore: TLayerStore
  optionSet: OptionSet
  groupId?: string
  optionSetId?: string
  onSelect: (optionSet: OptionSet, _id: string) => void
}) => {
  const { t } = useTranslation()
  const _optionSet: IOptionSetType = getOptionSetFormatted(optionSet, t)
  const layerId = useStore(layerStore, state => state._id)

  const handleSelect = useCallback(
    (optionSet: OptionSet, id: string) => {
      onSelect(optionSet, id)
    },
    [onSelect]
  )

  const WebComponentContainer = useMemo(() => {
    if (!_optionSet?.ol?.length) return null

    return (
      <tailorkit-text-options-list
        data-option-set-data={JSON.stringify(_optionSet)}
        data-current-print-area-id={groupId}
        data-current-option-set-id={optionSetId}
        data-can-default-select={false}
      />
    )
  }, [_optionSet, groupId, optionSetId])

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
          handleSelect(optionSet, selectedOption.i)
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
      'tailorkit-text-options-list': React.DetailedHTMLProps<
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
