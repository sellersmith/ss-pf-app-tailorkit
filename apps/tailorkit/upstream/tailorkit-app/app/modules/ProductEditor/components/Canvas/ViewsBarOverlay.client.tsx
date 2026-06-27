import { useMemo } from 'react'
import { useStore } from '~/libs/external-store'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import ViewsBar from '../HeaderBar/ViewsBar.client'
import { useEditorParams } from '../../hooks/useEditorParams'
import useDevices from '~/utils/hooks/useDevice'

export default function ViewsBarOverlay() {
  const { mockupId } = useEditorParams()
  const variants = useStore(IntegrationStore, state => state.variants)
  const { isSmallMobileView } = useDevices()

  const hasMultipleViews = useMemo(() => {
    if (!Array.isArray(variants) || variants.length === 0) return false
    const activeVariant = variants.find(v => v.mockup._id === mockupId) || variants[0]
    const mockup = activeVariant?.mockup as any
    const views = Array.isArray(mockup?.views) ? mockup.views : []
    return views.length > 1
  }, [variants, mockupId])

  if (!hasMultipleViews) return null

  return (
    <div
      id="views-bar-overlay"
      style={{
        position: 'absolute',
        overflowX: 'auto',
        overflowY: 'hidden',
        bottom: isSmallMobileView ? 'var(--p-space-1600)' : 'var(--p-space-300)',
        left: 'var(--p-space-300)',
        zIndex: 10,
        pointerEvents: 'auto',
        borderRadius: 'var(--p-border-radius-200)',
        background: 'var(--p-color-bg-surface)',
        boxShadow: 'var(--p-shadow-200)',
        border: 'var(--p-border-width-025) solid var(--p-color-border-secondary)',
        maxWidth: '70%',
      }}
    >
      <ViewsBar />
    </div>
  )
}
