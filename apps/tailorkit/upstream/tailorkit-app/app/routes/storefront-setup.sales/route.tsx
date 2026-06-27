import { useRouteLoaderData } from '@remix-run/react'
import { BlockStack, Divider } from '@shopify/polaris'
import { useRootLoaderData } from '~/root'
import type { StorefrontSetupLoaderData } from '~/routes/storefront-setup/loader.server'
import CheckboxUpsellCard from './components/CheckboxUpsellCard'
import UpsellPricingCard from './components/UpsellPricingCard'

export default function SalesTab() {
  const loaderData = useRouteLoaderData<StorefrontSetupLoaderData>('routes/storefront-setup')
  const {
    shopData: { appConfig = {}, shopConfig = {} },
  } = useRootLoaderData()

  return (
    <BlockStack gap="400">
      <CheckboxUpsellCard isCheckboxOnboardingCompleted={loaderData?.isCheckboxOnboardingCompleted ?? false} />
      <Divider borderColor="border" />
      <UpsellPricingCard appConfig={appConfig} currency={shopConfig.currency} />
    </BlockStack>
  )
}
