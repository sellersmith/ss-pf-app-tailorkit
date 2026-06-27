import { Box } from '@shopify/polaris'
import { useLayerStoreSelection } from '~/stores/modules/layer-store-selection'
import styles from '../../../../components/canvas/ToolBar/styles.module.css'
import { RenderElementStylingToolbar } from '../../elements/render.client'

export default function StylingToolBarContainer() {
  const { clickedLayerStore } = useLayerStoreSelection()

  if (!clickedLayerStore) return null

  return (
    <div id="styling-toolbar" className={styles.ToolBelt} style={{ bottom: 'unset', top: '12px', width: '100%' }}>
      <Box borderRadius="200" background="bg-surface" padding="100" shadow="border-inset">
        <RenderElementStylingToolbar layerStore={clickedLayerStore} />
      </Box>
    </div>
  )
}
