import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useUnifiedSave from './useUnifiedSave'
import { showGenericErrorToast, showToast } from '~/utils/toastEvents'
import { authenticatedFetch } from '~/shopify/fns.client'
import { EActionType } from '~/constants/fetcher-keys'
import { TOAST } from '~/constants/toasts'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import type { Template } from '~/types/psd'

interface UseUnifiedPublishResult {
  publishing: boolean
  publishCurrentOnly: () => Promise<void>
  publishAll: (sharedIntegrationIds: string[]) => Promise<void>
}

/**
 * Hook that extends useUnifiedSave with publish/republish capabilities
 *
 * Provides:
 * - publishCurrentOnly: Save templates + publish current integration only
 * - publishAll: Save templates + publish current + republish all shared integrations
 */
export function useUnifiedPublish(): UseUnifiedPublishResult {
  const { t } = useTranslation()
  const { trackEvent } = useEventsTracking()

  const { saveAll, publishIntegration } = useUnifiedSave()
  const [publishing, setPublishing] = useState(false)

  /**
   * Publish only the current integration
   * 1. Save all edited templates
   * 2. Publish current integration
   */
  const publishCurrentOnly = useCallback(async () => {
    try {
      setPublishing(true)

      // First save all changes (templates + integration)
      await saveAll()

      // Show publishing toast before publishing
      showToast(t(TOAST.UNIFIED_EDITOR.PUBLISHING))

      // Then publish the integration
      await publishIntegration()

      showToast(t(TOAST.UNIFIED_EDITOR.PUBLISHED))

      // Track event when the unified editor is published
      const integration = IntegrationStore.getState()
      const productId = integration.variants[0].product?.id?.split('/').pop()
      const productName = integration.variants[0].product?.title
      const variantId = integration.variants?.map(v => v._id) || []
      const templateId = integration.variants[0].printAreas.map(p => (p.template as Template)?._id) || []

      trackEvent(EVENTS_TRACKING.PUBLISH_PRODUCT, {
        [EVENTS_PARAMETERS_NAME.TYPE]: 'unified_editor',
        [EVENTS_PARAMETERS_NAME.VALUE]: 'publish_current_only',
        productId,
        variantId,
        templateId,
        productName,
        variantsCount: variantId.length,
        printAreasCount: templateId.length,
      })
    } catch (error) {
      console.error('Failed to publish integration:', error)
      showGenericErrorToast()
      throw error
    } finally {
      setPublishing(false)
    }
  }, [saveAll, publishIntegration, t, trackEvent])

  /**
   * Publish current integration and republish all integrations that share templates
   * 1. Save all edited templates
   * 2. Publish current integration
   * 3. Republish all shared integrations
   */
  const publishAll = useCallback(
    async (sharedIntegrationIds: string[]) => {
      try {
        setPublishing(true)

        // First save all changes (templates + integration)
        await saveAll()

        // Show publishing toast before publishing
        showToast(t(TOAST.UNIFIED_EDITOR.PUBLISHING_ALL))

        // Then publish the current integration
        await publishIntegration()

        // Finally, republish all shared integrations
        if (sharedIntegrationIds.length > 0) {
          for (const integrationId of sharedIntegrationIds) {
            const formData = new FormData()
            formData.append('action', EActionType.PUBLISH_PRODUCT)
            formData.append('integrationId', integrationId)

            const response = await authenticatedFetch('/api/integration', {
              method: 'POST',
              body: formData,
            })

            if (!response.success) {
              console.error(`Failed to republish integration ${integrationId}:`, response.message)
              // Continue with other integrations even if one fails
            }
          }
        }

        showToast(
          t(
            sharedIntegrationIds.length > 0
              ? TOAST.UNIFIED_EDITOR.PUBLISHED_AND_REPUBLISHED_ALL
              : TOAST.UNIFIED_EDITOR.PUBLISHED
          )
        )

        // Track event when the unified editor is published
        const integration = IntegrationStore.getState()
        const productId = integration.variants[0].product?.id?.split('/').pop()
        const productName = integration.variants[0].product?.title
        const variantId = integration.variants?.map(v => v._id) || []
        const templateId = integration.variants[0].printAreas.map(p => (p.template as Template)?._id) || []

        trackEvent(EVENTS_TRACKING.PUBLISH_PRODUCT, {
          [EVENTS_PARAMETERS_NAME.TYPE]: 'unified_editor',
          [EVENTS_PARAMETERS_NAME.VALUE]: 'publish_all',
          productId,
          variantId,
          templateId,
          productName,
          variantsCount: variantId.length,
          printAreasCount: templateId.length,
          sharedIntegrationsCount: sharedIntegrationIds.length,
        })
      } catch (error) {
        console.error('Failed to publish all:', error)
        showGenericErrorToast()
        throw error
      } finally {
        setPublishing(false)
      }
    },
    [saveAll, t, publishIntegration, trackEvent]
  )

  return {
    publishing,
    publishCurrentOnly,
    publishAll,
  }
}
