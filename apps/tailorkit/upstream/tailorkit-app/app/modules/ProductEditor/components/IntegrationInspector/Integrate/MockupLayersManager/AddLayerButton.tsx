import { Button, EmptyState, OptionList, Popover, Text } from '@shopify/polaris'
import { PlusIcon } from '@shopify/polaris-icons'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ILLUSTRATORS } from '~/constants/assets-url'
import type { WithVariantsProps } from '~/modules/ProductEditor/withMockup'
import withMockup from '~/modules/ProductEditor/withMockup'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import type { LayerIntegration } from '~/types/integration'

interface IAddLayerButtonProps extends WithVariantsProps {}

function AddLayerButton(props: IAddLayerButtonProps) {
  const { variants } = props
  const { t } = useTranslation()
  const [popoverActive, setPopoverActive] = useState(false)

  const mockup = variants[0]?.mockup
  const selectedViewId = mockup?.selectedViewId
  const selectedView = mockup?.views?.find(view => view._id === selectedViewId) || mockup?.views?.[0]

  const layerItems = useMemo(() => {
    const layersOnView = selectedView?.layers?.map((layer: any) => (typeof layer === 'string' ? layer : layer._id))
    const baseLayersOnMockup = mockup?.layers
      ?.map(layer => (typeof layer.getState === 'function' ? layer.getState() : layer) as LayerIntegration)
      .filter(layer => layer.printAreaId)
    const printAreasSet = new Map(variants[0]?.printAreas?.map(printArea => [printArea._id, printArea.name]))

    return baseLayersOnMockup?.map(layer => ({
      value: layer._id,
      label: layer.printAreaId ? printAreasSet.get(layer.printAreaId) : '',
      disabled: layersOnView?.includes(layer._id),
    }))
  }, [mockup?.layers, selectedView?.layers, variants])

  const selectedLayerItems = useMemo(() => {
    return layerItems.filter(layer => layer.disabled).map(layer => layer.value)
  }, [layerItems])

  const togglePopoverActive = useCallback(() => {
    setPopoverActive(pre => !pre)
  }, [])

  const onAddMoreLayer = (selectedIds: string[]) => {
    const layersToAdd = layerItems.filter(layer => selectedIds.includes(layer.value) && !layer.disabled)
    if (selectedViewId) {
      IntegrationStore.dispatch({
        type: 'ADD_LAYER_TO_VIEW',
        payload: { mockupId: mockup?._id, viewId: selectedViewId, layerId: layersToAdd.map(layer => layer.value) },
      })
    }
  }

  const activator = (
    <Button variant="plain" icon={PlusIcon} size="slim" onClick={togglePopoverActive}>
      {t('add-layer')}
    </Button>
  )

  return (
    <Popover activator={activator} active={popoverActive} onClose={togglePopoverActive}>
      {layerItems.length > 0 ? (
        <OptionList options={layerItems} onChange={onAddMoreLayer} selected={selectedLayerItems} allowMultiple />
      ) : (
        <EmptyState image={ILLUSTRATORS.SEARCH_IMAGE}>
          <Text as="p" variant="bodyMd">
            {t('no-layers-available')}
          </Text>
        </EmptyState>
      )}
    </Popover>
  )
}

export default withMockup(AddLayerButton)
