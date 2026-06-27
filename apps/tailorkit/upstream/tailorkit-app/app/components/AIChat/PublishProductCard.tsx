import { useCallback, useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from '@remix-run/react'
import { showGenericErrorToast } from '~/utils/toastEvents'
import { useChatBot } from '~/providers/ChatBotContext'
import AIActionCard from './AIActionCard'
import { EActionType } from '~/constants/fetcher-keys'
import { sendMessageToMainApp } from '~/utils/modalEvents'
import { ONE_MINUTE_IN_MILLISECONDS } from '~/constants'
// Removed unused imports - using sendMessageToMainApp for communication

interface PublishProductCardProps {
  /** Integration ID to publish */
  integrationId: string
  /** Mockup ID to match current location */
  mockupId?: string
  /** Product title to display */
  productTitle?: string
  /** Template title to display */
  templateTitle?: string
  /** Callback when publish is successful */
  onPublishSuccess?: (integrationId: string) => void
}

/**
 * PublishProductCard Component
 *
 * An AI action card that allows users to publish their product integration.
 * This component handles the publish workflow and provides feedback to users.
 *
 * Features:
 * - Publishes integration via API
 * - Shows loading state during publish
 * - Handles success/error states
 * - Updates chat with success message after publish
 */
export function PublishProductCard({
  integrationId,
  mockupId,
  productTitle,
  templateTitle,
  onPublishSuccess,
}: PublishProductCardProps) {
  const { t } = useTranslation()
  const [processing, setProcessing] = useState(false)
  const [isPublished, setIsPublished] = useState(false)
  const { saveAiMessage } = useChatBot()
  const location = useLocation()

  // Check if current location matches this integration
  const isCurrentLocation = useMemo(() => {
    const currentPath = location.pathname
    const currentSearch = location.search

    // Extract integration ID and mockup ID from current URL
    // URL format: /personalized-products/modal/{integrationId}
    const integrationMatch = currentPath.match(/\/personalized-products\/modal\/([^/]+)/)
    const currentIntegrationId = integrationMatch ? integrationMatch[1] : null
    const currentMockupId = new URLSearchParams(currentSearch).get('mockup')

    return currentIntegrationId === integrationId && (mockupId ? currentMockupId === mockupId : true)
  }, [location.pathname, location.search, integrationId, mockupId])

  // Listen for publish completion events
  useEffect(() => {
    const handlePublishComplete = () => {
      setIsPublished(true)
      setProcessing(false)
    }

    // Listen for publish completion message from iframe
    const handleMessage = (event: MessageEvent) => {
      if (event.data === EActionType.PUBLISHED_PRODUCT) {
        handlePublishComplete()
      }
    }

    window.addEventListener('message', handleMessage)

    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [])

  const handleSaveAndPublish = useCallback(async () => {
    if (processing || !integrationId || !isCurrentLocation) {
      return
    }

    try {
      setProcessing(true)

      // Step 1: Trigger save action first

      // Send message to main app using the proper function
      sendMessageToMainApp(EActionType.SAVE_PRODUCT)

      // Wait for save completion

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Save operation timed out'))
        }, ONE_MINUTE_IN_MILLISECONDS * 2) // 60 second timeout

        const handleSaveComplete = (event: MessageEvent) => {
          if (event.data === EActionType.SAVED_PRODUCT) {
            clearTimeout(timeout)
            window.removeEventListener('message', handleSaveComplete)
            resolve()
          }
        }

        window.addEventListener('message', handleSaveComplete)
      })

      // Step 2: Trigger publish action after save

      sendMessageToMainApp(EActionType.PUBLISH_PRODUCT)

      // Wait for publish completion and handle success

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Publish operation timed out'))
        }, ONE_MINUTE_IN_MILLISECONDS * 2) // 60 second timeout

        const handlePublishComplete = async (event: MessageEvent) => {
          if (event.data === EActionType.PUBLISHED_PRODUCT) {
            clearTimeout(timeout)
            window.removeEventListener('message', handlePublishComplete)

            try {
              // Save success message to AI chat
              const successMessage = t('ai-chat-publish-product-card-success-message')
              const messageId = `view-live-${integrationId}-${Date.now()}`

              await saveAiMessage(successMessage, messageId, {
                type: 'view_live_action',
                integrationId,
                mockupId,
                actionData: {
                  integrationId,
                  mockupId,
                  productTitle,
                  templateTitle,
                },
              })

              setIsPublished(true)

              // Call success callback if provided
              if (onPublishSuccess) {
                onPublishSuccess(integrationId)
              }

              resolve()
            } catch (error) {
              console.warn('Failed to save AI success message:', error)
              resolve() // Don't fail the whole operation for AI message error
            }
          }
        }

        const handleAbortAction = (event: MessageEvent) => {
          if (event.data === EActionType.ABORT_ACTION) {
            clearTimeout(timeout)
            window.removeEventListener('message', handleAbortAction)
            reject(new Error('Publish aborted'))
          }
        }

        window.addEventListener('message', handlePublishComplete)
        window.addEventListener('message', handleAbortAction)
      })
    } catch (error: any) {
      console.error('❌ Error in save and publish:', error)
      showGenericErrorToast()
    } finally {
      setProcessing(false)
    }
  }, [
    processing,
    integrationId,
    isCurrentLocation,
    t,
    saveAiMessage,
    mockupId,
    productTitle,
    templateTitle,
    onPublishSuccess,
  ])

  // Determine button text and state
  const buttonText = useMemo(() => {
    if (isPublished) {
      return t('personalized-product-created')
    }
    return t('save-and-publish')
  }, [isPublished, t])

  const isButtonDisabled = useMemo(() => {
    return processing || isPublished || !isCurrentLocation
  }, [processing, isPublished, isCurrentLocation])

  return (
    <AIActionCard
      title="Publish product"
      productTitle={productTitle}
      templateTitle={templateTitle}
      buttonText={buttonText}
      onButtonClick={handleSaveAndPublish}
      loading={processing}
      disabled={isButtonDisabled}
    />
  )
}

export default PublishProductCard
