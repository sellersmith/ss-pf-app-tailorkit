import { Button, Icon, InlineStack, Tooltip } from '@shopify/polaris'
import { DeleteIcon, DuplicateIcon } from '@shopify/polaris-icons'
import { useMemo } from 'react'
import { useLayerActions } from '../../hooks/useLayerActions'
import { useLayerStoreSelection } from '~/stores/modules/layer-store-selection'
import { useTranslation } from 'react-i18next'
import { FlexCenter } from '~/components/common/Flex'
import { LayerStores } from '~/stores/modules/layer'
import { checkLayerInsideMultiLayout } from '../../elements/fns'

export function LayerActionButtons(props: { layerId?: string }) {
  const { layerId: providedLayerId } = props
  const { clickedLayerStore } = useLayerStoreSelection()
  const { onDuplicateItem, onDeleteItem } = useLayerActions()

  const { t } = useTranslation()

  const layerId = useMemo(
    () => providedLayerId || clickedLayerStore?.getState()._id,
    [providedLayerId, clickedLayerStore]
  )

  // Check if current layer is a child of any multi-layout
  const isInsideMultiLayout = useMemo(() => {
    if (!layerId || !clickedLayerStore) return false

    const allLayers = Array.from(LayerStores.values()).map(store => store.getState() as any)
    const result = checkLayerInsideMultiLayout(clickedLayerStore.getState() as any, allLayers)
    return result.isLayerInsideMultiLayout
  }, [layerId, clickedLayerStore])

  if (!layerId) return null

  return (
    <InlineStack gap="050" wrap={false}>
      <Tooltip content={t('duplicate')}>
        <FlexCenter>
          <Button
            variant="tertiary"
            onClick={() => onDuplicateItem(layerId)}
            icon={<Icon source={DuplicateIcon} tone="subdued" />}
          />
        </FlexCenter>
      </Tooltip>

      {!isInsideMultiLayout && (
        <Tooltip content={t('delete')}>
          <FlexCenter>
            <Button
              variant="tertiary"
              tone="critical"
              onClick={() => onDeleteItem(layerId)}
              icon={<Icon source={DeleteIcon} tone="critical" />}
            />
          </FlexCenter>
        </Tooltip>
      )}
    </InlineStack>
  )
}

export default LayerActionButtons
