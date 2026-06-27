import { useLoaderData, useNavigate, type ClientLoaderFunctionArgs } from '@remix-run/react'
import { authenticatedFetch } from '~/shopify/fns.client'
import { HydrateFallback } from '~/routes/dashboard/route'
import { useEffect } from 'react'

export { HydrateFallback }

export const clientLoader = async ({ request }: ClientLoaderFunctionArgs) => {
  const { searchParams } = new URL(request.url)
  const shopDomain = searchParams.get('shopDomain')
  const tourType = searchParams.get('guide-tour-type')
  const url = `/api/onboarding?shopDomain=${shopDomain}&guide-tour-type=${tourType}`

  const res = await authenticatedFetch(url)
  if (res?.success) {
    return { redirectUrl: res.redirectUrl }
  }

  return null
}

function Index() {
  const loaderData = useLoaderData<typeof clientLoader>()
  const navigate = useNavigate()
  const redirectUrl = loaderData?.redirectUrl

  useEffect(() => {
    if (redirectUrl) {
      navigate(redirectUrl)
    }
  }, [redirectUrl, navigate])

  if (!redirectUrl) {
    return <div>Error: No route matches this URL</div>
  }

  return null
}

export default Index
