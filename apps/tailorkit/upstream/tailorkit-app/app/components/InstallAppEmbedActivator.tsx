import type { ButtonProps } from '@shopify/polaris'
import { BlockStack, Box, Button, InlineStack, Text } from '@shopify/polaris'
import { CheckCircleIcon, ThemeIcon } from '@shopify/polaris-icons'
import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { FOUR_SECONDS_IN_MILLISECONDS } from '~/constants'
import { authenticatedFetch } from '~/shopify/fns.client'

// Constants for installation timing
const MAX_INSTALLATION_TIME_MS = 90_000 // 90 seconds maximum waiting time for installation
const REVALIDATION_INTERVAL_MS = FOUR_SECONDS_IN_MILLISECONDS // 4 seconds between checks

interface IInstallAppEmbedActivatorProps {
  appConfig: any
  buttonProps?: ButtonProps
  showDescription?: boolean
  revalidate: () => void
  /** Callback fired once TailorKit theme extension has been enabled */
  onThemeExtensionEnabled?: () => void
}

export function InstallAppEmbedActivator(props: IInstallAppEmbedActivatorProps) {
  const { appConfig, buttonProps, showDescription = true, revalidate, onThemeExtensionEnabled } = props
  const { t } = useTranslation()
  const { enabledAppEmbed, appEmbedLink } = appConfig || {}
  const { trackEvent } = useEventsTracking()

  const [isOpening, setIsOpening] = useState(false)
  const [installFailed, setInstallFailed] = useState(false)
  const [closedEmbedWindow, setClosedEmbedWindow] = useState(false)

  const embedWindowRef = useRef<Window | null>(null)
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null)
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null) // 90-second failure timeout
  const finalCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null) // 1-second post-close check
  // Avoid invoking the callback multiple times
  const callbackInvokedRef = useRef(false)
  const attemptStartTimeRef = useRef<number | null>(null)

  // Initialize installation process
  const onInstallingAppEmbed = useCallback(() => {
    trackEvent(EVENTS_TRACKING.INSTALL_APP_EMBED)

    // Open Shopify theme editor in new tab and keep a reference
    const newWindow = window.open(appEmbedLink, '_blank')
    embedWindowRef.current = newWindow

    if (!newWindow) {
      // Popup was blocked (common in Shopify Admin iframe on mobile).
      // Don't enter loading state — navigate the parent frame directly instead.
      try {
        if (window.top) {
          window.top.location.href = appEmbedLink
        } else {
          window.location.href = appEmbedLink
        }
      } catch {
        window.location.href = appEmbedLink
      }
      return
    }

    // Reset and start new installation process
    setIsOpening(true)
    setInstallFailed(false)
    setClosedEmbedWindow(false)
    attemptStartTimeRef.current = Date.now()
  }, [appEmbedLink, trackEvent])

  // Handle interval polling for checking installation status
  useEffect(() => {
    // Clean up function for interval
    const cleanupInterval = () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current)
        intervalIdRef.current = null
      }
    }

    // Only start polling if we're in installation process and app embed is not already enabled
    if (isOpening && !enabledAppEmbed) {
      // Always clean up any existing interval first to prevent overlapping
      cleanupInterval()

      // Start new polling interval
      intervalIdRef.current = setInterval(async () => {
        const embedWindow = embedWindowRef.current

        // Check if window was closed
        if (embedWindow && embedWindow.closed) {
          // User closed theme editor tab: clean up polling and check status
          setClosedEmbedWindow(true)
          cleanupInterval()

          // Final check for app embed status with a delay to ensure theme settings are saved
          const finalCheckTimeout = setTimeout(async () => {
            try {
              const data = await authenticatedFetch('/api/preferences?themeConfig=true')

              if (data?.appConfig?.enabledAppEmbed) {
                // App embed was installed! Trigger revalidation and clear states
                setIsOpening(false)
                setInstallFailed(false)
                revalidate()
              } else {
                // App embed was not installed, mark as failed
                setIsOpening(false)
                setInstallFailed(true)
              }
            } catch (error) {
              console.error('Error checking final app embed status:', error)
              setIsOpening(false)
              setInstallFailed(true)
            }
          }, 1000) // Wait 1 second for theme settings to be saved

          // Store in dedicated ref so the 90-second failure timeout cannot cancel it
          finalCheckTimeoutRef.current = finalCheckTimeout
        } else if (embedWindow && !embedWindow.closed) {
          // Window is still open, check for installation status
          try {
            const data = await authenticatedFetch('/api/preferences?themeConfig=true')

            if (data?.appConfig?.enabledAppEmbed) {
              // App embed is now enabled! Stop polling and revalidate
              setIsOpening(false)
              setInstallFailed(false)
              cleanupInterval()
              revalidate()

              // Close the window if it's still open
              if (!embedWindow.closed) {
                embedWindow.close()
              }
            }
          } catch (error) {
            console.error('Error checking app embed status during polling:', error)
          }
        } else {
          // embedWindow is null — window reference lost, stop polling immediately
          cleanupInterval()
          setIsOpening(false)
          setInstallFailed(true)
        }
      }, REVALIDATION_INTERVAL_MS)
    } else {
      // Clean up if not in installation process
      cleanupInterval()
    }

    // Cleanup function returned by useEffect
    return () => {
      cleanupInterval()
    }
  }, [isOpening, enabledAppEmbed, revalidate])

  // Handle timeout for installation failure with better cleanup
  useEffect(() => {
    // Clean up function for timeout
    const cleanupTimeout = () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current)
        timeoutIdRef.current = null
      }
    }

    // If we start installing, set up timeout
    if (isOpening && !installFailed) {
      // Always clean up any existing timeout first
      cleanupTimeout()

      // Set timeout for installation failure
      timeoutIdRef.current = setTimeout(() => {
        // Only show failure if still in installation process and app embed not enabled
        if (isOpening && !enabledAppEmbed) {
          setIsOpening(false)
          setInstallFailed(true)
        }
      }, MAX_INSTALLATION_TIME_MS)
    } else {
      // Clean up if not in installation process
      cleanupTimeout()
    }

    // Cleanup function returned by useEffect
    return () => {
      cleanupTimeout()
    }
  }, [isOpening, enabledAppEmbed, installFailed])

  // Cleanup all timers on component unmount
  useEffect(() => {
    return () => {
      // Clean up interval
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current)
        intervalIdRef.current = null
      }
      // Clean up 90-second failure timeout
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current)
        timeoutIdRef.current = null
      }
      // Clean up post-close check timeout
      if (finalCheckTimeoutRef.current) {
        clearTimeout(finalCheckTimeoutRef.current)
        finalCheckTimeoutRef.current = null
      }
      // Close any open window
      if (embedWindowRef.current && !embedWindowRef.current.closed) {
        embedWindowRef.current.close()
        embedWindowRef.current = null
      }
    }
  }, []) // Empty dependency array means this only runs on unmount

  // Effect to handle when installation succeeds (simplified)
  useEffect(() => {
    if (enabledAppEmbed && (isOpening || installFailed)) {
      // App embed is now enabled, clear all failure states
      setIsOpening(false)
      setInstallFailed(false)
      setClosedEmbedWindow(false)
    }
  }, [enabledAppEmbed, isOpening, installFailed])

  // Notify parent component once the theme extension has been enabled.
  useEffect(() => {
    if (enabledAppEmbed && !callbackInvokedRef.current) {
      callbackInvokedRef.current = true
      onThemeExtensionEnabled?.()
    }
  }, [enabledAppEmbed, onThemeExtensionEnabled])

  // Handle window focus events for immediate status checking
  useEffect(() => {
    const handleWindowFocus = async () => {
      // Check if we recently closed the embed window and should recheck status
      // Also ensure we're not already in an active polling state to avoid conflicts
      if (closedEmbedWindow && !enabledAppEmbed && !isOpening) {
        try {
          const data = await authenticatedFetch('/api/preferences?themeConfig=true')

          if (data?.appConfig?.enabledAppEmbed) {
            // App embed was installed! Trigger revalidation and clear states
            setInstallFailed(false)
            setClosedEmbedWindow(false)
            revalidate()
          }
        } catch (error) {
          console.error('Error checking app embed status on window focus:', error)
        }
      }
    }

    // Add event listener with passive option for better performance
    window.addEventListener('focus', handleWindowFocus, { passive: true })

    return () => {
      window.removeEventListener('focus', handleWindowFocus)
    }
  }, [closedEmbedWindow, enabledAppEmbed, isOpening, revalidate])

  // Allow retry if installation failed
  const handleRetry = useCallback(() => {
    trackEvent(EVENTS_TRACKING.INSTALL_APP_EMBED_RETRY)

    onInstallingAppEmbed()
  }, [onInstallingAppEmbed, trackEvent])

  // Ensure the hidden option-pricing product exists for this shop.
  // Without it, option additionalCost silently drops off the cart total.
  // Fires once per browser session — endpoint itself is idempotent (finds existing or creates).
  useEffect(() => {
    const SESSION_KEY = 'tlk:pricingProductEnsured'
    if (typeof window === 'undefined' || window.sessionStorage.getItem(SESSION_KEY)) return

    // Set flag synchronously BEFORE fetch to block concurrent mounts from firing duplicate requests.
    // On failure we clear the flag so the next mount retries.
    window.sessionStorage.setItem(SESSION_KEY, '1')

    authenticatedFetch('/api/option-pricing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ENSURE_PRICING_PRODUCT' }),
    }).catch(error => {
      window.sessionStorage.removeItem(SESSION_KEY)
      console.warn('Failed to setup option pricing product:', error)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- authenticatedFetch is a stable module import
  }, [])

  return (
    <BlockStack gap="400">
      {showDescription && (
        <InstallAppEmbedDescription enabledAppEmbed={enabledAppEmbed} installFailed={installFailed} />
      )}

      {/* Action buttons */}
      {(installFailed || !enabledAppEmbed) && (
        <InlineStack gap="200" align="start" wrap={false}>
          {installFailed ? (
            <Fragment>
              <Button variant="secondary" onClick={handleRetry}>
                {t('try-again')}
              </Button>
            </Fragment>
          ) : null}

          {!enabledAppEmbed && !installFailed ? (
            buttonProps ? (
              <Button {...buttonProps} loading={isOpening || !!buttonProps.loading} onClick={onInstallingAppEmbed} />
            ) : (
              <Button
                id="btn--enable-theme-extension"
                icon={ThemeIcon}
                loading={isOpening}
                onClick={onInstallingAppEmbed}
              >
                {t('enable-theme-extension')}
              </Button>
            )
          ) : null}
        </InlineStack>
      )}

      {enabledAppEmbed && (
        <InlineStack align="start">
          <Button icon={CheckCircleIcon} disabled>
            {t('app-embed-enabled')}
          </Button>
        </InlineStack>
      )}
    </BlockStack>
  )
}

export function InstallAppEmbedDescription(props: { enabledAppEmbed: boolean; installFailed?: boolean }) {
  const { enabledAppEmbed, installFailed } = props
  const { t } = useTranslation()

  return (
    <Box>
      <BlockStack gap={'200'}>
        <Text as="span" variant="bodyMd">
          <Trans
            t={t}
            components={{
              b: (
                <Text as="span" variant="bodyMd" fontWeight="bold">
                  {t('app-embed-tailorkit')}
                </Text>
              ),
            }}
          >
            {!enabledAppEmbed
              ? installFailed
                ? t('install-app-embed-description-failed')
                : t('install-app-embed-description')
              : t('install-app-embed-description-completed')}
          </Trans>
        </Text>
        {enabledAppEmbed && (
          <Text as="span" variant="bodyMd">
            <Trans
              t={t}
              components={{
                b: (
                  <Text as="span" variant="bodyMd" fontWeight="bold">
                    {t('app-embed-tailorkit')}
                  </Text>
                ),
              }}
            >
              {t('install-app-embed-description-completed-2')}
            </Trans>
          </Text>
        )}
      </BlockStack>
    </Box>
  )
}
