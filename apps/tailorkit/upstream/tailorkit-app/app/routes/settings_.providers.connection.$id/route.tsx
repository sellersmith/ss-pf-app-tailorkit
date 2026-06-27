import { useLoaderData, type ClientLoaderFunctionArgs } from '@remix-run/react'
import withIdleTracker from '~/modules/IdleTimeTracker/withIdleTracker'
import { HydrateFallback } from '~/routes/dashboard/route'
import { authenticatedFetch } from '~/shopify/fns.client'
import ProviderConnectionForm from './ProviderConnectionForm'
import { DEFAULT_PROVIDER_INTEGRATION_DATA } from './constant'
import { withInteractiveChat } from '~/modules/InteractiveChat/withInteractiveChat'

export { HydrateFallback }

export const clientLoader = async ({ params }: ClientLoaderFunctionArgs) => {
  // Find all saved views
  const { providerIntegrationData, providerInfo }
    = (await authenticatedFetch(`/api/providers-connection/${params.id}`)) || {}

  return {
    providerData: providerInfo,
    providerIntegrationData: providerIntegrationData || DEFAULT_PROVIDER_INTEGRATION_DATA,
  }
}

function ProviderConnection() {
  const { providerData, providerIntegrationData } = useLoaderData<typeof clientLoader>()

  return <ProviderConnectionForm providerData={providerData} providerIntegrationData={providerIntegrationData} />
}

export default withIdleTracker(withInteractiveChat(ProviderConnection), 'providers')
