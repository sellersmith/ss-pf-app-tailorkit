import { Fragment, useCallback, useEffect, useMemo } from 'react'
import { EMPTY_ARRAY } from '~/constants'
import { getLayerStoreById, type TLayerStore } from '~/stores/modules/layer'
import { EOptionSet, type Layout, type MULTI_LAYOUT_OPTION_SET } from '~/types/psd'
import { LayerComponent } from '.'
import type { IOptionSetType } from 'extensions/tailorkit-src/src/shared/constants/optionSets'
import { tlkOptionSetClickEvent } from 'extensions/tailorkit-src/src/shared/constants/optionSets'
import { useStore } from '~/libs/external-store'

/** Format multi-layout data into web component IOptionSetType format */
function formatMultiLayoutForWebComponent(
  optionSet: MULTI_LAYOUT_OPTION_SET,
  layouts: Layout[],
  layoutSelected: string,
  displayStyle: string
): IOptionSetType {
  return {
    i: optionSet._id,
    t: EOptionSet.MULTI_LAYOUT_OPTION,
    l: optionSet.labelOnStoreFront || 'Layout',
    displayStyle,
    ol: layouts.map(layout => ({
      i: layout._id,
      v: layout.name,
      l: layout.name,
      t: layout.thumbnail,
      ls: layout.layerIds,
      selecting: layout._id === layoutSelected,
    })),
  }
}

interface IMultiLayoutProps {
  label?: string
  layerStore: TLayerStore
  optionSet: MULTI_LAYOUT_OPTION_SET
  previewMode?: boolean
  groupId?: string
}

export const MultiLayout = (props: IMultiLayoutProps) => {
  const { label, layerStore, optionSet, previewMode, groupId } = props
  const { data } = optionSet

  const multi_layout = data?.multi_layout

  const layoutSelected = multi_layout?.layoutSelected || ''
  const layouts: Layout[] = multi_layout?.layouts || EMPTY_ARRAY

  const displayStyle = data?.displayStyle || 'multi_layout_swatch'
  const layerId = useStore(layerStore, state => state._id)
  const optionSetId = optionSet._id

  const layoutSelectedData = useMemo(
    () => (layouts || EMPTY_ARRAY).find(layout => layout._id === layoutSelected),
    [layoutSelected, layouts]
  )

  const onSelect = useCallback(
    (layoutId: string) => {
      if (!multi_layout) return

      layerStore.dispatch({
        type: 'UPDATE_OPTION_SET',
        payload: {
          optionSet: {
            ...optionSet,
            data: {
              multi_layout: {
                ...multi_layout,
                layoutSelected: layoutId,
              },
            },
          },
        },
        skipTrace: true, // Preview layout selection is UI state, not saveable data
      })
    },
    [layerStore, multi_layout, optionSet]
  )

  // Format data for web component — router handles swatch vs dropdown internally
  const _optionSet: IOptionSetType = useMemo(
    () => formatMultiLayoutForWebComponent(optionSet, layouts, layoutSelected, displayStyle),
    [optionSet, layouts, layoutSelected, displayStyle]
  )

  // Always render web component — router handles swatch vs dropdown
  const WebComponentContainer = useMemo(() => {
    if (!_optionSet?.ol?.length) return null

    return (
      <tailorkit-multi-layout-options-list
        data-option-set-data={JSON.stringify(_optionSet)}
        data-current-print-area-id={groupId}
        data-current-option-set-id={optionSetId}
        data-can-default-select={false}
      />
    )
  }, [_optionSet, groupId, optionSetId])

  // Listen for web component selection events
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
          onSelect(selectedOption.i)
        }
      }
    }

    document.addEventListener(tlkOptionSetClickEvent, handleOptionSetClick as EventListener)
    return () => {
      document.removeEventListener(tlkOptionSetClickEvent, handleOptionSetClick as EventListener)
    }
  }, [groupId, onSelect, layerId, optionSet])

  if (!data) {
    return null
  }

  return (
    <Fragment>
      <h3 className="emtlkit--option-set-label" data-label={label} data-changeable="false">
        {label}
        {layoutSelectedData ? `: ${layoutSelectedData.name}` : ''}
      </h3>

      <div className="emtlkit--d-flex emtlkit--flex-column emtlkit--gap-8 emtlkit--flex-wrap">
        {WebComponentContainer}

        {layoutSelectedData
          ? layoutSelectedData.layerIds.map(layerId => {
              const layerStore = getLayerStoreById(layerId)

              if (!layerStore) return null

              return (
                <LayerComponent key={layerId} layerStore={layerStore} previewMode={previewMode} groupId={groupId} />
              )
            })
          : null}
      </div>
    </Fragment>
  )
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'tailorkit-multi-layout-options-list': React.DetailedHTMLProps<
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
