import { Button, Icon } from '@shopify/polaris'
import { HideIcon, ViewIcon } from '@shopify/polaris-icons'
import { useStore } from '~/libs/external-store'
import type { TLayerStore } from '~/stores/modules/layer'

export function LayerVisible(props: { extractedLayerStore: TLayerStore; _id: string }) {
  const { extractedLayerStore } = props

  const visible = useStore(extractedLayerStore, state => state.visible)
  const visibleIcon = visible ? ViewIcon : HideIcon

  function updateVisibleLayerById() {
    extractedLayerStore.dispatch({
      type: 'UPDATE_LAYER',
      payload: {
        state: {
          visible: !visible,
        },
      },
    })
  }

  return (
    <div className="Visible-Icon">
      <Button icon={<Icon source={visibleIcon} />} onClick={() => updateVisibleLayerById()} variant="plain" />
    </div>
  )
}
