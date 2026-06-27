import { useCallback, useEffect, useRef, useState } from 'react'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'

interface UseInstallAppBlockOptions {
  customizerLink: string
  enabledAppBlock: boolean
  revalidate: () => void
  /** Theme structure diagnostics from server — sent with INSTALL_APP_BLOCK_FAILED for debugging */
  appBlockDiagnostics?: {
    productTemplateKeys?: string[]
    sectionLayouts?: Record<string, Array<{ key: string; valueType: string }>>
  }
}

interface UseInstallAppBlockReturn {
  showCountdown: boolean
  countdown: number
  isChecking: boolean
  installFailed: boolean
  onInstallingAppBlock: () => void
}

export function useInstallAppBlock(options: UseInstallAppBlockOptions): UseInstallAppBlockReturn {
  const { customizerLink, enabledAppBlock, revalidate, appBlockDiagnostics } = options
  const { trackEvent } = useEventsTracking()

  // State
  const [showCountdown, setShowCountdown] = useState(false)
  const [countdown, setCountdown] = useState(5)
  const [isChecking, setIsChecking] = useState(false)
  const [installFailed, setInstallFailed] = useState(false)

  // Refs to track timers and customizer window
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const customizerWindowRef = useRef<Window | null>(null)

  // Start countdown timer
  const startCountdown = useCallback(() => {
    // Clean up existing countdown
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
    }

    countdownIntervalRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          // Countdown reached 0, clear interval and start verification
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current)
          }

          // Start verification immediately
          setIsChecking(true)

          // Call revalidate and wait for it to complete
          Promise.resolve(revalidate()).then(() => {
            // Small delay to ensure state updates
            setTimeout(() => {
              setIsChecking(false)
            }, 500)
          })

          return 0 // Set to 0 to show verification state
        }
        return prev - 1
      })
    }, 1000)
  }, [revalidate])

  // Effect to restart countdown if still not installed after verification
  useEffect(() => {
    if (!isChecking && !enabledAppBlock && showCountdown && countdown === 0) {
      // Treat a null window ref (popup blocked) the same as a closed window
      const customizerClosed = customizerWindowRef.current === null || customizerWindowRef.current?.closed === true
      if (customizerClosed) {
        setInstallFailed(true)

        // Track event when the app block installation failed — include theme diagnostics for debugging
        trackEvent(EVENTS_TRACKING.INSTALL_APP_BLOCK_FAILED, {
          product_template_keys: appBlockDiagnostics?.productTemplateKeys || [],
          section_layouts: appBlockDiagnostics?.sectionLayouts
            ? JSON.stringify(appBlockDiagnostics.sectionLayouts)
            : '',
        })

        setShowCountdown(false)

        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current)
        }
        return
      }

      // Restart countdown if verification completed but still not installed
      const timeoutId = setTimeout(() => {
        setCountdown(5)
        startCountdown()
      }, 100)

      return () => {
        clearTimeout(timeoutId)
      }
    }
  }, [isChecking, enabledAppBlock, showCountdown, countdown, startCountdown, trackEvent, appBlockDiagnostics])

  // Effect to handle when installation succeeds
  useEffect(() => {
    if (enabledAppBlock) {
      // Installation succeeded, clean up everything
      setShowCountdown(false)
      setIsChecking(false)
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
      }

      // Track event when the app block installation succeeded
      trackEvent(EVENTS_TRACKING.INSTALL_APP_BLOCK_SUCCESS)
    }
  }, [enabledAppBlock, trackEvent])

  // Clean up countdown on unmount
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
      }
    }
  }, [])

  // Initialize installation process
  const onInstallingAppBlock = useCallback(() => {
    trackEvent(EVENTS_TRACKING.INSTALL_APP_BLOCK)

    // Open Shopify customizer in new tab and keep a reference
    const newWindow = window.open(customizerLink, '_blank')
    customizerWindowRef.current = newWindow

    // Start countdown process
    setInstallFailed(false)
    setShowCountdown(true)
    setCountdown(5)

    // Start countdown immediately
    startCountdown()
  }, [customizerLink, trackEvent, startCountdown])

  return {
    showCountdown,
    countdown,
    isChecking,
    installFailed,
    onInstallingAppBlock,
  }
}
