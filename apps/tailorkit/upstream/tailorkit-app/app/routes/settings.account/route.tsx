import { BlockStack, Divider } from '@shopify/polaris'
import { useLayoutEffect, useState } from 'react'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { canUseFreeResources } from '~/models/PricingPlan.fns'
import { useRootLoaderData } from '~/root'
import AppUninstallation from './components/AppUninstallation'
import GeneralAccount from './components/GeneralAccount'
import UninstallSecondStepModal from './components/ModalConfirmUninstall'
import { withInteractiveChat } from '~/modules/InteractiveChat/withInteractiveChat'
import type { ShopDocument } from '~/models/Shop'
import { SettingsAccountSkeleton } from '../settings/components/SettingSkeletons'

export function HydrateFallback() {
  return <SettingsAccountSkeleton />
}

export default withInteractiveChat(function AccountSetting() {
  const [delayLoad, setDelayLoad] = useState(true)

  // Get shop data from root loader data
  const { shopData } = useRootLoaderData()

  // Check if shop approved charge
  const isPossibleUseFreeResources = canUseFreeResources({ shopData: shopData as ShopDocument })

  const { trackEvent } = useEventsTracking()

  useLayoutEffect(() => {
    trackEvent(EVENTS_TRACKING.OPEN_SETTINGS_ACCOUNT)
  }, [trackEvent])

  useLayoutEffect(() => {
    setDelayLoad(false)
  }, [])

  const shouldMount = isPossibleUseFreeResources && !delayLoad

  if (delayLoad) {
    return <SettingsAccountSkeleton />
  }

  if (!isPossibleUseFreeResources || !shouldMount) {
    return null
  }

  return (
    <BlockStack gap="400">
      <GeneralAccount shop={shopData} />
      <Divider borderColor="border" />
      <AppUninstallation />
      <UninstallSecondStepModal />
    </BlockStack>
  )
})
