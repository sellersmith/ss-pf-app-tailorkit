import { Fragment, useCallback } from 'react'
import { Banner, BlockStack, Button, Divider, Icon, InlineStack, Tooltip } from '@shopify/polaris'
import { InfoIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { useStoreContext } from '~/modules/TemplateEditor/contexts/StoreContext'
import Switch from '~/components/common/Switch'
import { isAdditionalPricingEnabled } from '~/utils/optionSet-pricing'

interface OptionSetPricingHeaderProps {
  optionSet: {
    type?: string
    data?: any
    additionalPricingEnabled?: boolean
  }
  onToggleEnabled: (enabled: boolean) => void
  disabled?: boolean
}

export default function OptionSetPricingHeader({ optionSet, onToggleEnabled, disabled }: OptionSetPricingHeaderProps) {
  const { t } = useTranslation()
  const { shopData } = useStoreContext()
  const { trackEvent } = useEventsTracking()

  const enabled = isAdditionalPricingEnabled(optionSet)
  const appEmbedEnabled = !!shopData?.appConfig?.enabledAppEmbed
  const appEmbedLink: string = shopData?.appConfig?.appEmbedLink || ''

  const handleToggle = useCallback(() => {
    onToggleEnabled(!enabled)
  }, [enabled, onToggleEnabled])

  // Mirrors InstallAppEmbedActivator: open theme editor in a new tab,
  // fall back to the parent frame if the popup is blocked (Shopify Admin iframe).
  const handleEnableEmbed = useCallback(() => {
    if (!appEmbedLink || typeof window === 'undefined') return

    trackEvent(EVENTS_TRACKING.INSTALL_APP_EMBED)

    const newWindow = window.open(appEmbedLink, '_blank')
    if (newWindow) return

    try {
      if (window.top) {
        window.top.location.href = appEmbedLink
      } else {
        window.location.href = appEmbedLink
      }
    } catch {
      window.location.href = appEmbedLink
    }
  }, [appEmbedLink, trackEvent])

  return (
    <Fragment>
      <Divider borderColor="border" />
      <BlockStack gap="200">
        <InlineStack gap="200" blockAlign="center" wrap={false}>
          <Switch label={t('enable-extra-pricing')} checked={enabled} disabled={disabled} onInput={handleToggle} />
          <Tooltip content={t('add-extra-charges-to-increase-your-revenue')}>
            <Icon source={InfoIcon} />
          </Tooltip>
        </InlineStack>
        {enabled && !appEmbedEnabled && (
          <Banner tone="warning">
            <BlockStack gap="200">
              <s-text>{t('extra-pricing-requires-app-embed')}</s-text>
              {appEmbedLink && (
                <InlineStack>
                  <Button onClick={handleEnableEmbed}>{t('enable-app-embed-now')}</Button>
                </InlineStack>
              )}
            </BlockStack>
          </Banner>
        )}
      </BlockStack>
    </Fragment>
  )
}
