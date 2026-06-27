import { Card } from '@shopify/polaris'
import { useEffect, useMemo } from 'react'
import { AIChat } from '~/components/AIChat'
import { useRootLoaderData } from '~/root'
import { useAIAutoAction } from '../../hooks/useAIAutoAction'
import { useSearchParams } from '@remix-run/react'

export default function AIChatOnboarding() {
  const { shopData } = useRootLoaderData()

  const [searchParams] = useSearchParams()
  const isOnboardingRoute = useMemo(() => searchParams.get('onboarding') === 'true', [searchParams])

  const { handleAIAutoAction } = useAIAutoAction(shopData?.appConfig, {
    createConversation: false,
    addWelcomeMessage: false,
    allowAutoSend: false,
  })

  // Generate dynamic suggestions and welcome message based on shop context (appConfig)
  useEffect(() => {
    if (!shopData) return

    try {
      // Auto-send the prompt when user open the chat
      handleAIAutoAction()
    } catch (error) {
      console.error('Failed to generate dynamic suggestions from shop data', error)
    }
  }, [handleAIAutoAction, isOnboardingRoute, shopData])

  return (
    <Card padding={'0'}>
      <AIChat isOpen={true} shopData={shopData} />
    </Card>
  )
}
