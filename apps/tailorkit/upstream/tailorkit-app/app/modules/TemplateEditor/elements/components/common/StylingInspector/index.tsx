import { Box } from '@shopify/polaris'
import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '~/libs/external-store'
import { SubInspector } from '~/modules/TemplateEditor/components/Inspector/SubInspector'
import { SubInspectorStore } from '~/stores/canvas/subInspector'
import { LayerStoreSelection } from '~/stores/modules/layer-store-selection'
import type TemplateElement from '../..'
import { renderPanel } from './panelRegistry'

interface IStylingInspectorProps {
  id: string
  element: TemplateElement<any, any> // Current template element instance
}

export default function StylingInspectorContainer(props: IStylingInspectorProps) {
  const { id, element } = props
  const { t } = useTranslation()

  const keySubInspector = useStore(SubInspectorStore, state => state.key)
  const subInspectorData = useStore(SubInspectorStore, state => state.data)
  const clickedLayerStore = useStore(LayerStoreSelection, state => state.clickedLayerStore)

  // Is open if the key of sub inspector is the same as the id
  const isOpen = keySubInspector === id

  const handleCloseSubInspector = useCallback(() => {
    SubInspectorStore.dispatch({ type: 'CLOSE_SUB_INSPECTOR' })
  }, [])

  useEffect(() => {
    // When the clicked layer store changes, close the sub inspector
    handleCloseSubInspector()
  }, [handleCloseSubInspector, clickedLayerStore])

  const title = subInspectorData?.title || 'Styling'

  const isOpenInspector = isOpen && subInspectorData
  // Render panel using registry with fresh element state - NO STORED JSX!
  const children = isOpenInspector
    ? subInspectorData.panel
      ? renderPanel(subInspectorData.panel, { element, clickedLayerStore, t, data: subInspectorData })
      : subInspectorData.content // Fallback for panels that don't use panel registry yet
    : null

  return (
    <SubInspector key={id} title={title} onClose={() => handleCloseSubInspector()} isOpen={isOpen}>
      <Box paddingBlock={'100'} paddingInline={'300'}>
        {children}
      </Box>
    </SubInspector>
  )
}
