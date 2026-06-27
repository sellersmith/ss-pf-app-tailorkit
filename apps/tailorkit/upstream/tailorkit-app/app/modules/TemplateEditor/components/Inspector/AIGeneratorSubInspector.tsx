import { Box } from '@shopify/polaris'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '~/libs/external-store'
import { SubInspector } from './SubInspector'
import { SubInspectorStore } from '~/stores/canvas/subInspector'
import { AIImageInspectorPanel } from '../../elements/components/common/StylingInspector/AIImageInspectorPanel'

/**
 * Global AI Generator Sub-Inspector
 * Always mounted component that opens when SubInspectorStore.key === 'ai-image-inspector'
 */
export function AIGeneratorSubInspector() {
  const { t } = useTranslation()
  const keySubInspector = useStore(SubInspectorStore, state => state.key)
  const subInspectorData = useStore(SubInspectorStore, state => state.data)

  const isOpen = keySubInspector === 'ai-image-inspector'

  const handleClose = useCallback(() => {
    SubInspectorStore.dispatch({ type: 'CLOSE_SUB_INSPECTOR' })
  }, [])

  const title = subInspectorData?.title || t('ai-image')

  return (
    <SubInspector
      key={'ai-image-inspector'}
      title={title}
      onClose={handleClose}
      isOpen={isOpen}
      styles={{ overflow: 'auto' }}
    >
      <Box paddingBlock={'100'} paddingInline={'300'}>
        <AIImageInspectorPanel />
      </Box>
    </SubInspector>
  )
}
