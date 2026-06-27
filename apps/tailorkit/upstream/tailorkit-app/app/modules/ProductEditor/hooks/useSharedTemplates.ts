import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '~/libs/external-store'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import { IntegrationsService } from '~/api/services/integrations'

interface SharedTemplatesResult {
  hasSharedTemplates: boolean
  sharedIntegrationIds: string[]
  loading: boolean
  refetch: () => Promise<void>
}

/**
 * Hook to detect if current integration's templates are shared with other published products
 *
 * Returns:
 * - hasSharedTemplates: boolean indicating if any templates are shared
 * - sharedIntegrationIds: array of integration IDs that share templates
 * - loading: loading state
 * - refetch: function to manually refresh the data
 */
export function useSharedTemplates(integrationId: string): SharedTemplatesResult {
  const [loading, setLoading] = useState(true)
  const [sharedIntegrationIds, setSharedIntegrationIds] = useState<string[]>([])

  // Subscribe to integration state to detect when templates change
  const variants = useStore(IntegrationStore, state => state.variants)

  // Track the last fetched template IDs to prevent duplicate calls
  const lastFetchedTemplateIdsRef = useRef<string>('')

  // Memoize template IDs from variants to avoid recalculating on every render
  const templateIds = useMemo(() => {
    const ids = new Set<string>()
    variants.forEach(variant => {
      variant.printAreas?.forEach(printArea => {
        if (printArea.template && typeof printArea.template === 'object' && printArea.template._id) {
          ids.add(printArea.template._id)
        }
      })
    })
    return Array.from(ids).sort()
  }, [variants])

  // Create a stable key from template IDs for comparison
  const templateIdsKey = useMemo(() => templateIds.join(','), [templateIds])

  const fetchSharedTemplates = useCallback(async () => {
    if (!integrationId) {
      setLoading(false)
      return
    }

    // Skip fetch if template IDs haven't changed
    if (lastFetchedTemplateIdsRef.current === templateIdsKey) {
      return
    }

    try {
      setLoading(true)

      if (templateIds.length === 0) {
        setSharedIntegrationIds([])
        lastFetchedTemplateIdsRef.current = templateIdsKey
        setLoading(false)
        return
      }

      // Call API using IntegrationsService
      const { sharedIntegrationIds: ids } = await IntegrationsService.checkSharedTemplatesWithPublished(
        integrationId,
        templateIds
      )

      setSharedIntegrationIds(ids)
      lastFetchedTemplateIdsRef.current = templateIdsKey
    } catch (error) {
      console.error('Error fetching shared templates:', error)
      setSharedIntegrationIds([])
    } finally {
      setLoading(false)
    }
  }, [integrationId, templateIdsKey, templateIds])

  // Fetch when integration ID or template IDs change
  useEffect(() => {
    fetchSharedTemplates()
  }, [fetchSharedTemplates])

  return {
    hasSharedTemplates: sharedIntegrationIds.length > 0,
    sharedIntegrationIds,
    loading,
    refetch: fetchSharedTemplates,
  }
}
