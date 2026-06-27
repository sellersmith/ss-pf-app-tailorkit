import { Box } from '@shopify/polaris'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '~/libs/external-store'
import { SubInspector } from './SubInspector'
import { SubInspectorStore } from '~/stores/canvas/subInspector'
import { ClipartsInspector } from './Cliparts/index.client'
import BulkImageOptionSetCreator from './BulkImageOptionSet/index.client'

type LibraryToolType = 'clipart' | 'image-option-set'

export function LibraryToolsSubInspector() {
  const { t } = useTranslation()
  const keySubInspector = useStore(SubInspectorStore, state => state.key)
  const subInspectorData = useStore(SubInspectorStore, state => state.data) as
    | { tool?: LibraryToolType; title?: string }
    | undefined

  const isOpen = keySubInspector === 'library-tools'

  const handleClose = useCallback(() => {
    SubInspectorStore.dispatch({ type: 'CLOSE_SUB_INSPECTOR' })
  }, [])

  const tool: LibraryToolType = (subInspectorData?.tool as LibraryToolType) || 'clipart'

  const title = useMemo(() => {
    if (subInspectorData?.title) return subInspectorData.title
    return tool === 'clipart' ? t('create-clipart') : t('create-image-option-set')
  }, [subInspectorData?.title, t, tool])

  return (
    <SubInspector
      key={'library-tools'}
      title={title}
      onClose={handleClose}
      isOpen={isOpen}
      wrapperAttr="#tool-sidebar"
      styles={{ overflow: 'auto' }}
    >
      <Box paddingBlock={'100'} paddingInline={'300'}>
        {tool === 'clipart' ? <ClipartsInspector defaultOpen={true} /> : <BulkImageOptionSetCreator />}
      </Box>
    </SubInspector>
  )
}

export default LibraryToolsSubInspector
