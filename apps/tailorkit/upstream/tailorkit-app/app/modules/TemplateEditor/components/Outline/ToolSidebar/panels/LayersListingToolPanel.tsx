import { useStore } from '~/libs/external-store'
import type { TLayerStore } from '~/stores/modules/layer'
import { TemplateEditorStore } from '~/stores/modules/template'
import { useTranslation } from 'react-i18next'
import Outline from '../..'
import { ToolPanelWrapper } from '../components/ToolPanelWrapper'

/**
 * Layers Listing Tool Panel - Display template layers in the sidebar
 *
 * Uses Outline component with noScroll prop to prevent nested scroll containers.
 * The parent ToolSidebar handles all scrolling.
 */
export default function LayersListingToolPanel() {
  const { t } = useTranslation()
  const extractedLayerStores: TLayerStore[] = useStore(TemplateEditorStore, state => state.extractedLayerStores)

  return (
    <ToolPanelWrapper>
      <Outline t={t} extractedLayerStores={extractedLayerStores} />
    </ToolPanelWrapper>
  )
}
