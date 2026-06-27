import { Banner, Box } from '@shopify/polaris'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TOAST } from '~/constants/toasts'
import { showToast } from '~/utils/toastEvents'

interface EnableThemeHelperBannerProps {
  enabledOneTickHelper: boolean
  oneTickHelperLink: string
  description?: string
  /** Whether the theme config is still loading */
  isLoading?: boolean
  /** Callback to refresh the app config and check if helper is enabled */
  onRefreshConfig?: () => Promise<boolean>
}

export default function EnableThemeHelperBanner({
  enabledOneTickHelper,
  oneTickHelperLink,
  description,
  isLoading = false,
  onRefreshConfig,
}: EnableThemeHelperBannerProps) {
  const { t } = useTranslation()
  const [buttonMode, setButtonMode] = useState<'enable' | 'check'>('enable')
  const [isChecking, setIsChecking] = useState(false)

  const handleEnableThemeHelper = useCallback(() => {
    if (oneTickHelperLink) {
      window.open(oneTickHelperLink, '_blank')

      setTimeout(() => {
        setButtonMode('check')
      }, 1000)
    }
  }, [oneTickHelperLink])

  const handleCheckHelperEnabled = useCallback(async () => {
    if (!onRefreshConfig) return

    setIsChecking(true)
    try {
      const isEnabled = await onRefreshConfig()
      if (!isEnabled) {
        showToast(t(TOAST.SETTINGS.HELPER_NOT_ENABLED), { isError: true })
        setButtonMode('enable')
      }
    } catch (error) {
      console.error('Failed to check helper status:', error)
      showToast(t(TOAST.SETTINGS.HELPER_STATUS_CHECK_FAILED), { isError: true })
      setButtonMode('enable')
    } finally {
      setIsChecking(false)
    }
  }, [onRefreshConfig, t])

  // Don't show banner while loading or if OneTick helper is already enabled
  if (isLoading || enabledOneTickHelper) {
    return null
  }

  const actionContent = buttonMode === 'enable' ? t('enable-helper') : t('check-helper-enabled')
  const actionHandler = buttonMode === 'enable' ? handleEnableThemeHelper : handleCheckHelperEnabled

  return (
    <Box paddingBlockEnd="400">
      <Banner
        title={t('upsell-cross-sell-helper-is-disabled')}
        tone="warning"
        action={{
          content: actionContent,
          onAction: actionHandler,
          loading: isChecking,
        }}
      >
        {description || t('please-enable-tailorkit-theme-helper-to-display-addon-products-properly')}
      </Banner>
    </Box>
  )
}
