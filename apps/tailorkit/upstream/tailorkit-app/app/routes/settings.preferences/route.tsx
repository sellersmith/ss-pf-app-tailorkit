import { useLoaderData } from '@remix-run/react'
import { BlockStack, Divider } from '@shopify/polaris'
import { useLayoutEffect } from 'react'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { authenticatedFetch } from '~/shopify/fns.client'
import { SettingsPreferencesSkeleton } from '../settings/components/SettingSkeletons'
import AppBlockInstallation from './components/AppBlockInstallation'
import LanguageSwitcher from './components/LanguageSwitcher'
import { withInteractiveChat } from '~/modules/InteractiveChat/withInteractiveChat'

export async function clientLoader() {
  const shopData = await authenticatedFetch('/api/preferences?themeConfig=true')
  return { shopData }
}

export function HydrateFallback() {
  return <SettingsPreferencesSkeleton />
}

export default withInteractiveChat(function BillingSetting() {
  const { shopData } = useLoaderData<typeof clientLoader>()
  const { appConfig } = shopData || {}

  const { trackEvent } = useEventsTracking()

  useLayoutEffect(() => {
    trackEvent(EVENTS_TRACKING.OPEN_SETTINGS_PREFERENCES)
  }, [trackEvent])

  return (
    <BlockStack gap="400">
      <AppBlockInstallation appConfig={appConfig} />
      <Divider borderColor="border" />
      <LanguageSwitcher />
    </BlockStack>
  )
})
