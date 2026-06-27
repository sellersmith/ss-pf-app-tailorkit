import { isMobile } from 'extensions/tailorkit-src/src/assets/utils/devices'
import { memo, useEffect } from 'react'
import backgroundRemovalService from '~/services/BackgroundRemovalService'

export function BackgroundRemovalInitializer() {
  useEffect(() => {
    // Skip initialization on mobile devices - the ML model loading is heavy and can cause performance issues
    // Background removal will automatically fallback to API in useBackgroundRemoval hook
    if (isMobile()) {
      console.log('Mobile device detected - skipping background removal model initialization (will use API fallback)')
      return
    }

    let mounted = true

    const initializeService = async () => {
      try {
        await backgroundRemovalService.initialize()
        if (mounted) {
          const modelInfo = backgroundRemovalService.getModelInfo()
          console.log('Background removal service initialized:', modelInfo)
        }
      } catch (err) {
        if (mounted) {
          console.warn('Background removal initialization failed, will fallback to API:', err)
        }
      }
    }

    // Initialize in the background, don't block the UI
    initializeService()

    return () => {
      mounted = false
    }
  }, [])

  // This component doesn't render anything, it just initializes the service
  return null
}

export default memo(BackgroundRemovalInitializer)
