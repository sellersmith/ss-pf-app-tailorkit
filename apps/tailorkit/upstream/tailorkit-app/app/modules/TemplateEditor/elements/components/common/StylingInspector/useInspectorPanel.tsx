import { useCallback } from 'react'
import { useStore } from '~/libs/external-store'
import { subInspectorStoreActions, SubInspectorStore } from '~/stores/canvas/subInspector'

/**
 * Simple hook to open styling inspector panels
 * ONLY stores panel ID and title - content is rendered fresh using panel registry
 * No JSX content stored = no stale prop issues!
 */
export function useInspectorPanel(panelId: string, title: string) {
  const subKey = useStore(SubInspectorStore, state => state.key)
  const subData = useStore(SubInspectorStore, state => state.data)
  const isOpenThisPanel = subKey === 'styling-inspector' && subData?.panel === panelId

  // Open inspector function - stores only panel ID and title (NO CONTENT!)
  const openInspector = useCallback(() => {
    subInspectorStoreActions.openSubInspector('styling-inspector', {
      title,
      panel: panelId,
    })
  }, [title, panelId])

  return { openInspector, isOpen: isOpenThisPanel }
}
