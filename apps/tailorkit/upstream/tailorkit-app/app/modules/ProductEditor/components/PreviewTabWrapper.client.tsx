import type { ReactNode } from 'react'
import { TemplateLayerStoresProviderWrapper } from './Preview/index.client'
import { useStore } from '~/libs/external-store'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import { useMemo } from 'react'
import { useEditorParams } from '../hooks/useEditorParams'

interface PreviewTabWrapperProps {
  children: ReactNode
}

/**
 * Wrapper that provides TemplateLayerStoresContext to the entire Preview tab
 * Ensures both canvas and inspector can access live template layer stores
 */
export default function PreviewTabWrapper({ children }: PreviewTabWrapperProps) {
  const { mockupId } = useEditorParams()

  const allVariants = useStore(IntegrationStore, state => state.variants)
  const variants = useMemo(
    () =>
      allVariants.filter(v => {
        const id = typeof (v as any).mockup === 'string' ? (v as any).mockup : (v as any).mockup?._id
        return id === mockupId
      }),
    [allVariants, mockupId]
  )

  return (
    <TemplateLayerStoresProviderWrapper mockupId={mockupId} variants={variants}>
      {children}
    </TemplateLayerStoresProviderWrapper>
  )
}
