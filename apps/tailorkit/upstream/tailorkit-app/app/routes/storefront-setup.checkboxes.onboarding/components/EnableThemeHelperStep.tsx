import { Banner, BlockStack, Box, Card, Icon, InlineStack, Spinner, Text } from '@shopify/polaris'
import { CheckCircleIcon } from '@shopify/polaris-icons'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TOAST } from '~/constants/toasts'
import { showToast } from '~/utils/toastEvents'
import { useCheckboxOnboarding } from '../hooks/useCheckboxOnboarding'

/**
 * EnableThemeHelperStep - Enable theme helper as final onboarding step
 * Simplified to show just a banner with enable action
 */
export default function EnableThemeHelperStep() {
  const { t } = useTranslation()
  const { themeConfig, isLoadingThemeConfig, refreshThemeConfig } = useCheckboxOnboarding()

  const [buttonMode, setButtonMode] = useState<'enable' | 'check'>('enable')
  const [isChecking, setIsChecking] = useState(false)

  const handleEnableThemeHelper = useCallback(() => {
    if (themeConfig.oneTickHelperLink) {
      window.open(themeConfig.oneTickHelperLink, '_blank')
      setTimeout(() => {
        setButtonMode('check')
      }, 1000)
    }
  }, [themeConfig.oneTickHelperLink])

  const handleCheckHelperEnabled = useCallback(async () => {
    setIsChecking(true)
    try {
      const isEnabled = await refreshThemeConfig()
      if (!isEnabled) {
        showToast(t(TOAST.SETTINGS.HELPER_NOT_ENABLED_YET), { isError: true })
        setButtonMode('enable')
      } else {
        showToast(t(TOAST.SETTINGS.HELPER_ENABLED))
      }
    } catch (error) {
      console.error('Failed to check helper status:', error)
      showToast(t(TOAST.SETTINGS.HELPER_STATUS_CHECK_FAILED), { isError: true })
      setButtonMode('enable')
    } finally {
      setIsChecking(false)
    }
  }, [refreshThemeConfig, t])

  if (isLoadingThemeConfig) {
    return (
      <Card padding="600">
        <InlineStack align="center" blockAlign="center" gap="400">
          <Spinner size="small" />
          <Text as="p" variant="bodyMd">
            {t('checking-theme-helper-status')}
          </Text>
        </InlineStack>
      </Card>
    )
  }

  // If theme helper is already enabled, show success state
  if (themeConfig.enabledOneTickHelper) {
    return (
      <Card padding="600">
        <BlockStack gap="300">
          <InlineStack gap="300" blockAlign="center">
            <Box>
              <Icon source={CheckCircleIcon} tone="success" />
            </Box>
            <Text as="h2" variant="headingMd">
              {t('theme-helper-is-enabled')}
            </Text>
          </InlineStack>
          <Text as="p" variant="bodyMd" tone="subdued">
            {t('your-add-on-products-will-display-correctly-on-your-storefront')}
          </Text>
        </BlockStack>
      </Card>
    )
  }

  // Show enable helper banner
  return (
    <Banner
      title={t('theme-helper-is-disabled')}
      tone="info"
      action={{
        content: buttonMode === 'enable' ? t('enable-helper') : t('check-if-enabled'),
        onAction: buttonMode === 'enable' ? handleEnableThemeHelper : handleCheckHelperEnabled,
        loading: isChecking,
      }}
    >
      <Text as="p" variant="bodyMd">
        {t(
          'enable-the-theme-helper-to-display-your-add-on-products-on-the-storefront-click-the-button-then-save-in-the-shopify-theme-editor'
        )}
      </Text>
    </Banner>
  )
}
