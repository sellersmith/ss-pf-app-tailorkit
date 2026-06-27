import { useLoaderData } from '@remix-run/react'
import { HydrateFallback } from '~/routes/dashboard/route'
import { authenticatedFetch } from '~/shopify/fns.client'
import ProviderPage from './ProviderPage'
import { linksImageModalCSS } from '~/modules/modals/ImageSelector'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { useLayoutEffect } from 'react'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { withInteractiveChat } from '~/modules/InteractiveChat/withInteractiveChat'

export { HydrateFallback }

export const links = () => [...linksImageModalCSS]

export const clientLoader = async () => {
  const { items: views } = (await authenticatedFetch(`/api/views?path=${location.pathname}`)) || {}

  return { views }
}

function Index() {
  const { views = [] } = useLoaderData<typeof clientLoader>() || {}

  const { trackEvent } = useEventsTracking()

  useLayoutEffect(() => {
    trackEvent(EVENTS_TRACKING.OPEN_PROVIDERS_INDEX)
  }, [trackEvent])

  return <ProviderPage views={views} />
}

export default withInteractiveChat(Index)
