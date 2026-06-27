import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import { useNavigate } from '@remix-run/react'
import { BlockStack, Button, Card, InlineStack, Page, AppProvider as PolarisAppProvider, Text } from '@shopify/polaris'
import { NavMenuItems } from '~/bootstrap/app-config'
import { json } from '~/bootstrap/fns/fetch.server'
import { authenticate, login } from '../../shopify/app.server'
import { loginErrorMessage } from './error.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Honor authentication outcome:
  // - admin context established → redirect to dashboard.
  // - authenticate.admin throws a Response that is a real redirect to
  //   somewhere other than /auth/login (Shopify's OAuth / embedded
  //   re-auth flow) → re-throw so Remix follows it.
  // - any other Response (error page, or a redirect that loops back to
  //   /auth/login when the user hits this URL directly without a shop
  //   context) → swallow and fall through to render the login form.
  // - non-Response error → render the login form fallback.
  try {
    const { admin, redirect } = await authenticate.admin(request)
    if (admin) {
      return redirect(NavMenuItems.DASHBOARD)
    }
  } catch (error) {
    if (error instanceof Response) {
      const isRedirect = error.status >= 300 && error.status < 400
      const location = error.headers.get('Location')
      const locationUrl = location ? new URL(location, request.url) : null
      const isSelfLoop = locationUrl?.pathname === '/auth/login'
      if (isRedirect && !isSelfLoop) throw error
    }
    console.log('Authenticate via login, falling back to login form:', error)
  }

  const errors = loginErrorMessage(await login(request))
  return json({ errors })
}

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const errors = loginErrorMessage(await login(request))

    return json({ errors })
  } catch (error) {
    return json({ errors: { shop: 'Invalid shop domain' } })
  }
}

export default function Auth() {
  const navigate = useNavigate()

  return (
    <PolarisAppProvider i18n={{}}>
      <Page>
        <Card>
          <BlockStack gap="200">
            <Text as="h2" variant="headingMd">
              TailorKit has just released a new version! Please go back to the dashboard to continue.
            </Text>
            <InlineStack align="end">
              <Button variant="primary" onClick={() => navigate(NavMenuItems.DASHBOARD)}>
                Back to dashboard
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>
      </Page>
    </PolarisAppProvider>
  )
}
