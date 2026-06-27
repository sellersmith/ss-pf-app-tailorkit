import { useMemo } from 'react'
import PublishProductCard from './PublishProductCard'
import ViewLiveCard from './ViewLiveCard'
import type { MessageProps } from './Message'

interface ActionCardRendererProps {
  /** The AI message containing action metadata */
  message: MessageProps['message']
  /** Optional callback when action is completed */
  onActionComplete?: (actionType: string, data: any) => void
}

/**
 * ActionCardRenderer Component
 *
 * Renders action cards based on the message metadata type.
 * This component determines which action card to show based on
 * the message's metadata and renders the appropriate component.
 *
 * Supported action types:
 * - 'publish_product_action': Shows PublishProductCard
 * - 'view_live_action': Shows ViewLiveCard
 */
export function ActionCardRenderer({ message, onActionComplete }: ActionCardRendererProps) {
  const actionType = useMemo(() => {
    return message.metadata?.type
  }, [message.metadata])

  const actionData = useMemo(() => {
    return message.metadata?.actionData || {}
  }, [message.metadata])

  const handleActionComplete = (type: string, data: any) => {
    if (onActionComplete) {
      onActionComplete(type, data)
    }
  }

  // Don't render anything if no action type is specified
  if (!actionType) {
    return null
  }

  switch (actionType) {
    case 'publish_product_action':
      return (
        <PublishProductCard
          integrationId={actionData.integrationId}
          mockupId={actionData.mockupId}
          productTitle={actionData.productTitle}
          templateTitle={actionData.templateTitle}
          onPublishSuccess={integrationId => handleActionComplete('publish', { integrationId })}
        />
      )

    case 'view_live_action':
      return <ViewLiveCard productTitle={actionData.productTitle} templateTitle={actionData.templateTitle} />

    default:
      // Unknown action type, don't render anything
      return null
  }
}

export default ActionCardRenderer
