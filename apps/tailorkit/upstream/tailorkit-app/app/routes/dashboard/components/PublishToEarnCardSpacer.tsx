import { useEffect, useState } from 'react'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { GLOBAL_EVENTS_TRANSMITTER } from '~/constants/events-transmitter'

const SPACING_MARGIN = -80 // Additional spacing in pixels to ensure content is fully visible

/**
 * PublishToEarnCardSpacer Component
 *
 * A dynamic spacer that automatically adjusts its height based on the
 * PublishToEarnCard's actual height. This prevents content from being
 * hidden behind the fixed-positioned card.
 *
 * Features:
 * - Listens to Transmitter events for card height changes
 * - Updates when card collapses/expands
 * - Returns null if card is not rendered
 * - Handles hydration gracefully (client-side only)
 */
export default function PublishToEarnCardSpacer() {
  const [isClient, setIsClient] = useState(false)
  const [cardHeight, setCardHeight] = useState(0)

  // Handle hydration - only render on client-side
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Listen to card height change events
  useEffect(() => {
    if (!isClient) return

    const handleHeightChange = (eventObject: { data?: { height?: number } }) => {
      const height = eventObject.data?.height
      if (height && height > 0) {
        setCardHeight(height)
      }
    }

    // Listen immediately
    Transmitter.listen(GLOBAL_EVENTS_TRANSMITTER.PTE_CARD_HEIGHT_CHANGED, handleHeightChange)

    // Request card to send current height if it's already rendered
    // This handles the case where card renders before spacer listens
    requestAnimationFrame(() => {
      const cardElement = document.querySelector('[data-pte-card-content]')
      if (cardElement) {
        const rect = cardElement.getBoundingClientRect()
        if (rect.height > 0) {
          setCardHeight(rect.height)
        }
      }
    })

    return () => {
      Transmitter.remove(GLOBAL_EVENTS_TRANSMITTER.PTE_CARD_HEIGHT_CHANGED, handleHeightChange)
    }
  }, [isClient])

  // Don't render if not on client-side
  if (!isClient) {
    return null
  }

  // Always render spacer, even if height is 0 (card might not be loaded yet)
  // This prevents layout shift when card appears
  const spacerHeight = cardHeight > 0 ? cardHeight + SPACING_MARGIN : 0

  return <div style={{ height: `${spacerHeight}px`, minHeight: 0 }} />
}
