import { useSearchParams } from '@remix-run/react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { deleteFileFromIDB, getJSONFromIDB, openIDBDatabase, storeJSONFileToIDB } from '~/bootstrap/db/index-db'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EActionType } from '~/constants/fetcher-keys'
import { IDB_DATABASE_NAME, IDB_STORE_NAME } from '~/constants/index-db'
import { getVariantsUpdatedAfterSelectingTemplate } from '~/stores/modules/integration/fns'
import type { Integration } from '~/types/integration'
import { sendMessageToMainApp } from '~/utils/modalEvents'
import { TEMPLATE_EDITOR_CTA_IDS } from '../../constants'
// eslint-disable-next-line max-len
import { getEssentialAttributesOfTemplateForPrintArea } from '~/modules/ProductEditor/components/IntegrationInspector/Integrate/ModalTemplateSelection/fns'
import type { Template } from '~/types/psd'

export function BackToProductButton() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)

  // Get fallback url from search params
  const [searchParams] = useSearchParams()
  const fallbackUrl = searchParams.get('fallback-url')

  const { trackEvent } = useEventsTracking()

  const handleSaveTemporaryIntegration = useCallback(
    async (template: Template) => {
      if (!template) {
        return
      }

      // Get current print area id and mockup id from fallback url
      const origin = window.location.origin
      const url = new URL(fallbackUrl || '', origin)
      const printAreaId = url.searchParams.get('printArea') || ''
      const mockupId = url.searchParams.get('mockup') || ''

      // Get temporary integration in idb
      const db = await openIDBDatabase(IDB_DATABASE_NAME.INTEGRATION, IDB_STORE_NAME.INTEGRATION_TEMPORARY)
      const temporaryIntegration = (await getJSONFromIDB(
        db,
        IDB_STORE_NAME.INTEGRATION_TEMPORARY,
        mockupId
      )) as Integration

      if (temporaryIntegration) {
        const essentialTemplateAttributes = getEssentialAttributesOfTemplateForPrintArea(template) as Template

        if (window.savedTemplateUseAiFeature) {
          essentialTemplateAttributes.metadata = {
            ...essentialTemplateAttributes.metadata,
            useAiFeature: window.savedTemplateUseAiFeature,
          }

          delete window.savedTemplateUseAiFeature
        }

        const updatedVariants = getVariantsUpdatedAfterSelectingTemplate(
          mockupId,
          printAreaId,
          temporaryIntegration.variants,
          essentialTemplateAttributes
        )

        // Remove temporary integration from idb
        await deleteFileFromIDB(db, IDB_STORE_NAME.INTEGRATION_TEMPORARY, mockupId)

        // Store updated variants to idb
        await storeJSONFileToIDB(
          db,
          IDB_STORE_NAME.INTEGRATION_TEMPORARY,
          {
            ...temporaryIntegration,
            variants: updatedVariants,
          },
          mockupId
        )
      }
    },
    [fallbackUrl]
  )

  const onBackToProduct = useCallback(async () => {
    const template = window.savedTemplate

    if (template) {
      trackEvent(EVENTS_TRACKING.BACK_TO_PRODUCT, {
        fallbackUrl,
      })

      setLoading(true)

      // Save temporary integration
      await handleSaveTemporaryIntegration(template)

      setLoading(false)

      // Send message to main app to navigate to the template creation page
      sendMessageToMainApp(JSON.stringify({ type: EActionType.NAVIGATE_MAX_MODAL, url: fallbackUrl }))
    }

    // Send message to main app to navigate to the template creation page
    sendMessageToMainApp(JSON.stringify({ type: EActionType.NAVIGATE_MAX_MODAL, url: fallbackUrl }))
  }, [fallbackUrl, handleSaveTemporaryIntegration, trackEvent])

  if (!fallbackUrl) {
    return null
  }

  return (
    <div style={{ display: 'none' }}>
      <s-button
        id={TEMPLATE_EDITOR_CTA_IDS.BACK_TO_PRODUCT}
        variant="secondary"
        onClick={onBackToProduct}
        loading={loading}
      >
        {t('back-to-product')}
      </s-button>
    </div>
  )
}
