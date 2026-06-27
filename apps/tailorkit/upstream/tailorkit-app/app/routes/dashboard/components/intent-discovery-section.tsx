import { useState, useEffect, useCallback } from 'react'
import { InlineGrid } from '@shopify/polaris'
import { authenticatedFetch } from '~/shopify/fns.client'
import { useFeatureTracking } from '~/hooks/useFeatureTracking'
import { CommitIntentCard, DemoIntentCard } from '~/routes/onboarding-intent/components/intent-card'
import { INTENT_CARDS, STOREFRONT_DEMO_URL } from '~/routes/onboarding-intent/intents'
import { ONBOARDING_FLOW_ROUTER_ACTIONS } from '~/routes/api.onboarding-flow-router/constants'
import type { CreateFlow } from '~/models/Shop'

interface IntentDiscoverySectionProps {
  onSelect: (flow: CreateFlow) => void
}

export function IntentDiscoverySection({ onSelect }: IntentDiscoverySectionProps) {
  const tracking = useFeatureTracking('onboarding_intent_router')
  const [shownAt] = useState(() => Date.now())
  const [demoClickedFirst, setDemoClickedFirst] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    tracking.trackDiscovered('dashboard_card')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCommit = useCallback(
    async (flow: CreateFlow) => {
      setSubmitting(true)
      try {
        const timeToSelectSeconds = Math.min(Math.max(0, (Date.now() - shownAt) / 1000), 3600)
        await authenticatedFetch('/api/onboarding-flow-router', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: ONBOARDING_FLOW_ROUTER_ACTIONS.RECORD_INTENT_SELECTION,
            selected: flow,
            timeToSelectSeconds,
            demoClickedFirst,
          }),
        })
        tracking.trackCompleted(`selected_${flow}`, timeToSelectSeconds)
        onSelect(flow)
      } catch (err) {
        console.error('[IntentDiscoverySection] intent selection failed:', err)
        // Proceed even on API failure — don't block the merchant
        onSelect(flow)
      } finally {
        setSubmitting(false)
      }
    },
    [shownAt, demoClickedFirst, onSelect, tracking]
  )

  const handleDemoClick = useCallback(() => {
    setDemoClickedFirst(true)
    tracking.trackStarted({ source: 'demo' })
    void authenticatedFetch('/api/onboarding-flow-router', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: ONBOARDING_FLOW_ROUTER_ACTIONS.RECORD_DEMO_CLICKED }),
    }).catch((err: unknown) => {
      console.error('[IntentDiscoverySection] demo click tracking failed:', err)
    })
    window.open(STOREFRONT_DEMO_URL, '_blank')
  }, [tracking])

  return (
    <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
      {INTENT_CARDS.map(card =>
        card.kind === 'commit' ? (
          <CommitIntentCard key={card.flow} card={card} onClick={() => handleCommit(card.flow)} disabled={submitting} />
        ) : (
          <DemoIntentCard key={card.href} card={card} onClick={handleDemoClick} disabled={submitting} />
        )
      )}
    </InlineGrid>
  )
}
