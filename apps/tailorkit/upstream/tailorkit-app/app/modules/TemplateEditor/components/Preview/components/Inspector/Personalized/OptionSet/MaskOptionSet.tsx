import type { OptionSet } from '~/types/psd'
import { useCallback, useEffect, useMemo } from 'react'
import { getOptionSetFormatted } from '../../../../utils/getOptionSetFormatted'
import { tlkOptionSetClickEvent } from 'extensions/tailorkit-src/src/shared/constants/optionSets'
import { useStore } from '~/libs/external-store'
import type { TLayerStore } from '~/stores/modules/layer'
import { useTranslation } from 'react-i18next'

export const MaskOptionSet = ({
  optionSet,
  onSelect,
  groupId = '',
  optionSetId,
  layerStore,
}: {
  optionSet: OptionSet
  groupId?: string
  optionSetId?: string
  onSelect: (optionSet: OptionSet, _id: string) => void
  layerStore: TLayerStore
}) => {
  const { t } = useTranslation()
  const layerId = useStore(layerStore, state => state._id)
  const _optionSet = useMemo(() => getOptionSetFormatted(optionSet, t), [optionSet, t])
  const optionSetType = optionSet.type

  const handleSelect = useCallback(
    (optionSet: OptionSet, id: string) => {
      onSelect(optionSet, id)
    },
    [onSelect]
  )

  const WebComponentContainer = useMemo(() => {
    if (!_optionSet?.ol?.length) return null

    return (
      <tailorkit-image-options-list
        data-option-set-data={JSON.stringify(_optionSet)}
        data-current-print-area-id={groupId}
        data-current-option-set-id={optionSetId}
        data-option-set-type={optionSetType}
        data-can-default-select={'true'}
        data-preview-mode={'true'}
      />
    )
  }, [_optionSet, groupId, optionSetId, optionSetType])

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
