import { BlockStack, Modal, Text } from '@shopify/polaris'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { memo, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EActionType } from '~/constants/fetcher-keys'
import { MODAL_ID } from '~/constants/modal'
import { authenticatedFetch } from '~/shopify/fns.client'
import { useModal } from '~/utils/hooks/useModal'
import { showGenericErrorToast, showToast } from '~/utils/toastEvents'
import { TEMPLATE_EDITOR_TRANSMISSION_EVENTS } from '../constants'
import { TOAST } from '~/constants/toasts'
import { ONE_SECOND_IN_MILLISECONDS } from '~/constants'
import { INTEGRATION_ACTION } from '~/routes/api.integrations/constants'
import isArray from 'lodash/isArray'
import { GLOBAL_EVENTS_TRANSMITTER } from '~/constants/events-transmitter'

function RepublishProductsModal() {
  const { t } = useTranslation()
  const { state, closeModal } = useModal()

  const modalState = useMemo(() => state?.[MODAL_ID.REPUBLISH_EDITOR_MODAL] || { active: false, data: {} }, [state])
  const open = modalState.active
  const activeVariantIntegrationIds: string[] = useMemo(
    () => modalState.data?.activeVariantIntegrationIds || [],
    [modalState.data?.activeVariantIntegrationIds]
  )

  const publishedIntegrationsIds: string[] = useMemo(
    () => modalState.data?.publishedIntegrationsIds || [],
    [modalState.data?.publishedIntegrationsIds]
  )

  /**
   * Track which button is currently showing the spinner. `primary` corresponds to the
   * "Save & republish" button, while `secondary` maps to the "Save only" button. When
   * undefined there is no active spinner.
   */
  const [loadingAction, setLoadingAction] = useState<'primary' | 'secondary' | undefined>()

  /**
   * Temporary state used to replace the button label with a “processing” string for ~1 second
   * before the Polaris `loading` spinner appears. We need a separate flag for each button so
   * that only the clicked button updates its label.
   */
  const [trickyLoading, setTrickyLoading] = useState<'primary' | 'secondary' | undefined>()

  // Helper to trigger the canonical save flow via Transmitter and wait for completion
  const saveTemplate = useCallback(async () => {
    return new Promise<void>((resolve, reject) => {
      // eslint-disable-next-line prefer-const
      let timeoutId: NodeJS.Timeout | string | number | undefined

      const onSaved = () => {
        clearTimeout(timeoutId)
        showToast(t(TOAST.TEMPLATE_EDITOR.TEMPLATE_SAVED))
        Transmitter.remove(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.SAVED_TEMPLATE, onSaved)
        resolve()
      }

      // Listen for the saved event
      Transmitter.listen(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.SAVED_TEMPLATE, onSaved)

      showToast(t(TOAST.TEMPLATE_EDITOR.SAVING_TEMPLATE))
      // Trigger save process handled by SaveTemplateModalContent
      Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.SAVE_TEMPLATE)

      // Timeout safeguard (30s)
      timeoutId = setTimeout(() => {
        Transmitter.remove(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.SAVED_TEMPLATE, onSaved)
        reject(new Error('Save template timed out'))
      }, 30000)
    })
  }, [t])

  const handleClose = useCallback(() => {
    closeModal(MODAL_ID.REPUBLISH_EDITOR_MODAL)
  }, [closeModal])

  /* Save template (always) then optionally publish integrations */
  const executeAction = useCallback(
    async (shouldPublish: boolean, action: 'primary' | 'secondary') => {
      try {
        // Replace the clicked button label with a temporary “processing” text
        setTrickyLoading(action)
        // Refresh the idToken
        shopify.idToken()
        if (shouldPublish) {
          showToast(t(TOAST.TEMPLATE_EDITOR.REPUBLISHING_CHANGES))
        } else {
          showToast(t(TOAST.TEMPLATE_EDITOR.SAVING_TEMPLATE))
        }

        // 1️⃣  Save template via central flow
        await Promise.all([
          saveTemplate(),
          new Promise(resolve =>
            setTimeout(() => {
              // Simulate loading
              setTrickyLoading(undefined)
              setLoadingAction(action)
              resolve(true)
            }, ONE_SECOND_IN_MILLISECONDS)
          ),
        ])

        let integrationIds: string[] = []

        // If there are published integrations, use them
        if (publishedIntegrationsIds.length > 0) {
          integrationIds = publishedIntegrationsIds
        }
        // If there are active variant integrations, find all integrations that reference the template via its variant integrations
        else if (activeVariantIntegrationIds && isArray(activeVariantIntegrationIds)) {
          // Find all integrations that reference the template via its variant integrations
          const data = await authenticatedFetch(
            `/api/integrations?action=${INTEGRATION_ACTION.FETCH_INTEGRATIONS_BY_VARIANT_IDS}`,
            {
              method: 'POST',
              body: JSON.stringify({ variantIds: activeVariantIntegrationIds }),
            }
          )

          if (!data.success) {
            throw new Error(data.message)
          }

          const { integrations } = data
          integrationIds = integrations.map((integration: any) => integration._id)
        }

        // 2️⃣  Optionally publish integrations
        if (shouldPublish && integrationIds.length) {
          for (const integrationId of integrationIds) {
            const formData = new FormData()
            formData.append('action', EActionType.PUBLISH_PRODUCT)
            formData.append('integrationId', integrationId)

            const res = await authenticatedFetch('/api/integration', {
              method: 'POST',
              body: formData,
            })

            if (!res.success) {
              throw new Error(res.message)
            }
          }

          // Emit event after successful publish to update PTE status
          Transmitter.trigger(GLOBAL_EVENTS_TRANSMITTER.PUBLISHED_PRODUCT)
        }

        showToast(
          shouldPublish ? t(TOAST.TEMPLATE_EDITOR.CHANGES_REPUBLISHED) : t(TOAST.TEMPLATE_EDITOR.TEMPLATE_SAVED)
        )
      } catch (error) {
        console.error(error)
        showGenericErrorToast()
      } finally {
        setLoadingAction(undefined)
        setTrickyLoading(undefined)
        handleClose()
      }
    },
    [saveTemplate, handleClose, t, publishedIntegrationsIds, activeVariantIntegrationIds]
  )

  const primaryAction = useMemo(() => {
    return {
      content: t(trickyLoading === 'primary' ? 'processing' : 'save-and-republish'),
      onAction: () => executeAction(true, 'primary'),
      loading: loadingAction === 'primary',
      disabled: !!trickyLoading || !!loadingAction,
    }
  }, [trickyLoading, loadingAction, executeAction, t])

  const secondaryActions = useMemo(
    () => [
      {
        content: t(trickyLoading === 'secondary' ? 'processing' : 'save-only'),
        onAction: () => executeAction(false, 'secondary'),
        loading: loadingAction === 'secondary',
        disabled: !!trickyLoading || !!loadingAction,
      },
    ],
    [executeAction, loadingAction, t, trickyLoading]
  )

  if (!activeVariantIntegrationIds.length) {
    return null
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('republish-products-question')}
      primaryAction={primaryAction}
      secondaryActions={secondaryActions}
    >
      <Modal.Section>
        <BlockStack gap="200">
          <Text as="p" variant="bodyMd">
            {t('template-editor-republish-description-1')}
          </Text>
          <Text as="p" variant="bodyMd">
            {t('template-editor-republish-description-2')}
          </Text>
        </BlockStack>
      </Modal.Section>
    </Modal>
  )
}

export default memo(RepublishProductsModal)
