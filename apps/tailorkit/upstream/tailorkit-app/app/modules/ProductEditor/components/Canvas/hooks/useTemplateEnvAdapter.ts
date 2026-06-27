import { useLayoutEffect } from 'react'
import { setTemplateEnvAdapter, clearTemplateEnvAdapter } from '~/stores/modules/template/env-adapter'

interface UseTemplateEnvAdapterParams {
  mockupId: string
  printAreaId: string
  templateId: string
  enabled: boolean
}

/**
 * Hook to manage the template environment adapter
 * Declares unified editor context to template stores
 */
export function useTemplateEnvAdapter(params: UseTemplateEnvAdapterParams) {
  const { mockupId, printAreaId, templateId, enabled } = params

  useLayoutEffect(() => {
    if (!enabled || !mockupId || !printAreaId) return

    setTemplateEnvAdapter({
      getMode: () => 'unified',
      getUnifiedParams: () => ({
        mockupId,
        printAreaId,
        templateId,
      }),
    })

    return () => {
      clearTemplateEnvAdapter()
    }
  }, [mockupId, printAreaId, templateId, enabled])
}
