import { useEffect } from 'react'

/**
 * Hook to track Crisp events
 */
export function useCrispEvents() {
  useEffect(() => {
    // Optional: Listen for Crisp events to track user engagement with chat
    if (window.$crisp) {
      window.$crisp.push([
        'on',
        'chat:opened',
        function () {
          if (window.analytics) {
            window.analytics.track('crisp_chat_opened', {
              triggeredBy: window.tailorKitIdle?.crispTriggered ? 'idle_system' : 'user',
              timestamp: new Date().toISOString(),
            })
          }
        },
      ])

      window.$crisp.push([
        'on',
        'message:sent',
        function () {
          if (window.analytics) {
            window.analytics.track('crisp_message_sent', {
              timestamp: new Date().toISOString(),
            })
          }
        },
      ])
    }
  }, [])
}
